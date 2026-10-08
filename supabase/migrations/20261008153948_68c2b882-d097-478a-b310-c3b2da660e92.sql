CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  req text; r public.app_role; av text; full_name text; first_name text; surname text;
  athlete_id uuid; org_id uuid; org_type text; dob date;
BEGIN
  req := m->>'requested_role';
  av := m->>'avatar_path';
  IF av IS NOT NULL AND av !~ '^uploads/[0-9a-f-]{36}\.(png|jpg|webp)$' THEN av := NULL; END IF;

  INSERT INTO public.profiles (id, full_name, email, requested_role, avatar_path)
  VALUES (new.id, m->>'full_name', new.email, left(req, 40), av);

  IF lower(new.email) = 'vitophysio256@gmail.com' THEN r := 'super_admin';
  ELSIF req IN ('school_admin','coach','athlete','parent') THEN r := req::public.app_role;
  ELSE r := 'athlete'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (new.id, r);

  IF r = 'athlete' THEN
    full_name := btrim(coalesce(m->>'full_name', 'Athlete'));
    first_name := coalesce(nullif(btrim(m->>'first_name'), ''), split_part(full_name, ' ', 1));
    surname := coalesce(nullif(btrim(m->>'surname'), ''), btrim(substr(full_name, length(split_part(full_name, ' ', 1)) + 1)));
    IF first_name = '' THEN first_name := 'Athlete'; END IF;
    IF surname = '' THEN surname := first_name; END IF;
    BEGIN dob := nullif(m->>'date_of_birth', '')::date; EXCEPTION WHEN others THEN dob := NULL; END;
    INSERT INTO public.athletes (first_name, surname, sport, phone, date_of_birth, photo_path, created_by, self_registered)
    VALUES (left(first_name,120), left(surname,120), left(nullif(m->>'sport',''),120), left(nullif(m->>'phone',''),40), dob, av, new.id, true)
    RETURNING id INTO athlete_id;
    INSERT INTO public.athlete_guardians (user_id, athlete_id, relationship) VALUES (new.id, athlete_id, 'self') ON CONFLICT (user_id, athlete_id) DO NOTHING;
    INSERT INTO public.community_profiles (user_id) VALUES (new.id) ON CONFLICT (user_id) DO NOTHING;
  ELSIF r = 'school_admin' AND nullif(btrim(m->>'org_name'), '') IS NOT NULL THEN
    org_type := CASE WHEN m->>'org_type' IN ('school','academy','club') THEN m->>'org_type' ELSE 'school' END;
    INSERT INTO public.schools (name, school_type, location, contact_phone, intake_notes, logo_path, created_by, self_registered)
    VALUES (left(btrim(m->>'org_name'),160), org_type, left(nullif(m->>'org_location',''),160), left(nullif(m->>'phone',''),40), left(nullif(m->>'org_notes',''),1000), av, new.id, true)
    RETURNING id INTO org_id;
    INSERT INTO public.school_users (user_id, school_id) VALUES (new.id, org_id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN new;
END;
$function$;

DO $$
DECLARE u record; aid uuid; fn text;
BEGIN
  FOR u IN SELECT p.id, coalesce(p.full_name,'Athlete') AS full_name, p.avatar_path FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'athlete'
    WHERE NOT EXISTS (SELECT 1 FROM public.athlete_guardians g WHERE g.user_id = p.id)
  LOOP
    fn := split_part(btrim(u.full_name),' ',1);
    INSERT INTO public.athletes (first_name, surname, photo_path, created_by, self_registered)
    VALUES (coalesce(nullif(fn,''),'Athlete'), coalesce(nullif(btrim(substr(btrim(u.full_name), length(fn)+1)),''), coalesce(nullif(fn,''),'Athlete')), u.avatar_path, u.id, true)
    RETURNING id INTO aid;
    INSERT INTO public.athlete_guardians (user_id, athlete_id, relationship) VALUES (u.id, aid, 'self');
  END LOOP;
END $$;