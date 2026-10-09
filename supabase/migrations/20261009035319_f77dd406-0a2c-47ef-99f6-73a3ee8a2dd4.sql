CREATE TABLE public.org_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'school_admin',
  status text NOT NULL DEFAULT 'pending',
  handled_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, school_id)
);
GRANT SELECT, INSERT, UPDATE ON public.org_join_requests TO authenticated;
GRANT ALL ON public.org_join_requests TO service_role;
ALTER TABLE public.org_join_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own or staff read join requests" ON public.org_join_requests FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_vito_staff(auth.uid()));
CREATE POLICY "Users request to join" ON public.org_join_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'pending' AND role IN ('school_admin','coach'));
CREATE POLICY "Staff handle join requests" ON public.org_join_requests FOR UPDATE TO authenticated USING (public.is_vito_staff(auth.uid())) WITH CHECK (public.is_vito_staff(auth.uid()));
CREATE TRIGGER org_join_requests_updated BEFORE UPDATE ON public.org_join_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.org_join_from_signup() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE sid uuid; rr text;
BEGIN
  BEGIN sid := nullif(new.raw_user_meta_data->>'join_school_id','')::uuid; EXCEPTION WHEN others THEN sid := NULL; END;
  rr := CASE WHEN new.raw_user_meta_data->>'requested_role' = 'coach' THEN 'coach' ELSE 'school_admin' END;
  IF sid IS NOT NULL AND EXISTS (SELECT 1 FROM public.schools WHERE id = sid) THEN
    INSERT INTO public.org_join_requests (user_id, school_id, role) VALUES (new.id, sid, rr) ON CONFLICT DO NOTHING;
  END IF;
  RETURN new;
END $$;
REVOKE EXECUTE ON FUNCTION public.org_join_from_signup() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_auth_user_created_zjoin AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.org_join_from_signup();

CREATE OR REPLACE FUNCTION public.org_join_approved() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF new.status = 'approved' AND old.status <> 'approved' THEN
    INSERT INTO public.school_users (user_id, school_id) VALUES (new.user_id, new.school_id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN new;
END $$;
REVOKE EXECUTE ON FUNCTION public.org_join_approved() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER org_join_requests_approved AFTER UPDATE ON public.org_join_requests FOR EACH ROW EXECUTE FUNCTION public.org_join_approved();