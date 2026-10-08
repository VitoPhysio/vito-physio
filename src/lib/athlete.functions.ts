import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { Database } from '@/integrations/supabase/types';

type Ctx = { supabase: SupabaseClient<Database>; userId: string };

/** Athlete records the signed-in user is linked to (as athlete or guardian). Read through RLS. */
async function linkedAthleteIds(context: Ctx): Promise<string[]> {
  const { data, error } = await context.supabase.from('athlete_guardians').select('athlete_id').eq('user_id', context.userId);
  if (error) throw error;
  return (data ?? []).map((r) => r.athlete_id);
}

// Athletes report a new injury into the existing case system; it lands as a "new" case
// for the clinical team in the case workspace, exactly like a staff-opened case.
export const reportInjury = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    athlete_id: z.string().uuid(),
    body_region: z.string().trim().min(2).max(120),
    mechanism: z.string().trim().max(500).optional(),
    injury_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    pain_score: z.number().int().min(0).max(10).optional(),
    sport_context: z.string().trim().max(160).optional(),
    notes: z.string().trim().max(1500).optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    if (!(await linkedAthleteIds(context)).includes(data.athlete_id)) throw new Error('This athlete is not linked to your account.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: row, error } = await supabaseAdmin.from('injuries').insert({
      athlete_id: data.athlete_id,
      body_region: data.body_region,
      mechanism: data.mechanism || null,
      injury_date: data.injury_date || null,
      pain_score: data.pain_score ?? null,
      sport_context: data.sport_context || null,
      notes: `[Self-reported via athlete portal]${data.notes ? ` ${data.notes}` : ''}`,
      status: 'new',
      created_by: context.userId,
    }).select('injury_code').single();
    if (error) throw new Error('The injury report could not be saved.');
    await supabaseAdmin.from('communications').insert({
      sender_id: context.userId,
      athlete_id: data.athlete_id,
      audience: 'clinicians',
      subject: `New injury reported · ${row.injury_code}`,
      body: `An athlete reported a new injury (${data.body_region}) through the athlete portal. Open ${row.injury_code} in the case workspace to review it.`,
    });
    return row.injury_code;
  });

// Private clinical communication. Goes to a named VITO clinician, or the whole clinical team.
export const contactClinician = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    recipient_id: z.string().uuid().optional(),
    athlete_id: z.string().uuid().optional(),
    kind: z.enum(['message', 'appointment', 'consultation', 'follow_up']),
    subject: z.string().trim().max(160).optional(),
    body: z.string().trim().min(2).max(4000),
  }).parse(input))
  .handler(async ({ data, context }) => {
    if (data.athlete_id && !(await linkedAthleteIds(context)).includes(data.athlete_id)) throw new Error('This athlete is not linked to your account.');
    if (data.recipient_id) {
      const { data: staff } = await context.supabase.rpc('is_vito_staff', { _user_id: data.recipient_id });
      if (!staff) throw new Error('Messages can only be sent to the VITO clinical team.');
    }
    const prefix = { message: '', appointment: 'Appointment request', consultation: 'Consultation request', follow_up: 'Follow-up request' }[data.kind];
    const subject = [prefix, data.subject].filter(Boolean).join(' · ') || null;
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { error } = await supabaseAdmin.from('communications').insert({
      sender_id: context.userId,
      recipient_id: data.recipient_id ?? null,
      athlete_id: data.athlete_id ?? null,
      audience: data.recipient_id ? null : 'clinicians',
      subject,
      body: data.body,
    });
    if (error) throw new Error('Your message could not be sent.');
    // Appointment / consultation / follow-up requests also land in the staff request queue.
    if (data.kind !== 'message' && data.athlete_id) {
      await context.supabase.from('care_requests').insert({ athlete_id: data.athlete_id, requester_id: context.userId, kind: data.kind, message: data.body });
    }
    return { ok: true };
  });

// Assessments stay staff-only in the database; athletes get a summary (no clinical findings).
export const getMyAssessments = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ids = await linkedAthleteIds(context);
    if (!ids.length) return [];
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data, error } = await supabaseAdmin.from('assessments')
      .select('id, assessment_code, assessment_type, assessment_date, follow_up_date, injury_id, athlete_id, created_by')
      .in('athlete_id', ids).order('assessment_date', { ascending: false }).limit(30);
    if (error) throw new Error('Assessments could not be loaded.');
    return data ?? [];
  });
