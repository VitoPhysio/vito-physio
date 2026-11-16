CREATE OR REPLACE FUNCTION public.sync_institution_admin_identity(_user uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.schools;
BEGIN
 SELECT sc.* INTO s FROM public.school_users su JOIN public.schools sc ON sc.id=su.school_id WHERE su.user_id=_user AND su.role='school_admin' AND su.status='active' ORDER BY su.created_at,su.id LIMIT 1;
 IF s.id IS NULL THEN RETURN; END IF;
 INSERT INTO public.user_roles(user_id,role) VALUES(_user,'school_admin') ON CONFLICT(user_id,role) DO NOTHING;
 UPDATE public.profiles SET full_name=s.name,avatar_path=s.logo_path,updated_at=now() WHERE id=_user;
 INSERT INTO public.community_profiles(user_id,school_id,school_name) VALUES(_user,s.id,s.name) ON CONFLICT(user_id) DO UPDATE SET school_id=excluded.school_id,school_name=excluded.school_name,updated_at=now();
END $$;
REVOKE ALL ON FUNCTION public.sync_institution_admin_identity(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.sync_institution_membership_identity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN PERFORM public.sync_institution_admin_identity(new.user_id); RETURN new; END $$;
CREATE TRIGGER institution_membership_identity AFTER INSERT OR UPDATE OF role,status ON public.school_users FOR EACH ROW EXECUTE FUNCTION public.sync_institution_membership_identity();

CREATE OR REPLACE FUNCTION public.sync_institution_logo_identity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE u record; BEGIN FOR u IN SELECT user_id FROM public.school_users WHERE school_id=new.id AND role='school_admin' AND status='active' LOOP PERFORM public.sync_institution_admin_identity(u.user_id); END LOOP; RETURN new; END $$;
CREATE TRIGGER institution_logo_identity AFTER UPDATE OF name,logo_path ON public.schools FOR EACH ROW EXECUTE FUNCTION public.sync_institution_logo_identity();

CREATE OR REPLACE FUNCTION public.enforce_institution_profile_identity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE s public.schools; BEGIN
 SELECT sc.* INTO s FROM public.school_users su JOIN public.schools sc ON sc.id=su.school_id WHERE su.user_id=new.id AND su.role='school_admin' AND su.status='active' ORDER BY su.created_at,su.id LIMIT 1;
 IF s.id IS NOT NULL THEN new.full_name:=s.name; new.avatar_path:=s.logo_path; END IF;
 RETURN new;
END $$;
CREATE TRIGGER institution_profile_identity BEFORE UPDATE OF full_name,avatar_path ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.enforce_institution_profile_identity();

CREATE OR REPLACE FUNCTION public.finalize_institution_signup_identity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE sid uuid; s public.schools; BEGIN
 IF new.raw_user_meta_data->>'requested_role' <> 'school_admin' THEN RETURN new; END IF;
 BEGIN sid:=nullif(new.raw_user_meta_data->>'join_school_id','')::uuid; EXCEPTION WHEN others THEN sid:=NULL; END;
 IF sid IS NOT NULL THEN
  SELECT * INTO s FROM public.schools WHERE id=sid;
  IF s.id IS NOT NULL THEN
   UPDATE public.profiles SET full_name=s.name,avatar_path=s.logo_path WHERE id=new.id;
   INSERT INTO public.community_profiles(user_id,school_id,school_name) VALUES(new.id,s.id,s.name) ON CONFLICT(user_id) DO UPDATE SET school_id=excluded.school_id,school_name=excluded.school_name;
  END IF;
 ELSE
  UPDATE public.schools SET contact_email=new.email WHERE created_by=new.id AND self_registered AND contact_email IS NULL;
  PERFORM public.sync_institution_admin_identity(new.id);
 END IF;
 RETURN new;
END $$;
CREATE TRIGGER on_auth_user_created_zzinstitution AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.finalize_institution_signup_identity();

UPDATE public.school_users SET role='school_admin' WHERE user_id='6ec35b87-a26a-4d60-b731-d80643fa1858' AND school_id='e4b27c39-c4fb-4a2d-a0ed-170c556a4473' AND role='coach' AND status='active';
DO $$ DECLARE u record; BEGIN FOR u IN SELECT DISTINCT user_id FROM public.school_users WHERE role='school_admin' AND status='active' LOOP PERFORM public.sync_institution_admin_identity(u.user_id); END LOOP; END $$;
REVOKE ALL ON FUNCTION public.sync_institution_membership_identity(),public.sync_institution_logo_identity(),public.enforce_institution_profile_identity(),public.finalize_institution_signup_identity() FROM PUBLIC,anon,authenticated;