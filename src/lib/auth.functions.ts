import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '@/integrations/supabase/types';
import { athleteLoginEmail, isAthleteCode } from '@/lib/athlete-login';

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
