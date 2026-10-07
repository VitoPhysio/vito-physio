-- Repair profile and cover-photo infrastructure for databases where the community
-- migration or avatar bucket was not provisioned together with the application.

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Signed-in users can view avatars" ON storage.objects;
CREATE POLICY "Signed-in users can view avatars"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars');

-- Existing athlete accounts should receive the same community-profile row used by
-- the profile editor and cover-photo flow.
INSERT INTO public.community_profiles (user_id)
SELECT ur.user_id
FROM public.user_roles ur
WHERE ur.role = 'athlete'
UNION
SELECT ag.user_id
FROM public.athlete_guardians ag
WHERE ag.relationship = 'self'
ON CONFLICT (user_id) DO NOTHING;

-- Keep new athlete accounts linked to both their clinical record and community
-- profile from the start. This extends the existing account trigger idempotently.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  req text;
  r public.app_role;
  av text;
  full_name text;
  first_name text;
  surname text;
  athlete_id uuid;
BEGIN
  req := new.raw_user_meta_data->>'requested_role';
  av := new.raw_user_meta_data->>'avatar_path';
  IF av IS NOT NULL AND av !~ '^uploads/[0-9a-f-]{36}\.(png|jpg|webp)$' THEN av := NULL; END IF;

  INSERT INTO public.profiles (id, full_name, email, requested_role, avatar_path)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.email, left(req, 40), av);

  IF lower(new.email) = 'vitophysio256@gmail.com' THEN
    r := 'super_admin';
  ELSIF req IN ('school_admin','coach','athlete','parent') THEN
    r := req::public.app_role;
  ELSE
    r := 'athlete';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, r);

  IF r = 'athlete' THEN
    full_name := btrim(coalesce(new.raw_user_meta_data->>'full_name', 'Athlete'));
    first_name := split_part(full_name, ' ', 1);
    surname := btrim(substr(full_name, length(first_name) + 1));
    IF first_name = '' THEN first_name := 'Athlete'; END IF;
    IF surname = '' THEN surname := first_name; END IF;

    INSERT INTO public.athletes (first_name, surname, photo_path, created_by, self_registered)
    VALUES (left(first_name, 120), left(surname, 120), av, new.id, true)
    RETURNING id INTO athlete_id;

    INSERT INTO public.athlete_guardians (user_id, athlete_id, relationship)
    VALUES (new.id, athlete_id, 'self')
    ON CONFLICT (user_id, athlete_id) DO NOTHING;

    INSERT INTO public.community_profiles (user_id)
    VALUES (new.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN new;
END;
$function$;

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
  athlete_id uuid;
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

  SELECT ag.athlete_id INTO athlete_id
  FROM public.athlete_guardians ag
  WHERE ag.user_id = p_user_id AND ag.relationship = 'self'
  ORDER BY ag.created_at
  LIMIT 1;

  IF athlete_id IS NULL THEN
    INSERT INTO public.athletes (first_name, surname, sport, date_of_birth, phone, created_by, self_registered)
    VALUES (left(btrim(p_first_name), 120), left(btrim(p_surname), 120), nullif(btrim(p_sport), ''), p_date_of_birth, nullif(btrim(p_phone), ''), p_user_id, true)
    RETURNING id INTO athlete_id;
    INSERT INTO public.athlete_guardians (user_id, athlete_id, relationship)
    VALUES (p_user_id, athlete_id, 'self')
    ON CONFLICT (user_id, athlete_id) DO NOTHING;
  ELSE
    UPDATE public.athletes
    SET first_name = left(btrim(p_first_name), 120),
        surname = left(btrim(p_surname), 120),
        sport = nullif(btrim(p_sport), ''),
        date_of_birth = p_date_of_birth,
        phone = nullif(btrim(p_phone), '')
    WHERE id = athlete_id;
  END IF;

  INSERT INTO public.community_profiles (
    user_id, headline, sport, position, school_name, team, district, country,
    bio, skills, interests, discoverable, visibility
  ) VALUES (
    p_user_id, nullif(btrim(p_headline), ''), nullif(btrim(p_sport), ''),
    nullif(btrim(p_position), ''), nullif(btrim(p_school_name), ''),
    nullif(btrim(p_team), ''), nullif(btrim(p_district), ''),
    nullif(btrim(p_country), ''), nullif(btrim(p_bio), ''),
    coalesce(p_skills, '{}'), coalesce(p_interests, '{}'),
    coalesce(p_discoverable, true), p_visibility
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
