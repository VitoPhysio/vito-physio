-- Automatically create a clinical athlete record for new athlete accounts.
-- The athlete_guardians link makes the record available in the athlete portal,
-- while the existing staff policy makes it visible in the clinician workspace.
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
  END IF;

  RETURN new;
END;
$function$;
