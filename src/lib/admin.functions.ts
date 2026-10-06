import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

async function adminLevel(supabase: any, userId: string) {
  const [{ data: sup }, { data: vito }] = await Promise.all([
    supabase.rpc('has_role', { _user_id: userId, _role: 'super_admin' }),
    supabase.rpc('has_role', { _user_id: userId, _role: 'vito_admin' }),
  ]);
  if (sup) return 'super' as const;
  if (vito) return 'vito' as const;
  throw new Error('Forbidden');
}

export const listAccounts = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const level = await adminLevel(context.supabase, context.userId);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabaseAdmin.from('profiles').select('id, account_code, full_name, email, requested_role, avatar_path, created_at').order('created_at', { ascending: false }),
      supabaseAdmin.from('user_roles').select('user_id, role'),
    ]);
    return { level, me: context.userId, accounts: (profiles ?? []).map((p) => ({ ...p, role: roles?.find((r) => r.user_id === p.id)?.role ?? 'athlete' })) };
  });

export const approveAccount = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ userId: z.string().uuid(), approve: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const level = await adminLevel(context.supabase, context.userId);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: p } = await supabaseAdmin.from('profiles').select('requested_role').eq('id', data.userId).single();
    const req = p?.requested_role;
    if (req !== 'vito_admin' && req !== 'clinical_professional') throw new Error('No pending request.');
    if (req === 'vito_admin' && level !== 'super') throw new Error('Only the super admin can approve VITO admins.');
    if (data.approve) {
      const { error } = await supabaseAdmin.from('user_roles').update({ role: req }).eq('user_id', data.userId);
      if (error) throw error;
    }
    await supabaseAdmin.from('profiles').update({ requested_role: data.approve ? `${req}:approved` : `${req}:declined` }).eq('id', data.userId);
    return { ok: true };
  });

export const removeAccount = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const level = await adminLevel(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error('You cannot remove your own account.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: r } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', data.userId);
    const roles = (r ?? []).map((x) => x.role);
    if (roles.includes('super_admin')) throw new Error('The super admin cannot be removed.');
    if (roles.includes('vito_admin') && level !== 'super') throw new Error('Only the super admin can remove VITO admins.');
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error('Account could not be removed.');
    await Promise.all([
      supabaseAdmin.from('user_roles').delete().eq('user_id', data.userId),
      supabaseAdmin.from('school_users').delete().eq('user_id', data.userId),
      supabaseAdmin.from('athlete_guardians').delete().eq('user_id', data.userId),
      supabaseAdmin.from('profiles').delete().eq('id', data.userId),
    ]);
    return { ok: true };
  });
