import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '@/integrations/supabase/types';

export const signInWithIdentifier = createServerFn({ method: 'POST' })
  .inputValidator((input) => z.object({
    identifier: z.string().trim().max(255),
    password: z.string().min(6).max(200),
  }).parse(input))
  .handler(async ({ data }) => {
    let email = data.identifier.toLowerCase();
    if (!email.includes('@')) {
      const code = data.identifier.toUpperCase();
      if (!/^VITO-ACC-[A-F0-9]{12}$/.test(code)) throw new Error('Invalid email or VITO account ID.');
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      const { data: profile } = await supabaseAdmin.from('profiles').select('email').eq('account_code', code).maybeSingle();
      if (!profile?.email) throw new Error('Invalid sign-in details.');
      email = profile.email;
    }

    const url = process.env['SUPABASE_URL'];
    const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
    if (!url || !key) throw new Error('Sign-in is temporarily unavailable.');
    const client = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: result, error } = await client.auth.signInWithPassword({ email, password: data.password });
    if (error || !result.session) throw new Error('Invalid sign-in details, or your email is not verified.');
    return { access_token: result.session.access_token, refresh_token: result.session.refresh_token };
  });