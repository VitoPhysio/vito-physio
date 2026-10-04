ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS requested_role text;
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ DECLARE req text; r public.app_role; BEGIN
req := new.raw_user_meta_data->>'requested_role';
INSERT INTO public.profiles (id, full_name, email, requested_role) VALUES (new.id, new.raw_user_meta_data->>'full_name', new.email, left(req, 40));
IF lower(new.email) = 'vitophysio256@gmail.com' THEN r := 'super_admin';
ELSIF req IN ('school_admin','coach','athlete','parent') THEN r := req::public.app_role;
ELSE r := 'athlete'; END IF;
INSERT INTO public.user_roles (user_id, role) VALUES (new.id, r); RETURN new; END; $function$;