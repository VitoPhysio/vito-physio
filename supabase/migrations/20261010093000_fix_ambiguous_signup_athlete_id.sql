-- The signup trigger failed with "column reference athlete_id is ambiguous"
-- because the PL/pgSQL variable had the same name as ag.athlete_id.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  req text;
  r public.app_role;
  av text;
  full_name text;
  first_name text;
  surname text;
  v_athlete_id uuid;
  org_id uuid;
  org_type text;
  dob date;
BEGIN
  req := m->>'requested_role';
  av := m->>'avatar_path';
  IF av IS NOT NULL AND av !~ '^uploads/[0-9a-f-]{36}\.(png|jpg|webp)$' THEN av := NULL; END IF;

  INSERT INTO public.profiles (id, full_name, email, requested_role, avatar_path)
  VALUES (new.id, nullif(btrim(m->>'full_name'), ''), new.email, left(req, 40), av)
  ON CONFLICT (id) DO UPDATE SET
    full_name = excluded.full_name,
    email = excluded.email,
    requested_role = excluded.requested_role,
    avatar_path = coalesce(excluded.avatar_path, public.profiles.avatar_path),
    updated_at = now();

  IF lower(new.email) = 'vitophysio256@gmail.com' THEN
    r := 'super_admin';
  ELSIF req IN ('school_admin', 'coach', 'athlete', 'parent') THEN
    r := req::public.app_role;
  ELSE
    r := 'athlete';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, r)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF r = 'athlete' THEN
    full_name := btrim(coalesce(m->>'full_name', 'Athlete'));
    first_name := coalesce(nullif(btrim(m->>'first_name'), ''), split_part(full_name, ' ', 1));
    surname := coalesce(nullif(btrim(m->>'surname'), ''), btrim(substr(full_name, length(split_part(full_name, ' ', 1)) + 1)));
    IF first_name = '' THEN first_name := 'Athlete'; END IF;
    IF surname = '' THEN surname := first_name; END IF;
    BEGIN
      dob := nullif(m->>'date_of_birth', '')::date;
    EXCEPTION WHEN others THEN
      dob := NULL;
    END;

    SELECT ag.athlete_id INTO v_athlete_id
    FROM public.athlete_guardians AS ag
    WHERE ag.user_id = new.id AND ag.relationship = 'self'
    ORDER BY ag.created_at
    LIMIT 1;

    IF v_athlete_id IS NULL THEN
      INSERT INTO public.athletes (first_name, surname, sport, phone, date_of_birth, photo_path, created_by, self_registered)
      VALUES (
        left(first_name, 120), left(surname, 120), left(nullif(m->>'sport', ''), 120),
        left(nullif(m->>'phone', ''), 40), dob, av, new.id, true
      )
      RETURNING id INTO v_athlete_id;
    END IF;

    INSERT INTO public.athlete_guardians (user_id, athlete_id, relationship)
    VALUES (new.id, v_athlete_id, 'self')
    ON CONFLICT (user_id, athlete_id) DO NOTHING;

    INSERT INTO public.community_profiles (user_id)
    VALUES (new.id)
    ON CONFLICT (user_id) DO NOTHING;
  ELSIF r = 'school_admin' AND nullif(btrim(m->>'org_name'), '') IS NOT NULL THEN
    org_type := CASE WHEN m->>'org_type' IN ('school', 'academy', 'club') THEN m->>'org_type' ELSE 'school' END;
    INSERT INTO public.schools (name, school_type, location, contact_phone, intake_notes, logo_path, created_by, self_registered)
    VALUES (
      left(btrim(m->>'org_name'), 160), org_type, left(nullif(m->>'org_location', ''), 160),
      left(nullif(m->>'phone', ''), 40), left(nullif(m->>'org_notes', ''), 1000), av, new.id, true
    )
    RETURNING id INTO org_id;
    INSERT INTO public.school_users (user_id, school_id)
    VALUES (new.id, org_id)
    ON CONFLICT (user_id, school_id) DO NOTHING;
  END IF;

  RETURN new;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
