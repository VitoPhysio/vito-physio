alter table public.profiles add column if not exists avatar_path text;
alter table public.athletes add column if not exists photo_path text;
alter table public.schools add column if not exists logo_path text;

create policy "Signed-in users can view avatars" on storage.objects for select to authenticated using (bucket_id = 'avatars');

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ DECLARE req text; r public.app_role; av text; BEGIN
req := new.raw_user_meta_data->>'requested_role';
av := new.raw_user_meta_data->>'avatar_path';
IF av IS NOT NULL AND av !~ '^uploads/[0-9a-f-]{36}\.(png|jpg|webp)$' THEN av := NULL; END IF;
INSERT INTO public.profiles (id, full_name, email, requested_role, avatar_path) VALUES (new.id, new.raw_user_meta_data->>'full_name', new.email, left(req, 40), av);
IF lower(new.email) = 'vitophysio256@gmail.com' THEN r := 'super_admin';
ELSIF req IN ('school_admin','coach','athlete','parent') THEN r := req::public.app_role;
ELSE r := 'athlete'; END IF;
INSERT INTO public.user_roles (user_id, role) VALUES (new.id, r); RETURN new; END; $function$;