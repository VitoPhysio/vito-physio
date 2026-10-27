import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export const linkAccount = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ code: z.string().trim().toUpperCase().max(32), surname: z.string().trim().max(120).optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: roleRows, error: roleError } = await context.supabase.from('user_roles').select('role').eq('user_id', context.userId);
    if (roleError) throw roleError;
    const role = roleRows?.[0]?.role;
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    if (role === 'athlete' || role === 'parent') {
      if (!/^VITO-ATH-\d{6,8}$/.test(data.code) || !data.surname) return false;
      const { data: athlete } = await supabaseAdmin.from('athletes').select('id').eq('athlete_code', data.code).ilike('surname', data.surname).maybeSingle();
      if (!athlete) return false;
      if (role === 'athlete') {
        // Avoid the same athlete appearing twice: move this login from its self-registered record to the clinician's record.
        const { data: claimed } = await supabaseAdmin.from('athlete_guardians').select('user_id').eq('athlete_id', athlete.id).eq('relationship', 'self').neq('user_id', context.userId).limit(1).maybeSingle();
        if (claimed) throw new Error('This athlete ID is already linked to another login.');
        const { data: own } = await supabaseAdmin.from('athlete_guardians').select('id, athlete_id, athletes(self_registered)').eq('user_id', context.userId).eq('relationship', 'self').neq('athlete_id', athlete.id);
        for (const row of own ?? []) {
          if (!row.athletes?.self_registered) continue;
          await supabaseAdmin.from('athlete_guardians').delete().eq('id', row.id);
          const { count } = await supabaseAdmin.from('injuries').select('id', { count: 'exact', head: true }).eq('athlete_id', row.athlete_id);
          if (!count) await supabaseAdmin.from('athletes').delete().eq('id', row.athlete_id);
        }
      }
      const { error } = await supabaseAdmin.from('athlete_guardians').upsert({ user_id: context.userId, athlete_id: athlete.id, relationship: role === 'parent' ? 'parent' : 'self' }, { onConflict: 'user_id,athlete_id' });
      if (error) throw error;
      return true;
    }
    if (role === 'school_admin' || role === 'coach') {
      if (!/^VITO-SCH-\d{6,8}$/.test(data.code)) return false;
      const { data: school } = await supabaseAdmin.from('schools').select('id').eq('school_code', data.code).maybeSingle();
      if (!school) return false;
      const { error } = await supabaseAdmin.from('school_users').upsert({ user_id: context.userId, school_id: school.id }, { onConflict: 'user_id,school_id' });
      if (error) throw error;
      return true;
    }
    throw new Error('This account does not need linking.');
  });
