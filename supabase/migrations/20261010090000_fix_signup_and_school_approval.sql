-- Repair signup provisioning so Supabase can create the auth user even when a
-- previous profile/role linkage was partially written, and keep school selection
-- pending until a VITO administrator approves it.

DROP POLICY IF EXISTS "Users request to join" ON public.org_join_requests;
CREATE POLICY "Users request to join" ON public.org_join_requests
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND status = 'pending'
  AND role IN ('school_admin', 'coach', 'athlete')
);

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
  athlete_id uuid;
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

    SELECT ag.athlete_id INTO athlete_id
    FROM public.athlete_guardians ag
    WHERE ag.user_id = new.id AND ag.relationship = 'self'
    ORDER BY ag.created_at
    LIMIT 1;

    IF athlete_id IS NULL THEN
      INSERT INTO public.athletes (first_name, surname, sport, phone, date_of_birth, photo_path, created_by, self_registered)
      VALUES (
        left(first_name, 120), left(surname, 120), left(nullif(m->>'sport', ''), 120),
        left(nullif(m->>'phone', ''), 40), dob, av, new.id, true
      )
      RETURNING id INTO athlete_id;
    END IF;

    INSERT INTO public.athlete_guardians (user_id, athlete_id, relationship)
    VALUES (new.id, athlete_id, 'self')
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

CREATE OR REPLACE FUNCTION public.org_join_from_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  sid uuid;
  rr text;
BEGIN
  BEGIN
    sid := nullif(new.raw_user_meta_data->>'join_school_id', '')::uuid;
  EXCEPTION WHEN others THEN
    sid := NULL;
  END;

  IF sid IS NULL AND new.raw_user_meta_data->>'requested_role' = 'athlete' THEN
    BEGIN
      sid := nullif(new.raw_user_meta_data->>'school_id', '')::uuid;
    EXCEPTION WHEN others THEN
      sid := NULL;
    END;
  END IF;

  rr := CASE
    WHEN new.raw_user_meta_data->>'requested_role' = 'coach' THEN 'coach'
    WHEN new.raw_user_meta_data->>'requested_role' = 'athlete' THEN 'athlete'
    ELSE 'school_admin'
  END;

  IF sid IS NOT NULL AND EXISTS (SELECT 1 FROM public.schools WHERE id = sid) THEN
    INSERT INTO public.org_join_requests (user_id, school_id, role)
    VALUES (new.id, sid, rr)
    ON CONFLICT (user_id, school_id) DO NOTHING;
  END IF;
  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.org_join_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF new.status = 'approved' AND old.status <> 'approved' THEN
    IF new.role = 'athlete' THEN
      UPDATE public.athletes a
      SET school_id = new.school_id, updated_at = now()
      FROM public.athlete_guardians g
      WHERE g.user_id = new.user_id
        AND g.athlete_id = a.id
        AND g.relationship = 'self';
    ELSE
      INSERT INTO public.school_users (user_id, school_id)
      VALUES (new.user_id, new.school_id)
      ON CONFLICT (user_id, school_id) DO NOTHING;
    END IF;
  END IF;
  RETURN new;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.org_join_from_signup() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.org_join_approved() FROM PUBLIC, anon, authenticated;
