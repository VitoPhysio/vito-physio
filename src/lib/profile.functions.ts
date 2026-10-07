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
    if (profileError || communityError || linksError) throw new Error('Profile could not be loaded.');
    return { profile, community, athlete: links?.[0]?.athletes ?? null };
  });

export const saveAthleteProfile = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => profileInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const db = supabaseAdmin as any;
    const { error: profileError } = await db.from('profiles').update({ full_name: data.full_name }).eq('id', context.userId);
    if (profileError) throw new Error('Profile could not be saved.');

    const { data: links, error: linksError } = await db.from('athlete_guardians').select('athlete_id').eq('user_id', context.userId).limit(1);
    if (linksError) throw new Error('Athlete record could not be loaded.');
    const athleteId = links?.[0]?.athlete_id;
    if (athleteId) {
      const { error: athleteError } = await db.from('athletes').update({
        first_name: data.first_name,
        surname: data.surname,
        sport: data.sport || null,
        date_of_birth: data.date_of_birth || null,
        phone: data.phone || null,
      }).eq('id', athleteId);
      if (athleteError) throw new Error('Athlete details could not be saved.');
    }

    const { error: communityError } = await db.from('community_profiles').upsert({
      user_id: context.userId,
      headline: data.headline || null,
      sport: data.sport || null,
      position: data.position || null,
      school_name: data.school_name || null,
      team: data.team || null,
      district: data.district || null,
      country: data.country || null,
      bio: data.bio || null,
      skills: data.skills,
      interests: data.interests,
      discoverable: data.discoverable,
      visibility: data.visibility,
    }, { onConflict: 'user_id' });
    if (communityError) throw new Error('Community profile could not be saved.');
    return { ok: true };
  });
