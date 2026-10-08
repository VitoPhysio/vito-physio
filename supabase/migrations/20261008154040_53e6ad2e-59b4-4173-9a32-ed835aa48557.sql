CREATE OR REPLACE FUNCTION public.attach_athlete_school() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE sid uuid;
BEGIN
  BEGIN sid := nullif(new.raw_user_meta_data->>'school_id','')::uuid; EXCEPTION WHEN others THEN sid := NULL; END;
  IF sid IS NOT NULL AND EXISTS (SELECT 1 FROM public.schools WHERE id = sid) THEN
    UPDATE public.athletes a SET school_id = sid FROM public.athlete_guardians g
    WHERE g.athlete_id = a.id AND g.user_id = new.id AND g.relationship = 'self' AND a.school_id IS NULL;
  END IF;
  RETURN new;
END $$;
REVOKE EXECUTE ON FUNCTION public.attach_athlete_school() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_auth_user_created_school AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.attach_athlete_school();