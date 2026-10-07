import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();
const profileInput = z.object({
  full_name: z.string().trim().min(2).max(120),
  first_name: z.string().trim().min(1).max(120),
  surname: z.string().trim().min(1).max(120),
  sport: optionalText(80),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  phone: optionalText(40),
  headline: optionalText(120),
  position: optionalText(80),
  school_name: optionalText(160),
  team: optionalText(120),
  district: optionalText(120),
  country: optionalText(120),
  bio: optionalText(1500),
  skills: z.array(z.string().trim().min(1).max(60)).max(20),
  interests: z.array(z.string().trim().min(1).max(60)).max(20),
  discoverable: z.boolean(),
  visibility: z.enum(['community', 'connections']),
});

export const loadAthleteProfile = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(() => z.object({}).parse({}))
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const db = supabaseAdmin as any;
    const [{ data: profile, error: profileError }, { data: community, error: communityError }, { data: links, error: linksError }] = await Promise.all([
      db.from('profiles').select('id, full_name, email, avatar_path').eq('id', context.userId).maybeSingle(),
      db.from('community_profiles').select('headline, sport, position, school_name, team, district, country, bio, skills, interests, cover_path, discoverable, visibility').eq('user_id', context.userId).maybeSingle(),
      db.from('athlete_guardians').select('athlete_id, athletes(id, first_name, surname, sport, date_of_birth, phone, photo_path, athlete_code)').eq('user_id', context.userId).limit(1),
    ]);
    if (profileError) { console.error('[profile] profile row load failed', profileError); throw new Error('Your account profile could not be loaded.'); }
    if (communityError) { console.error('[profile] community row load failed', communityError); throw new Error('Your community profile could not be loaded. Please run the latest database migrations.'); }
    if (linksError) { console.error('[profile] athlete link load failed', linksError); throw new Error('Your athlete record link could not be loaded.'); }
    return { profile, community, athlete: links?.[0]?.athletes ?? null };
  });

export const saveAthleteProfile = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => profileInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const db = supabaseAdmin as any;
    const { error } = await db.rpc('save_athlete_profile', {
      p_user_id: context.userId,
      p_full_name: data.full_name,
      p_first_name: data.first_name,
      p_surname: data.surname,
      p_sport: data.sport || null,
      p_date_of_birth: data.date_of_birth || null,
      p_phone: data.phone || null,
      p_headline: data.headline || null,
      p_position: data.position || null,
      p_school_name: data.school_name || null,
      p_team: data.team || null,
      p_district: data.district || null,
      p_country: data.country || null,
      p_bio: data.bio || null,
      p_skills: data.skills,
      p_interests: data.interests,
      p_discoverable: data.discoverable,
      p_visibility: data.visibility,
    });
    if (error) { console.error('[profile] atomic save failed', error); throw new Error(`Profile could not be saved: ${error.message}`); }
    return { ok: true };
  });
