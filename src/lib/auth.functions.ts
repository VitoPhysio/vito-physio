import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '@/integrations/supabase/types';

export const signInWithIdentifier = createServerFn({ method: 'POST' })
  .inputValidator((input) => z.object({
    identifier: z.string().trim().max(255),
    password: z.string().min(1, 'Enter your password.').max(200),
  }).parse(input))
  .handler(async ({ data }) => {
    let email = data.identifier.toLowerCase();
    if (!email.includes('@')) {
      const code = data.identifier.toUpperCase();
      if (!/^VITO-ACC-[A-F0-9]{12}$/.test(code)) throw new Error('Enter your email, or your VITO account ID like VITO-ACC-1A2B3C4D5E6F.');
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      const { data: profile } = await supabaseAdmin.from('profiles').select('email').eq('account_code', code).maybeSingle();
      if (!profile?.email) throw new Error('No account found with that VITO account ID.');
      email = profile.email;
    }

    const url = process.env['SUPABASE_URL'];
    const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
    if (!url || !key) throw new Error('Sign-in is temporarily unavailable.');
    const client = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: result, error } = await client.auth.signInWithPassword({ email, password: data.password });
    if (error?.code === 'email_not_confirmed' || /not confirmed/i.test(error?.message ?? '')) throw new Error('Your email is not confirmed yet. Click the link we emailed you, or use "Resend confirmation email" below.');
    if (error || !result.session) throw new Error('Wrong email/ID or password. Check them, or use "Forgot password".');
    return { access_token: result.session.access_token, refresh_token: result.session.refresh_token };
  });