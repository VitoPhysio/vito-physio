CREATE SEQUENCE IF NOT EXISTS public.profile_account_code_seq START WITH 1;
GRANT USAGE, SELECT ON SEQUENCE public.profile_account_code_seq TO service_role;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_code text;

UPDATE public.profiles
SET account_code = 'VITO-ACC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
WHERE account_code IS NULL;

ALTER TABLE public.profiles ALTER COLUMN account_code SET NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN account_code SET DEFAULT ('VITO-ACC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)));
CREATE UNIQUE INDEX IF NOT EXISTS profiles_account_code_key ON public.profiles (account_code);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE req text; r public.app_role; av text;
BEGIN
  req := new.raw_user_meta_data->>'requested_role';
  av := new.raw_user_meta_data->>'avatar_path';
  IF av IS NOT NULL AND av !~ '^uploads/[0-9a-f-]{36}\.(png|jpg|webp)$' THEN av := NULL; END IF;
  INSERT INTO public.profiles (id, full_name, email, requested_role, avatar_path)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.email, left(req, 40), av);
  IF lower(new.email) = 'vitophysio256@gmail.com' THEN r := 'super_admin';
  ELSIF req IN ('school_admin','coach','athlete','parent') THEN r := req::public.app_role;
  ELSE r := 'athlete'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (new.id, r);
  RETURN new;
END;
$function$;