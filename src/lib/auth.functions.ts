import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '@/integrations/supabase/types';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { athleteLoginEmail, isAthleteCode } from '@/lib/athlete-login';
import { GOOGLE_SIGNUP_ROLES, isFirstGoogleSignup, planGoogleSignupRole } from '@/lib/google-signup';

type SignInResult = { access_token: string; refresh_token: string } | { needsPassword: true };

async function passwordSignIn(email: string, password: string) {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !key) throw new Error('Sign-in is temporarily unavailable.');
  const client = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: result, error } = await client.auth.signInWithPassword({ email, password });
  if (error?.code === 'email_not_confirmed' || /not confirmed/i.test(error?.message ?? '')) throw new Error('Your email is not confirmed yet. Click the link we emailed you, or use "Resend confirmation email" below.');
  if (error || !result.session) throw new Error('Wrong email/ID or password. Check them, or use "Forgot password".');
  return { access_token: result.session.access_token, refresh_token: result.session.refresh_token };
}

export const signInWithIdentifier = createServerFn({ method: 'POST' })
  .inputValidator((input) => z.object({
    identifier: z.string().trim().max(255),
    password: z.string().min(1, 'Enter your password.').max(200),
  }).parse(input))
  .handler(async ({ data }): Promise<SignInResult> => {
    let email = data.identifier.toLowerCase();
    if (!email.includes('@')) {
      const code = data.identifier.toUpperCase();
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      if (isAthleteCode(code)) {
        const { data: athlete } = await supabaseAdmin.from('athletes').select('id').eq('athlete_code', code).maybeSingle();
        if (!athlete) throw new Error('No athlete found with that athlete ID.');
        const { data: link } = await supabaseAdmin.from('athlete_guardians').select('user_id').eq('athlete_id', athlete.id).eq('relationship', 'self').limit(1).maybeSingle();
        if (!link) return { needsPassword: true };
        const { data: profile } = await supabaseAdmin.from('profiles').select('email').eq('id', link.user_id).maybeSingle();
        if (!profile?.email) throw new Error('This athlete ID cannot sign in yet. Ask your clinician for help.');
        email = profile.email;
      } else {
        if (!/^VITO-ACC-[A-F0-9]{12}$/.test(code)) throw new Error('Enter your email, athlete ID (VITO-ATH-…) or VITO account ID (VITO-ACC-…).');
        const { data: profile } = await supabaseAdmin.from('profiles').select('email').eq('account_code', code).maybeSingle();
        if (!profile?.email) throw new Error('No account found with that VITO account ID.');
        email = profile.email;
      }
    }
    return passwordSignIn(email, data.password);
  });

/** First sign-in for athletes a clinician registered: verify ID + surname, create their login, then sign in. */
export const setupAthleteIdLogin = createServerFn({ method: 'POST' })
  .inputValidator((input) => z.object({
    code: z.string().trim().toUpperCase().max(32).refine(isAthleteCode, 'Enter a valid athlete ID.'),
    surname: z.string().trim().min(1, 'Enter your surname.').max(120),
    password: z.string().min(8, 'Password must be at least 8 characters.').max(200),
  }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: athlete } = await supabaseAdmin.from('athletes').select('id, first_name, surname').eq('athlete_code', data.code).ilike('surname', data.surname).maybeSingle();
    if (!athlete) throw new Error('The athlete ID and surname do not match our records.');
    const { data: link } = await supabaseAdmin.from('athlete_guardians').select('id').eq('athlete_id', athlete.id).eq('relationship', 'self').limit(1).maybeSingle();
    if (link) throw new Error('This athlete ID already has a password. Sign in, or use "Forgot password".');
    const email = athleteLoginEmail(data.code);
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email, password: data.password, email_confirm: true,
      user_metadata: { full_name: `${athlete.first_name} ${athlete.surname}`, requested_role: 'athlete' },
    });
    if (error || !created.user) throw new Error('Could not set up your login. Try again or contact your clinician.');
    const { error: linkError } = await supabaseAdmin.from('athlete_guardians').insert({ user_id: created.user.id, athlete_id: athlete.id, relationship: 'self' });
    if (linkError) { await supabaseAdmin.auth.admin.deleteUser(created.user.id); throw new Error('Could not link your athlete record.'); }
    return passwordSignIn(email, data.password);
  });

/**
 * After a Google sign-in, apply the role the person chose on the signup form.
 * Google OAuth cannot carry signup metadata, so handle_new_user has already
 * given them the default athlete role; this mirrors what the trigger would
 * have done had the chosen role reached it. Staff roles stay approval-gated:
 * only the request is recorded.
 */
export const claimGoogleSignupRole = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ role: z.enum(GOOGLE_SIGNUP_ROLES) }).parse(input))
  .handler(async ({ data, context: { supabase, userId } }) => {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user || auth.user.id !== userId) throw new Error('Your Google account could not be checked.');
    if (!isFirstGoogleSignup(auth.user)) return { ok: true };
    const { data: roleRows, error } = await supabase.from('user_roles').select('role').eq('user_id', userId);
    if (error) throw new Error('Your account role could not be checked.');
    const plan = planGoogleSignupRole(data.role, (roleRows ?? []).map((r) => r.role), true);

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const finish = async () => {
      const { error: finishError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        app_metadata: { ...auth.user.app_metadata, vito_google_signup_complete: true },
      });
      if (finishError) throw new Error('Your Google signup could not be completed. Please try again.');
      return { ok: true };
    };
    if (plan.kind === 'none') return finish();
    if (plan.kind === 'request-staff') {
      const { error: requestError } = await supabaseAdmin.from('profiles').update({ requested_role: plan.role }).eq('id', userId);
      if (requestError) throw new Error('Your staff access request could not be saved.');
      return finish();
    }

    // Remove the default athlete role and its empty self-registered athlete
    // record (kept when it already has injury cases), then grant the chosen role.
    const { data: links, error: linksError } = await supabaseAdmin.from('athlete_guardians').select('athlete_id').eq('user_id', userId).eq('relationship', 'self');
    if (linksError) throw new Error('Your signup record could not be checked.');
    for (const link of links ?? []) {
      const { count, error: casesError } = await supabaseAdmin.from('injuries').select('id', { count: 'exact', head: true }).eq('athlete_id', link.athlete_id);
      if (casesError) throw new Error('Your existing case records could not be checked.');
      if ((count ?? 0) > 0) continue;
      const { data: athlete } = await supabaseAdmin.from('athletes').select('self_registered').eq('id', link.athlete_id).maybeSingle();
      if (!athlete?.self_registered) continue;
      await supabaseAdmin.from('athlete_guardians').delete().eq('user_id', userId).eq('athlete_id', link.athlete_id);
      await supabaseAdmin.from('athletes').delete().eq('id', link.athlete_id);
    }
    const { error: grantError } = await supabaseAdmin.from('user_roles').upsert({ user_id: userId, role: plan.role }, { onConflict: 'user_id,role' });
    if (grantError) throw new Error('Your selected account type could not be saved.');
    const { error: removeError } = await supabaseAdmin.from('user_roles').delete().eq('user_id', userId).eq('role', 'athlete');
    if (removeError) throw new Error('Your account type could not be completed.');
    const { error: profileError } = await supabaseAdmin.from('profiles').update({ requested_role: plan.role }).eq('id', userId);
    if (profileError) throw new Error('Your account request could not be saved.');
    return finish();
  });
