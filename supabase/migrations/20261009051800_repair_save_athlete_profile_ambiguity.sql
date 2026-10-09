-- Fix the profile-save RPC's ambiguous athlete_id reference and refresh PostgREST.
CREATE OR REPLACE FUNCTION public.save_athlete_profile(
  p_user_id uuid,
  p_full_name text,
  p_first_name text,
  p_surname text,
  p_sport text,
  p_date_of_birth date,
  p_phone text,
  p_headline text,
  p_position text,
  p_school_name text,
  p_team text,
  p_district text,
  p_country text,
  p_bio text,
  p_skills text[],
  p_interests text[],
  p_discoverable boolean,
  p_visibility text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_athlete_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id AND NOT public.is_vito_staff(auth.uid()) THEN
    RAISE EXCEPTION 'You cannot update this profile.';
  END IF;
  IF p_visibility NOT IN ('community', 'connections') THEN
    RAISE EXCEPTION 'Invalid profile visibility.';
  END IF;

  UPDATE public.profiles
  SET full_name = left(btrim(p_full_name), 120)
  WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile account was not found.';
  END IF;

  SELECT ag.athlete_id INTO v_athlete_id
  FROM public.athlete_guardians ag
  WHERE ag.user_id = p_user_id AND ag.relationship = 'self'
  ORDER BY ag.created_at
  LIMIT 1;

  IF v_athlete_id IS NULL THEN
    INSERT INTO public.athletes (first_name, surname, sport, date_of_birth, phone, created_by, self_registered)
    VALUES (left(btrim(p_first_name), 120), left(btrim(p_surname), 120), nullif(btrim(p_sport), ''), p_date_of_birth, nullif(btrim(p_phone), ''), p_user_id, true)
    RETURNING id INTO v_athlete_id;

    INSERT INTO public.athlete_guardians (user_id, athlete_id, relationship)
    VALUES (p_user_id, v_athlete_id, 'self')
    ON CONFLICT (user_id, athlete_id) DO NOTHING;
  ELSE
    UPDATE public.athletes
    SET first_name = left(btrim(p_first_name), 120),
        surname = left(btrim(p_surname), 120),
        sport = nullif(btrim(p_sport), ''),
        date_of_birth = p_date_of_birth,
        phone = nullif(btrim(p_phone), '')
    WHERE id = v_athlete_id;
  END IF;

  INSERT INTO public.community_profiles (
    user_id, headline, sport, position, school_name, team, district, country,
    bio, skills, interests, discoverable, visibility
  )
  VALUES (
    p_user_id,
    nullif(btrim(p_headline), ''),
    nullif(btrim(p_sport), ''),
    nullif(btrim(p_position), ''),
    nullif(btrim(p_school_name), ''),
    nullif(btrim(p_team), ''),
    nullif(btrim(p_district), ''),
    nullif(btrim(p_country), ''),
    nullif(btrim(p_bio), ''),
    coalesce(p_skills, '{}'),
    coalesce(p_interests, '{}'),
    coalesce(p_discoverable, true),
    p_visibility
  )
  ON CONFLICT (user_id) DO UPDATE SET
    headline = excluded.headline,
    sport = excluded.sport,
    position = excluded.position,
    school_name = excluded.school_name,
    team = excluded.team,
    district = excluded.district,
    country = excluded.country,
    bio = excluded.bio,
    skills = excluded.skills,
    interests = excluded.interests,
    discoverable = excluded.discoverable,
    visibility = excluded.visibility;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.save_athlete_profile(uuid, text, text, text, text, date, text, text, text, text, text, text, text, text, text[], text[], boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_athlete_profile(uuid, text, text, text, text, date, text, text, text, text, text, text, text, text, text[], text[], boolean, text) TO service_role;
NOTIFY pgrst, 'reload schema';
