CREATE TABLE public.care_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'appointment',
  message text NOT NULL,
  preferred_date date,
  status text NOT NULL DEFAULT 'pending',
  response text,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  handled_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.care_requests TO authenticated;
GRANT ALL ON public.care_requests TO service_role;
ALTER TABLE public.care_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Linked users read own requests" ON public.care_requests FOR SELECT TO authenticated
  USING (public.is_vito_staff(auth.uid()) OR EXISTS (SELECT 1 FROM public.athlete_guardians g WHERE g.athlete_id = care_requests.athlete_id AND g.user_id = auth.uid()));
CREATE POLICY "Linked users create requests" ON public.care_requests FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid() AND status = 'pending' AND EXISTS (SELECT 1 FROM public.athlete_guardians g WHERE g.athlete_id = care_requests.athlete_id AND g.user_id = auth.uid()));
CREATE POLICY "Staff respond to requests" ON public.care_requests FOR UPDATE TO authenticated
  USING (public.is_vito_staff(auth.uid())) WITH CHECK (public.is_vito_staff(auth.uid()));
CREATE TRIGGER care_requests_updated BEFORE UPDATE ON public.care_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();