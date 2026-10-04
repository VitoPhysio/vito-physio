import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

const name = z.string().trim().min(2).max(120);
const email = z.string().trim().email().max(255);
const phone = z.string().trim().max(40).optional();
const organisation = z.enum(['school', 'academy', 'club']);

export const registerOrganisation = createServerFn({ method: 'POST' })
  .inputValidator((input) => z.object({ name, school_type: organisation, location: z.string().trim().max(160).optional(), contact_phone: phone, intake_notes: z.string().trim().max(1000).optional() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: row, error } = await supabaseAdmin.from('schools').insert({ name: data.name, school_type: data.school_type, location: data.location || null, contact_phone: data.contact_phone || null, intake_notes: data.intake_notes || null, self_registered: true }).select('school_code').single();
    if (error) throw new Error('Registration could not be saved. Please try again.');
    return row.school_code;
  });

export const registerAthlete = createServerFn({ method: 'POST' })
  .inputValidator((input) => z.object({ first_name: name, surname: name, sport: z.string().trim().max(120).optional(), phone, date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: row, error } = await supabaseAdmin.from('athletes').insert({ first_name: data.first_name, surname: data.surname, sport: data.sport || null, phone: data.phone || null, date_of_birth: data.date_of_birth || null, self_registered: true }).select('athlete_code').single();
    if (error) throw new Error('Registration could not be saved. Please try again.');
    return row.athlete_code;
  });

export const requestConsultation = createServerFn({ method: 'POST' })
  .inputValidator((input) => z.object({ contact_name: name, email, phone, organisation_type: z.enum(['individual','school','academy','club']), message: z.string().trim().min(10).max(2000) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { error } = await supabaseAdmin.from('consultation_requests').insert({ contact_name: data.contact_name, email: data.email, phone: data.phone || null, organisation_type: data.organisation_type, message: data.message });
    if (error) throw new Error('Request could not be sent. Please try again.');
    return { ok: true };
  });

const credentials = z.object({ code: z.string().trim().toUpperCase().regex(/^VITO-ATH-\d{6,8}$/), surname: name });
export const findPortalRecord = createServerFn({ method: 'POST' })
  .inputValidator((input) => credentials.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: athlete } = await supabaseAdmin.from('athletes').select('id, first_name, surname, athlete_code').eq('athlete_code', data.code).ilike('surname', data.surname).maybeSingle();
    if (!athlete) return null;
    const [plans, appointments] = await Promise.all([
      supabaseAdmin.from('rehabilitation_plans').select('goals, phase, target_return_date').eq('athlete_id', athlete.id).order('created_at', { ascending: false }).limit(10),
      supabaseAdmin.from('appointments').select('scheduled_at, location, purpose, status').eq('athlete_id', athlete.id).order('scheduled_at', { ascending: true }).limit(10),
    ]);
    return { athlete: { first_name: athlete.first_name, athlete_code: athlete.athlete_code }, plans: plans.data ?? [], appointments: appointments.data ?? [] };
  });

export const requestConsent = createServerFn({ method: 'POST' })
  .inputValidator((input) => credentials.extend({ requester_name: name, requester_email: email }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: athlete } = await supabaseAdmin.from('athletes').select('id').eq('athlete_code', data.code).ilike('surname', data.surname).maybeSingle();
    if (!athlete) return { ok: false };
    const { error } = await supabaseAdmin.from('consent_requests').insert({ athlete_id: athlete.id, requester_name: data.requester_name, requester_email: data.requester_email });
    if (error) throw new Error('Could not submit the request.');
    return { ok: true };
  });
