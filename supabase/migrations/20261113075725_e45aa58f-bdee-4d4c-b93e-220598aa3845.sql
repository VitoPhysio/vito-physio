-- ===== Teams =====
CREATE TABLE public.institution_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'team' CHECK (kind IN ('team','class')),
  sport text,
  coach_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX institution_teams_name_uniq ON public.institution_teams (school_id, lower(btrim(name)));
CREATE INDEX institution_teams_coach_idx ON public.institution_teams (coach_id);
CREATE TABLE public.institution_team_athletes (
  team_id uuid NOT NULL REFERENCES public.institution_teams(id) ON DELETE CASCADE,
  athlete_id uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, athlete_id)
);
CREATE INDEX institution_team_athletes_athlete_idx ON public.institution_team_athletes (athlete_id);
GRANT SELECT ON public.institution_teams, public.institution_team_athletes TO authenticated;
GRANT ALL ON public.institution_teams, public.institution_team_athletes TO service_role;
ALTER TABLE public.institution_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_team_athletes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read teams" ON public.institution_teams FOR SELECT TO authenticated
  USING (public.is_institution_member(auth.uid(), school_id) OR public.is_vito_staff(auth.uid()));
CREATE POLICY "members read team athletes" ON public.institution_team_athletes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.institution_teams t WHERE t.id = team_id
    AND (public.is_institution_member(auth.uid(), t.school_id) OR public.is_vito_staff(auth.uid()))));
CREATE TRIGGER institution_teams_updated_at BEFORE UPDATE ON public.institution_teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== Audit trail =====
CREATE TABLE public.sensitive_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  athlete_id uuid REFERENCES public.athletes(id) ON DELETE SET NULL,
  referral_id uuid REFERENCES public.referrals(id) ON DELETE SET NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sensitive_access_log_school_idx ON public.sensitive_access_log (school_id, created_at DESC);
GRANT SELECT ON public.sensitive_access_log TO authenticated;
GRANT ALL ON public.sensitive_access_log TO service_role;
ALTER TABLE public.sensitive_access_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff and institution admins read audit" ON public.sensitive_access_log FOR SELECT TO authenticated
  USING (public.is_vito_staff(auth.uid()) OR (school_id IS NOT NULL AND public.is_institution_admin(auth.uid(), school_id)));

CREATE OR REPLACE FUNCTION public.log_sensitive_access(_actor uuid, _action text, _school uuid, _athlete uuid, _referral uuid, _detail jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.sensitive_access_log(actor_id, action, school_id, athlete_id, referral_id, detail)
  VALUES (_actor, _action, _school, _athlete, _referral, coalesce(_detail, '{}'::jsonb));
$$;

-- ===== Pattern reviews =====
CREATE TABLE public.institution_pattern_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  pattern_key text NOT NULL,
  note text NOT NULL,
  status text NOT NULL DEFAULT 'noted' CHECK (status IN ('noted','action_planned','resolved')),
  reviewed_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX institution_pattern_reviews_school_idx ON public.institution_pattern_reviews (school_id, created_at DESC);
GRANT SELECT ON public.institution_pattern_reviews TO authenticated;
GRANT ALL ON public.institution_pattern_reviews TO service_role;
ALTER TABLE public.institution_pattern_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read pattern reviews" ON public.institution_pattern_reviews FOR SELECT TO authenticated
  USING (public.is_institution_member(auth.uid(), school_id) OR public.is_vito_staff(auth.uid()));

-- ===== Column additions =====
ALTER TABLE public.communications
  ADD COLUMN IF NOT EXISTS batch_id uuid,
  ADD COLUMN IF NOT EXISTS kind text,
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.institution_teams(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS communications_school_batch_idx ON public.communications (school_id, batch_id);

ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS professional_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS purpose text,
  ADD COLUMN IF NOT EXISTS shared_scopes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS consent_status text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS consent_by uuid,
  ADD COLUMN IF NOT EXISTS consent_name text,
  ADD COLUMN IF NOT EXISTS consent_method text,
  ADD COLUMN IF NOT EXISTS consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS requested_by uuid,
  ADD COLUMN IF NOT EXISTS feedback text,
  ADD COLUMN IF NOT EXISTS feedback_at timestamptz,
  ADD COLUMN IF NOT EXISTS priority text;
CREATE INDEX IF NOT EXISTS referrals_school_idx ON public.referrals (school_id);
CREATE INDEX IF NOT EXISTS referrals_professional_idx ON public.referrals (professional_id);

-- ===== Scope helpers =====
CREATE OR REPLACE FUNCTION public.institution_can_see_athlete(_user uuid, _school uuid, _athlete uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.athletes a WHERE a.id = _athlete AND a.school_id = _school)
    AND (public.is_vito_staff(_user) OR public.is_institution_admin(_user, _school)
      OR (public.institution_role(_user, _school) = 'coach' AND EXISTS (
        SELECT 1 FROM public.institution_team_athletes ta JOIN public.institution_teams t ON t.id = ta.team_id
        WHERE ta.athlete_id = _athlete AND t.school_id = _school AND t.coach_id = _user)))
$$;

-- Institution access now respects role scope and active status
CREATE OR REPLACE FUNCTION public.can_view_athlete(_user uuid, _athlete uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_vito_staff(_user)
    OR EXISTS (SELECT 1 FROM public.athlete_guardians WHERE user_id = _user AND athlete_id = _athlete)
    OR EXISTS (SELECT 1 FROM public.athletes a WHERE a.id = _athlete AND a.school_id IS NOT NULL
               AND public.institution_can_see_athlete(_user, a.school_id, _athlete))
$$;

CREATE OR REPLACE FUNCTION public.can_read_communication(_user uuid, _c public.communications)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _c.sender_id = _user OR _c.recipient_id = _user
    OR (_c.athlete_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.athlete_guardians WHERE user_id = _user AND athlete_id = _c.athlete_id))
    OR (_c.school_id IS NOT NULL AND public.is_institution_member(_user, _c.school_id)
        AND (_c.athlete_id IS NULL OR public.institution_can_see_athlete(_user, _c.school_id, _c.athlete_id)))
    OR _c.audience = 'everyone'
    OR (_c.audience = 'clinicians' AND public.is_vito_staff(_user))
    OR (_c.audience = 'schools' AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user AND role IN ('school_admin','coach')))
    OR (_c.audience = 'athletes' AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user AND role IN ('athlete','parent')))
    OR public.has_role(_user, 'super_admin')
$$;

-- ===== Phase 2: athletes & teams =====
CREATE OR REPLACE FUNCTION public.institution_athletes(_school uuid)
RETURNS TABLE(id uuid, athlete_code text, first_name text, surname text, photo_path text, date_of_birth date, gender text,
  sport text, competition_level text, phone text, created_at timestamptz, has_account boolean, team_ids uuid[], teams text[],
  coaches text[], active_injuries int, total_injuries int, rehab_phase text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE uid uuid := auth.uid(); adm boolean;
BEGIN
  IF NOT (public.is_institution_member(uid, _school) OR public.is_vito_staff(uid)) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  adm := public.is_institution_admin(uid, _school) OR public.is_vito_staff(uid);
  RETURN QUERY
  SELECT a.id, a.athlete_code, a.first_name, a.surname, a.photo_path, a.date_of_birth, a.gender, a.sport, a.competition_level,
    CASE WHEN adm THEN a.phone END, a.created_at,
    EXISTS (SELECT 1 FROM public.athlete_guardians g WHERE g.athlete_id = a.id AND g.relationship = 'self'),
    coalesce(tm.ids, '{}'::uuid[]), coalesce(tm.names, '{}'::text[]), coalesce(tm.coaches, '{}'::text[]),
    coalesce(inj.active, 0), coalesce(inj.total, 0),
    (SELECT rp.phase FROM public.rehabilitation_plans rp JOIN public.injuries i ON i.id = rp.injury_id
      WHERE rp.athlete_id = a.id AND coalesce(i.status, '') NOT IN ('closed','resolved','recovered')
      ORDER BY rp.created_at DESC LIMIT 1)
  FROM public.athletes a
  LEFT JOIN LATERAL (
    SELECT array_agg(t.id ORDER BY t.name) ids, array_agg(t.name ORDER BY t.name) names,
      array_remove(array_agg(DISTINCT p.full_name), NULL) coaches
    FROM public.institution_team_athletes ta JOIN public.institution_teams t ON t.id = ta.team_id
    LEFT JOIN public.profiles p ON p.id = t.coach_id
    WHERE ta.athlete_id = a.id AND t.school_id = _school) tm ON true
  LEFT JOIN LATERAL (
    SELECT count(*) FILTER (WHERE coalesce(i.status, '') NOT IN ('closed','resolved','recovered'))::int active, count(*)::int total
    FROM public.injuries i WHERE i.athlete_id = a.id) inj ON true
  WHERE a.school_id = _school AND public.institution_can_see_athlete(uid, _school, a.id)
  ORDER BY a.surname, a.first_name;
END $$;

CREATE OR REPLACE FUNCTION public.institution_athlete_profile(_school uuid, _athlete uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); adm boolean; result jsonb;
BEGIN
  IF NOT public.institution_can_see_athlete(uid, _school, _athlete) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  adm := public.is_institution_admin(uid, _school) OR public.is_vito_staff(uid);
  SELECT jsonb_build_object(
    'athlete', (SELECT jsonb_build_object('id', a.id, 'athlete_code', a.athlete_code, 'first_name', a.first_name, 'surname', a.surname,
        'photo_path', a.photo_path, 'date_of_birth', a.date_of_birth, 'gender', a.gender, 'sport', a.sport,
        'competition_level', a.competition_level, 'phone', CASE WHEN adm THEN a.phone END, 'created_at', a.created_at,
        'has_account', EXISTS (SELECT 1 FROM public.athlete_guardians g WHERE g.athlete_id = a.id AND g.relationship = 'self'))
      FROM public.athletes a WHERE a.id = _athlete),
    'teams', coalesce((SELECT jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'kind', t.kind, 'coach', p.full_name) ORDER BY t.name)
      FROM public.institution_team_athletes ta JOIN public.institution_teams t ON t.id = ta.team_id LEFT JOIN public.profiles p ON p.id = t.coach_id
      WHERE ta.athlete_id = _athlete AND t.school_id = _school), '[]'::jsonb),
    'injuries', coalesce((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'injury_code', i.injury_code, 'body_region', i.body_region,
        'injury_type', i.injury_type, 'severity', i.severity, 'status', i.status, 'injury_date', coalesce(i.injury_date, i.created_at::date),
        'resolved_at', i.resolved_at, 'days_lost', i.days_lost, 'activity_context', i.activity_context, 'is_recurrence', i.is_recurrence)
        ORDER BY coalesce(i.injury_date, i.created_at::date) DESC) FROM public.injuries i WHERE i.athlete_id = _athlete), '[]'::jsonb),
    'assessments', coalesce((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'date', coalesce(s.assessment_date, s.created_at::date),
        'type', s.assessment_type, 'follow_up_date', s.follow_up_date) ORDER BY s.created_at DESC)
      FROM public.assessments s WHERE s.athlete_id = _athlete), '[]'::jsonb),
    'rehabilitation', coalesce((SELECT jsonb_agg(jsonb_build_object('id', r.id, 'injury_id', r.injury_id, 'phase', r.phase,
        'start_date', r.start_date, 'target_return_date', r.target_return_date) ORDER BY r.created_at DESC)
      FROM public.rehabilitation_plans r WHERE r.athlete_id = _athlete), '[]'::jsonb),
    'exercises', coalesce((SELECT jsonb_agg(jsonb_build_object('name', e.name, 'sets', e.sets, 'reps', e.reps, 'frequency', e.frequency) ORDER BY e.created_at DESC)
      FROM public.exercises e WHERE e.athlete_id = _athlete), '[]'::jsonb),
    'follow_ups', coalesce((SELECT jsonb_agg(jsonb_build_object('review_date', f.review_date, 'pain_score', f.pain_score) ORDER BY f.review_date DESC)
      FROM public.follow_ups f WHERE f.athlete_id = _athlete), '[]'::jsonb),
    'recovery_updates', coalesce((SELECT jsonb_agg(jsonb_build_object('status', u.status, 'created_at', u.created_at) ORDER BY u.created_at DESC)
      FROM public.recovery_updates u WHERE u.athlete_id = _athlete), '[]'::jsonb),
    'appointments', coalesce((SELECT jsonb_agg(jsonb_build_object('scheduled_at', ap.scheduled_at, 'purpose', ap.purpose, 'status', ap.status, 'location', ap.location) ORDER BY ap.scheduled_at DESC)
      FROM public.appointments ap WHERE ap.athlete_id = _athlete), '[]'::jsonb),
    'referrals', coalesce((SELECT jsonb_agg(jsonb_build_object('id', rf.id, 'referral_code', rf.referral_code, 'referred_to', rf.referred_to,
        'status', rf.status, 'consent_status', rf.consent_status, 'created_at', rf.created_at) ORDER BY rf.created_at DESC)
      FROM public.referrals rf WHERE rf.athlete_id = _athlete AND rf.school_id = _school), '[]'::jsonb),
    'communications', coalesce((SELECT jsonb_agg(x ORDER BY x->>'created_at' DESC) FROM (
        SELECT jsonb_build_object('subject', c.subject, 'kind', c.kind, 'body', left(c.body, 200), 'created_at', c.created_at) x
        FROM public.communications c WHERE c.athlete_id = _athlete AND c.school_id = _school ORDER BY c.created_at DESC LIMIT 20) q), '[]'::jsonb)
  ) INTO result;
  PERFORM public.log_sensitive_access(uid, 'view_athlete_profile', _school, _athlete, NULL, '{}'::jsonb);
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.institution_register_athletes(_school uuid, _rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); r jsonb; fn text; sn text; dob date; g text; tid uuid; new_id uuid; created int := 0; skipped int := 0; problems jsonb := '[]'::jsonb; idx int := 0;
BEGIN
  IF NOT (public.is_institution_admin(uid, _school) OR public.is_vito_staff(uid)) THEN RAISE EXCEPTION 'Only institution administrators can register athletes'; END IF;
  IF jsonb_typeof(_rows) <> 'array' OR jsonb_array_length(_rows) = 0 THEN RAISE EXCEPTION 'No athletes to register'; END IF;
  IF jsonb_array_length(_rows) > 500 THEN RAISE EXCEPTION 'Register at most 500 athletes at a time'; END IF;
  FOR r IN SELECT * FROM jsonb_array_elements(_rows) LOOP
    idx := idx + 1;
    fn := left(btrim(coalesce(r->>'first_name', '')), 80);
    sn := left(btrim(coalesce(r->>'surname', '')), 80);
    IF fn = '' OR sn = '' THEN skipped := skipped + 1; problems := problems || jsonb_build_object('row', idx, 'reason', 'First name and surname are required'); CONTINUE; END IF;
    BEGIN dob := nullif(btrim(coalesce(r->>'date_of_birth', '')), '')::date; EXCEPTION WHEN others THEN dob := NULL; END;
    IF dob IS NOT NULL AND (dob > current_date OR dob < date '1900-01-01') THEN dob := NULL; END IF;
    g := lower(nullif(btrim(coalesce(r->>'gender', '')), ''));
    IF g IS NOT NULL AND g NOT IN ('male','female') THEN g := NULL; END IF;
    IF EXISTS (SELECT 1 FROM public.athletes a WHERE a.school_id = _school AND lower(a.first_name) = lower(fn) AND lower(a.surname) = lower(sn)
               AND a.date_of_birth IS NOT DISTINCT FROM dob) THEN
      skipped := skipped + 1; problems := problems || jsonb_build_object('row', idx, 'reason', 'Already registered: ' || fn || ' ' || sn); CONTINUE;
    END IF;
    INSERT INTO public.athletes(first_name, surname, sport, date_of_birth, gender, phone, competition_level, school_id, created_by)
    VALUES (fn, sn, nullif(left(btrim(coalesce(r->>'sport', '')), 60), ''), dob, g, nullif(left(btrim(coalesce(r->>'phone', '')), 30), ''),
            nullif(left(btrim(coalesce(r->>'competition_level', '')), 60), ''), _school, uid)
    RETURNING id INTO new_id;
    BEGIN tid := nullif(r->>'team_id', '')::uuid; EXCEPTION WHEN others THEN tid := NULL; END;
    IF tid IS NOT NULL AND EXISTS (SELECT 1 FROM public.institution_teams WHERE id = tid AND school_id = _school) THEN
      INSERT INTO public.institution_team_athletes(team_id, athlete_id, added_by) VALUES (tid, new_id, uid) ON CONFLICT DO NOTHING;
    END IF;
    created := created + 1;
  END LOOP;
  PERFORM public.log_sensitive_access(uid, 'register_athletes', _school, NULL, NULL, jsonb_build_object('created', created, 'skipped', skipped));
  RETURN jsonb_build_object('created', created, 'skipped', skipped, 'problems', problems);
END $$;

CREATE OR REPLACE FUNCTION public.institution_update_athlete(_school uuid, _athlete uuid, _sport text, _gender text, _competition_level text, _phone text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT ((public.is_institution_admin(auth.uid(), _school) OR public.is_vito_staff(auth.uid()))
          AND EXISTS (SELECT 1 FROM public.athletes WHERE id = _athlete AND school_id = _school)) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  UPDATE public.athletes SET sport = nullif(left(btrim(coalesce(_sport, '')), 60), ''),
    gender = CASE WHEN lower(_gender) IN ('male','female') THEN lower(_gender) ELSE NULL END,
    competition_level = nullif(left(btrim(coalesce(_competition_level, '')), 60), ''),
    phone = nullif(left(btrim(coalesce(_phone, '')), 30), ''), updated_at = now()
  WHERE id = _athlete;
END $$;

CREATE OR REPLACE FUNCTION public.institution_teams_list(_school uuid)
RETURNS TABLE(id uuid, name text, kind text, sport text, coach_id uuid, coach_name text, athlete_ids uuid[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE uid uuid := auth.uid(); adm boolean;
BEGIN
  IF NOT (public.is_institution_member(uid, _school) OR public.is_vito_staff(uid)) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  adm := public.is_institution_admin(uid, _school) OR public.is_vito_staff(uid);
  RETURN QUERY
  SELECT t.id, t.name, t.kind, t.sport, t.coach_id, p.full_name,
    coalesce((SELECT array_agg(ta.athlete_id) FROM public.institution_team_athletes ta WHERE ta.team_id = t.id), '{}'::uuid[])
  FROM public.institution_teams t LEFT JOIN public.profiles p ON p.id = t.coach_id
  WHERE t.school_id = _school AND (adm OR t.coach_id = uid)
  ORDER BY t.name;
END $$;

CREATE OR REPLACE FUNCTION public.institution_save_team(_school uuid, _team uuid, _name text, _kind text, _sport text, _coach uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); nm text := left(btrim(coalesce(_name, '')), 80); tid uuid;
BEGIN
  IF NOT (public.is_institution_admin(uid, _school) OR public.is_vito_staff(uid)) THEN RAISE EXCEPTION 'Only institution administrators can manage teams'; END IF;
  IF nm = '' THEN RAISE EXCEPTION 'Team name is required'; END IF;
  IF _kind NOT IN ('team','class') THEN RAISE EXCEPTION 'Choose team or class'; END IF;
  IF _coach IS NOT NULL AND NOT public.is_institution_member(_coach, _school) THEN RAISE EXCEPTION 'The coach must be an active member of this institution'; END IF;
  IF EXISTS (SELECT 1 FROM public.institution_teams WHERE school_id = _school AND lower(btrim(name)) = lower(nm) AND id IS DISTINCT FROM _team) THEN
    RAISE EXCEPTION 'A team with this name already exists'; END IF;
  IF _team IS NULL THEN
    INSERT INTO public.institution_teams(school_id, name, kind, sport, coach_id, created_by)
    VALUES (_school, nm, _kind, nullif(left(btrim(coalesce(_sport, '')), 60), ''), _coach, uid) RETURNING id INTO tid;
  ELSE
    UPDATE public.institution_teams SET name = nm, kind = _kind, sport = nullif(left(btrim(coalesce(_sport, '')), 60), ''), coach_id = _coach
    WHERE id = _team AND school_id = _school RETURNING id INTO tid;
    IF tid IS NULL THEN RAISE EXCEPTION 'Team not found'; END IF;
  END IF;
  RETURN tid;
END $$;

CREATE OR REPLACE FUNCTION public.institution_delete_team(_team uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sid uuid;
BEGIN
  SELECT school_id INTO sid FROM public.institution_teams WHERE id = _team;
  IF sid IS NULL OR NOT (public.is_institution_admin(auth.uid(), sid) OR public.is_vito_staff(auth.uid())) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  DELETE FROM public.institution_teams WHERE id = _team;
END $$;

CREATE OR REPLACE FUNCTION public.institution_set_team_athletes(_team uuid, _athletes uuid[])
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sid uuid; n int;
BEGIN
  SELECT school_id INTO sid FROM public.institution_teams WHERE id = _team;
  IF sid IS NULL OR NOT (public.is_institution_admin(auth.uid(), sid) OR public.is_vito_staff(auth.uid())) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  DELETE FROM public.institution_team_athletes WHERE team_id = _team AND NOT (athlete_id = ANY (coalesce(_athletes, '{}')));
  INSERT INTO public.institution_team_athletes(team_id, athlete_id, added_by)
  SELECT _team, a.id, auth.uid() FROM public.athletes a WHERE a.id = ANY (coalesce(_athletes, '{}')) AND a.school_id = sid
  ON CONFLICT DO NOTHING;
  SELECT count(*) INTO n FROM public.institution_team_athletes WHERE team_id = _team;
  RETURN n;
END $$;

-- ===== Phase 3: injuries & surveillance =====
CREATE OR REPLACE FUNCTION public.institution_injury_records(_school uuid)
RETURNS TABLE(id uuid, injury_code text, athlete_id uuid, athlete_name text, sport text, gender text, date_of_birth date, team_ids uuid[],
  body_region text, injury_type text, severity text, mechanism_category text, activity_context text, onset_type text, is_recurrence boolean,
  injury_date date, resolved_at date, days_lost int, status text, created_at timestamptz, assessed boolean, rehab_phase text,
  target_return_date date, last_review_date date)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE uid uuid := auth.uid();
BEGIN
  IF NOT (public.is_institution_member(uid, _school) OR public.is_vito_staff(uid)) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  RETURN QUERY
  SELECT i.id, i.injury_code, a.id, a.first_name || ' ' || a.surname, coalesce(nullif(btrim(a.sport), ''), nullif(btrim(i.sport_context), '')),
    a.gender, a.date_of_birth,
    coalesce((SELECT array_agg(ta.team_id) FROM public.institution_team_athletes ta JOIN public.institution_teams t ON t.id = ta.team_id
              WHERE ta.athlete_id = a.id AND t.school_id = _school), '{}'::uuid[]),
    i.body_region, i.injury_type, i.severity, i.mechanism_category, i.activity_context, i.onset_type, i.is_recurrence,
    coalesce(i.injury_date, i.reported_at, i.created_at::date), i.resolved_at, i.days_lost, i.status, i.created_at,
    EXISTS (SELECT 1 FROM public.assessments s WHERE s.injury_id = i.id),
    rp.phase, rp.target_return_date,
    (SELECT max(f.review_date) FROM public.follow_ups f WHERE f.injury_id = i.id)
  FROM public.injuries i JOIN public.athletes a ON a.id = i.athlete_id
  LEFT JOIN LATERAL (SELECT r.phase, r.target_return_date FROM public.rehabilitation_plans r WHERE r.injury_id = i.id ORDER BY r.created_at DESC LIMIT 1) rp ON true
  WHERE a.school_id = _school AND public.institution_can_see_athlete(uid, _school, a.id)
  ORDER BY coalesce(i.injury_date, i.reported_at, i.created_at::date) DESC;
END $$;

CREATE OR REPLACE FUNCTION public.institution_report_injury(_school uuid, _athlete uuid, _body_region text, _injury_type text, _severity text,
  _injury_date date, _activity_context text, _mechanism text, _notes text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); region text := left(btrim(coalesce(_body_region, '')), 60); prev uuid; new_id uuid;
BEGIN
  IF NOT public.institution_can_see_athlete(uid, _school, _athlete) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF region = '' THEN RAISE EXCEPTION 'Body region is required'; END IF;
  IF _injury_date IS NOT NULL AND _injury_date > current_date THEN RAISE EXCEPTION 'Injury date cannot be in the future'; END IF;
  SELECT id INTO prev FROM public.injuries WHERE athlete_id = _athlete AND lower(btrim(body_region)) = lower(region)
    ORDER BY coalesce(injury_date, created_at::date) DESC LIMIT 1;
  INSERT INTO public.injuries(athlete_id, body_region, injury_type, severity, injury_date, reported_at, activity_context, mechanism, notes,
    sport_context, status, created_by, is_recurrence, previous_injury_id)
  VALUES (_athlete, region, nullif(left(btrim(coalesce(_injury_type, '')), 60), ''), nullif(_severity, ''), coalesce(_injury_date, current_date), current_date,
    nullif(_activity_context, ''), nullif(left(btrim(coalesce(_mechanism, '')), 500), ''), nullif(left(btrim(coalesce(_notes, '')), 2000), ''),
    (SELECT sport FROM public.athletes WHERE id = _athlete), 'new', uid, prev IS NOT NULL, prev)
  RETURNING id INTO new_id;
  PERFORM public.log_sensitive_access(uid, 'report_injury', _school, _athlete, NULL, jsonb_build_object('injury_id', new_id));
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.institution_pattern_reviews_list(_school uuid)
RETURNS TABLE(id uuid, pattern_key text, note text, status text, reviewer_name text, reviewer_is_professional boolean, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
BEGIN
  IF NOT (public.is_institution_member(auth.uid(), _school) OR public.is_vito_staff(auth.uid())) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  RETURN QUERY SELECT r.id, r.pattern_key, r.note, r.status, p.full_name, public.is_vito_staff(r.reviewed_by), r.created_at
  FROM public.institution_pattern_reviews r LEFT JOIN public.profiles p ON p.id = r.reviewed_by
  WHERE r.school_id = _school ORDER BY r.created_at DESC LIMIT 200;
END $$;

CREATE OR REPLACE FUNCTION public.institution_add_pattern_review(_school uuid, _pattern_key text, _note text, _status text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
  IF NOT (public.is_institution_admin(auth.uid(), _school) OR public.is_vito_staff(auth.uid())) THEN RAISE EXCEPTION 'Only administrators and VITO professionals can review patterns'; END IF;
  IF btrim(coalesce(_note, '')) = '' THEN RAISE EXCEPTION 'Write a review note'; END IF;
  INSERT INTO public.institution_pattern_reviews(school_id, pattern_key, note, status, reviewed_by)
  VALUES (_school, left(_pattern_key, 200), left(btrim(_note), 2000), coalesce(nullif(_status, ''), 'noted'), auth.uid()) RETURNING id INTO new_id;
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.institution_activity(_school uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF NOT (public.is_institution_member(uid, _school) OR public.is_vito_staff(uid)) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  RETURN jsonb_build_object(
    'appointments', coalesce((SELECT jsonb_agg(x) FROM (SELECT jsonb_build_object('id', ap.id, 'athlete_id', a.id, 'athlete_name', a.first_name || ' ' || a.surname,
        'scheduled_at', ap.scheduled_at, 'purpose', ap.purpose, 'location', ap.location) x
      FROM public.appointments ap JOIN public.athletes a ON a.id = ap.athlete_id
      WHERE a.school_id = _school AND ap.scheduled_at >= now() AND coalesce(ap.status, '') NOT IN ('cancelled','completed')
        AND public.institution_can_see_athlete(uid, _school, a.id)
      ORDER BY ap.scheduled_at LIMIT 8) q), '[]'::jsonb),
    'pending_referrals', (SELECT count(*) FROM public.referrals r WHERE r.school_id = _school AND r.status IN ('pending_consent','sent','open')
        AND public.institution_can_see_athlete(uid, _school, r.athlete_id)),
    'announcements', coalesce((SELECT jsonb_agg(x) FROM (SELECT jsonb_build_object('subject', max(c.subject), 'kind', max(c.kind), 'created_at', max(c.created_at), 'recipients', count(*)) x
      FROM public.communications c WHERE c.school_id = _school AND (public.is_institution_admin(uid, _school) OR c.sender_id = uid OR public.is_vito_staff(uid))
      GROUP BY coalesce(c.batch_id, c.id) ORDER BY max(c.created_at) DESC LIMIT 5) q), '[]'::jsonb)
  );
END $$;

-- ===== Phase 4: communications =====
CREATE OR REPLACE FUNCTION public.institution_send_message(_school uuid, _target text, _team uuid, _athlete uuid, _kind text, _subject text, _body text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); adm boolean; batch uuid := gen_random_uuid(); ids uuid[]; cat text; subj text; n_notified int := 0; g record; school_name text;
BEGIN
  IF NOT (public.is_institution_member(uid, _school) OR public.is_vito_staff(uid)) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  adm := public.is_institution_admin(uid, _school) OR public.is_vito_staff(uid);
  IF _kind NOT IN ('message','announcement','reminder','appointment','follow_up') THEN RAISE EXCEPTION 'Invalid message type'; END IF;
  IF btrim(coalesce(_body, '')) = '' THEN RAISE EXCEPTION 'Write a message'; END IF;
  IF length(_body) > 4000 THEN RAISE EXCEPTION 'Message too long (max 4000 characters)'; END IF;
  IF _target = 'all' THEN
    IF NOT adm THEN RAISE EXCEPTION 'Only administrators can message every athlete'; END IF;
    SELECT array_agg(id) INTO ids FROM public.athletes WHERE school_id = _school;
  ELSIF _target = 'team' THEN
    IF NOT EXISTS (SELECT 1 FROM public.institution_teams WHERE id = _team AND school_id = _school AND (adm OR coach_id = uid)) THEN RAISE EXCEPTION 'You cannot message this team'; END IF;
    SELECT array_agg(athlete_id) INTO ids FROM public.institution_team_athletes WHERE team_id = _team;
  ELSIF _target = 'athlete' THEN
    IF NOT public.institution_can_see_athlete(uid, _school, _athlete) THEN RAISE EXCEPTION 'You cannot message this athlete'; END IF;
    ids := ARRAY[_athlete];
  ELSE RAISE EXCEPTION 'Choose who receives the message'; END IF;
  IF ids IS NULL OR array_length(ids, 1) IS NULL THEN RAISE EXCEPTION 'No athletes match this audience'; END IF;
  subj := nullif(left(btrim(coalesce(_subject, '')), 200), '');
  INSERT INTO public.communications(sender_id, athlete_id, school_id, subject, body, batch_id, kind, team_id)
  SELECT uid, a, _school, subj, btrim(_body), batch, _kind, CASE WHEN _target = 'team' THEN _team END FROM unnest(ids) a;
  cat := CASE _kind WHEN 'appointment' THEN 'appointments' WHEN 'follow_up' THEN 'rehabilitation' ELSE 'announcements' END;
  SELECT name INTO school_name FROM public.schools WHERE id = _school;
  FOR g IN SELECT DISTINCT user_id FROM public.athlete_guardians WHERE athlete_id = ANY (ids) LOOP
    PERFORM public.create_notification(g.user_id, cat, coalesce(subj, initcap(replace(_kind, '_', ' ')) || ' from ' || school_name), left(btrim(_body), 160),
      'communication', batch, uid, '/dashboard');
    n_notified := n_notified + 1;
  END LOOP;
  RETURN jsonb_build_object('recipients', array_length(ids, 1), 'notified', n_notified, 'batch_id', batch);
END $$;

CREATE OR REPLACE FUNCTION public.institution_communications(_school uuid)
RETURNS TABLE(batch_id uuid, kind text, subject text, body text, target text, recipients int, sender_name text, mine boolean, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE uid uuid := auth.uid(); adm boolean;
BEGIN
  IF NOT (public.is_institution_member(uid, _school) OR public.is_vito_staff(uid)) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  adm := public.is_institution_admin(uid, _school) OR public.is_vito_staff(uid);
  RETURN QUERY
  SELECT coalesce(c.batch_id, min(c.id::text)::uuid), max(c.kind), max(c.subject), max(c.body),
    CASE WHEN count(*) = 1 THEN (SELECT a.first_name || ' ' || a.surname FROM public.athletes a WHERE a.id = (array_agg(c.athlete_id))[1])
         WHEN max(t.name) IS NOT NULL THEN max(t.name) ELSE 'All athletes' END,
    count(*)::int, max(p.full_name), bool_or(c.sender_id = uid), max(c.created_at)
  FROM public.communications c LEFT JOIN public.institution_teams t ON t.id = c.team_id LEFT JOIN public.profiles p ON p.id = c.sender_id
  WHERE c.school_id = _school AND (adm OR c.sender_id = uid)
  GROUP BY coalesce(c.batch_id, c.id)
  ORDER BY max(c.created_at) DESC LIMIT 100;
END $$;

-- ===== Phase 5: professionals, referrals, consent =====
CREATE OR REPLACE FUNCTION public.list_professionals(_q text DEFAULT '', _specialty text DEFAULT '', _district text DEFAULT '')
RETURNS TABLE(id uuid, full_name text, avatar_path text, headline text, district text, specialty text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE uid uuid := auth.uid();
BEGIN
  IF NOT (public.is_vito_staff(uid) OR EXISTS (SELECT 1 FROM public.school_users WHERE user_id = uid AND status = 'active')) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  RETURN QUERY
  SELECT * FROM (
    SELECT p.id, p.full_name, p.avatar_path, cp.headline, coalesce(cp.district, cp.country),
      CASE WHEN concat_ws(' ', cp.headline, cp.position, cp.bio) ~* 'orthop' THEN 'Orthopaedic specialist'
           WHEN concat_ws(' ', cp.headline, cp.position, cp.bio) ~* 'general practi|\mGP\M' THEN 'General medical practitioner'
           WHEN concat_ws(' ', cp.headline, cp.position, cp.bio) ~* 'physician|sports medicine|doctor' THEN 'Sports physician'
           WHEN concat_ws(' ', cp.headline, cp.position, cp.bio) ~* 'physio' THEN 'Physiotherapist'
           ELSE 'Sports healthcare professional' END AS specialty
    FROM public.profiles p LEFT JOIN public.community_profiles cp ON cp.user_id = p.id
    WHERE EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role IN ('clinical_professional','clinical_supervisor'))
  ) x
  WHERE (coalesce(_q, '') = '' OR x.full_name ILIKE '%' || _q || '%' OR coalesce(x.headline, '') ILIKE '%' || _q || '%')
    AND (coalesce(_specialty, '') = '' OR x.specialty = _specialty)
    AND (coalesce(_district, '') = '' OR coalesce(x.district, '') ILIKE '%' || _district || '%')
  ORDER BY x.full_name LIMIT 100;
END $$;

CREATE OR REPLACE FUNCTION public.institution_create_referral(_school uuid, _athlete uuid, _injury uuid, _professional uuid, _reason text,
  _purpose text, _scopes text[], _priority text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); new_id uuid; pname text; g record; aname text;
BEGIN
  IF NOT public.institution_can_see_athlete(uid, _school, _athlete) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _professional AND role IN ('clinical_professional','clinical_supervisor')) THEN RAISE EXCEPTION 'Choose a registered professional'; END IF;
  IF _injury IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.injuries WHERE id = _injury AND athlete_id = _athlete) THEN RAISE EXCEPTION 'Injury does not belong to this athlete'; END IF;
  IF _scopes IS NULL OR array_length(_scopes, 1) IS NULL OR NOT (_scopes <@ ARRAY['participation','injury_summary','clinical']) THEN RAISE EXCEPTION 'Choose what information to share'; END IF;
  IF btrim(coalesce(_purpose, '')) = '' THEN RAISE EXCEPTION 'Record the purpose of sharing'; END IF;
  SELECT full_name INTO pname FROM public.profiles WHERE id = _professional;
  SELECT first_name || ' ' || surname INTO aname FROM public.athletes WHERE id = _athlete;
  INSERT INTO public.referrals(injury_id, athlete_id, referred_to, reason, status, created_by, school_id, professional_id, purpose, shared_scopes,
    consent_status, requested_by, priority)
  VALUES (_injury, _athlete, coalesce(pname, 'Professional'), nullif(left(btrim(coalesce(_reason, '')), 2000), ''), 'pending_consent', uid, _school, _professional,
    left(btrim(_purpose), 1000), (SELECT array_agg(DISTINCT s) FROM unnest(_scopes) s), 'pending', uid,
    CASE WHEN _priority IN ('routine','soon','urgent') THEN _priority ELSE 'routine' END)
  RETURNING id INTO new_id;
  FOR g IN SELECT DISTINCT user_id FROM public.athlete_guardians WHERE athlete_id = _athlete LOOP
    PERFORM public.create_notification(g.user_id, 'announcements', 'Consent requested to share health information',
      'A referral for ' || aname || ' to ' || coalesce(pname, 'a professional') || ' needs your consent.', 'referral', new_id, uid, '/consent/' || new_id);
  END LOOP;
  PERFORM public.log_sensitive_access(uid, 'create_referral', _school, _athlete, new_id, jsonb_build_object('professional_id', _professional, 'scopes', _scopes));
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.apply_referral_consent(_referral uuid, _granted boolean, _by uuid, _name text, _method text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.referrals;
BEGIN
  SELECT * INTO r FROM public.referrals WHERE id = _referral FOR UPDATE;
  IF r.consent_status <> 'pending' THEN RAISE EXCEPTION 'Consent has already been recorded for this referral'; END IF;
  UPDATE public.referrals SET consent_status = CASE WHEN _granted THEN 'granted' ELSE 'declined' END, consent_by = _by, consent_name = _name,
    consent_method = _method, consent_at = now(), status = CASE WHEN _granted THEN 'sent' ELSE 'declined' END, updated_at = now()
  WHERE id = _referral;
  IF _granted THEN
    PERFORM public.create_notification(r.professional_id, 'announcements', 'New referral shared with you',
      'An institution referral is ready for your review.', 'referral', r.id, _by, '/referrals');
  END IF;
  PERFORM public.create_notification(r.requested_by, 'announcements', CASE WHEN _granted THEN 'Referral consent granted' ELSE 'Referral consent declined' END,
    'Consent for referral ' || r.referral_code || ' was ' || CASE WHEN _granted THEN 'granted.' ELSE 'declined.' END, 'referral', r.id, _by,
    '/workspace/' || r.school_id || '?section=professionals');
  PERFORM public.log_sensitive_access(_by, CASE WHEN _granted THEN 'consent_granted' ELSE 'consent_declined' END, r.school_id, r.athlete_id, r.id,
    jsonb_build_object('method', _method, 'name', _name));
END $$;

CREATE OR REPLACE FUNCTION public.respond_referral_consent(_referral uuid, _approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); aid uuid; rel text; nm text;
BEGIN
  SELECT athlete_id INTO aid FROM public.referrals WHERE id = _referral;
  SELECT relationship INTO rel FROM public.athlete_guardians WHERE athlete_id = aid AND user_id = uid LIMIT 1;
  IF aid IS NULL OR rel IS NULL THEN RAISE EXCEPTION 'Only the athlete or a linked guardian can respond'; END IF;
  SELECT full_name INTO nm FROM public.profiles WHERE id = uid;
  PERFORM public.apply_referral_consent(_referral, _approve, uid, coalesce(nm, 'Account holder') || ' (' || coalesce(rel, 'linked') || ')', 'in_app');
END $$;

CREATE OR REPLACE FUNCTION public.institution_record_consent(_referral uuid, _granted boolean, _consenter text, _relationship text, _method text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sid uuid;
BEGIN
  SELECT school_id INTO sid FROM public.referrals WHERE id = _referral;
  IF sid IS NULL OR NOT public.is_institution_admin(auth.uid(), sid) THEN RAISE EXCEPTION 'Only institution administrators can record consent'; END IF;
  IF btrim(coalesce(_consenter, '')) = '' THEN RAISE EXCEPTION 'Enter who gave consent'; END IF;
  IF _method NOT IN ('written','verbal') THEN RAISE EXCEPTION 'Choose how consent was given'; END IF;
  PERFORM public.apply_referral_consent(_referral, _granted, auth.uid(),
    left(btrim(_consenter), 120) || ' (' || coalesce(nullif(btrim(_relationship), ''), 'athlete') || ')', _method);
END $$;

CREATE OR REPLACE FUNCTION public.referral_consent_details(_referral uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); r public.referrals;
BEGIN
  SELECT * INTO r FROM public.referrals WHERE id = _referral;
  IF r.id IS NULL OR NOT (EXISTS (SELECT 1 FROM public.athlete_guardians WHERE athlete_id = r.athlete_id AND user_id = uid)
     OR (r.school_id IS NOT NULL AND public.is_institution_admin(uid, r.school_id))) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  RETURN jsonb_build_object('id', r.id, 'referral_code', r.referral_code,
    'athlete_name', (SELECT first_name || ' ' || surname FROM public.athletes WHERE id = r.athlete_id),
    'institution', (SELECT name FROM public.schools WHERE id = r.school_id),
    'professional', r.referred_to, 'purpose', r.purpose, 'reason', r.reason, 'scopes', to_jsonb(r.shared_scopes),
    'requested_by', (SELECT full_name FROM public.profiles WHERE id = r.requested_by), 'consent_status', r.consent_status,
    'consent_name', r.consent_name, 'consent_at', r.consent_at, 'created_at', r.created_at);
END $$;

CREATE OR REPLACE FUNCTION public.institution_referrals(_school uuid)
RETURNS TABLE(id uuid, referral_code text, athlete_id uuid, athlete_name text, professional_name text, reason text, purpose text,
  scopes text[], priority text, status text, consent_status text, consent_name text, consent_method text, feedback text,
  requested_by_name text, mine boolean, created_at timestamptz, updated_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE uid uuid := auth.uid();
BEGIN
  IF NOT (public.is_institution_member(uid, _school) OR public.is_vito_staff(uid)) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  RETURN QUERY
  SELECT r.id, r.referral_code, r.athlete_id, a.first_name || ' ' || a.surname, r.referred_to, r.reason, r.purpose, r.shared_scopes,
    r.priority, r.status, r.consent_status, r.consent_name, r.consent_method, r.feedback, p.full_name, r.requested_by = uid, r.created_at, r.updated_at
  FROM public.referrals r JOIN public.athletes a ON a.id = r.athlete_id LEFT JOIN public.profiles p ON p.id = r.requested_by
  WHERE r.school_id = _school AND public.institution_can_see_athlete(uid, _school, r.athlete_id)
  ORDER BY r.created_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.institution_cancel_referral(_referral uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.referrals;
BEGIN
  SELECT * INTO r FROM public.referrals WHERE id = _referral;
  IF r.id IS NULL OR r.school_id IS NULL OR NOT (public.is_institution_admin(auth.uid(), r.school_id) OR r.requested_by = auth.uid()) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF r.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'This referral is already closed'; END IF;
  UPDATE public.referrals SET status = 'cancelled', consent_status = CASE WHEN consent_status = 'granted' THEN 'revoked' ELSE consent_status END, updated_at = now() WHERE id = _referral;
  PERFORM public.log_sensitive_access(auth.uid(), 'cancel_referral', r.school_id, r.athlete_id, r.id, '{}'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.professional_referrals()
RETURNS TABLE(id uuid, referral_code text, athlete_name text, institution text, purpose text, reason text, scopes text[], priority text,
  status text, consent_status text, feedback text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  SELECT r.id, r.referral_code, CASE WHEN r.consent_status = 'granted' THEN a.first_name || ' ' || a.surname ELSE 'Awaiting consent' END,
    s.name, r.purpose, CASE WHEN r.consent_status = 'granted' THEN r.reason END, r.shared_scopes, r.priority, r.status, r.consent_status, r.feedback, r.created_at
  FROM public.referrals r JOIN public.athletes a ON a.id = r.athlete_id LEFT JOIN public.schools s ON s.id = r.school_id
  WHERE r.professional_id = auth.uid() AND r.status <> 'cancelled'
  ORDER BY r.created_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.professional_referral_detail(_referral uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); r public.referrals; out jsonb;
BEGIN
  SELECT * INTO r FROM public.referrals WHERE id = _referral;
  IF r.id IS NULL OR r.professional_id IS DISTINCT FROM uid THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF r.consent_status <> 'granted' OR r.status = 'cancelled' THEN RAISE EXCEPTION 'Consent has not been granted for this referral'; END IF;
  out := jsonb_build_object('id', r.id, 'referral_code', r.referral_code, 'purpose', r.purpose, 'reason', r.reason, 'scopes', to_jsonb(r.shared_scopes),
    'status', r.status, 'feedback', r.feedback, 'consent_name', r.consent_name, 'consent_at', r.consent_at,
    'institution', (SELECT name FROM public.schools WHERE id = r.school_id));
  IF 'participation' = ANY (r.shared_scopes) THEN
    out := out || jsonb_build_object('participation', (SELECT jsonb_build_object('name', a.first_name || ' ' || a.surname, 'athlete_code', a.athlete_code,
      'date_of_birth', a.date_of_birth, 'gender', a.gender, 'sport', a.sport, 'competition_level', a.competition_level,
      'teams', (SELECT coalesce(jsonb_agg(t.name), '[]'::jsonb) FROM public.institution_team_athletes ta JOIN public.institution_teams t ON t.id = ta.team_id WHERE ta.athlete_id = a.id))
      FROM public.athletes a WHERE a.id = r.athlete_id));
  END IF;
  IF 'injury_summary' = ANY (r.shared_scopes) THEN
    out := out || jsonb_build_object('injuries', coalesce((SELECT jsonb_agg(jsonb_build_object('body_region', i.body_region, 'injury_type', i.injury_type,
      'severity', i.severity, 'status', i.status, 'injury_date', coalesce(i.injury_date, i.created_at::date), 'resolved_at', i.resolved_at,
      'days_lost', i.days_lost, 'activity_context', i.activity_context, 'is_recurrence', i.is_recurrence,
      'rehab_phase', (SELECT rp.phase FROM public.rehabilitation_plans rp WHERE rp.injury_id = i.id ORDER BY rp.created_at DESC LIMIT 1))
      ORDER BY i.created_at DESC) FROM public.injuries i WHERE i.athlete_id = r.athlete_id AND (r.injury_id IS NULL OR i.id = r.injury_id)), '[]'::jsonb));
  END IF;
  IF 'clinical' = ANY (r.shared_scopes) THEN
    out := out || jsonb_build_object('assessments', coalesce((SELECT jsonb_agg(to_jsonb(s) - 'created_by' - 'athlete_id' ORDER BY s.created_at DESC)
      FROM public.assessments s WHERE s.athlete_id = r.athlete_id AND (r.injury_id IS NULL OR s.injury_id = r.injury_id)), '[]'::jsonb),
      'clinical_notes', coalesce((SELECT jsonb_agg(jsonb_build_object('note', n.note, 'created_at', n.created_at) ORDER BY n.created_at DESC)
      FROM public.clinical_notes n WHERE n.athlete_id = r.athlete_id AND (r.injury_id IS NULL OR n.injury_id = r.injury_id)), '[]'::jsonb));
  END IF;
  PERFORM public.log_sensitive_access(uid, 'professional_view', r.school_id, r.athlete_id, r.id, jsonb_build_object('scopes', r.shared_scopes));
  RETURN out;
END $$;

CREATE OR REPLACE FUNCTION public.professional_update_referral(_referral uuid, _status text, _feedback text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); r public.referrals;
BEGIN
  SELECT * INTO r FROM public.referrals WHERE id = _referral;
  IF r.id IS NULL OR r.professional_id IS DISTINCT FROM uid OR r.consent_status <> 'granted' THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF _status NOT IN ('accepted','declined','completed') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  IF r.status IN ('cancelled','completed') THEN RAISE EXCEPTION 'This referral is closed'; END IF;
  UPDATE public.referrals SET status = _status, feedback = coalesce(nullif(left(btrim(coalesce(_feedback, '')), 4000), ''), feedback),
    feedback_at = CASE WHEN btrim(coalesce(_feedback, '')) <> '' THEN now() ELSE feedback_at END, updated_at = now() WHERE id = _referral;
  PERFORM public.create_notification(r.requested_by, 'announcements', 'Referral ' || _status, 'Referral ' || r.referral_code || ' was ' || _status || ' by the professional.',
    'referral', r.id, uid, '/workspace/' || r.school_id || '?section=professionals');
  PERFORM public.log_sensitive_access(uid, 'professional_update', r.school_id, r.athlete_id, r.id, jsonb_build_object('status', _status));
END $$;

CREATE OR REPLACE FUNCTION public.institution_audit_log(_school uuid)
RETURNS TABLE(id uuid, action text, actor_name text, athlete_name text, referral_code text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
BEGIN
  IF NOT (public.is_institution_admin(auth.uid(), _school) OR public.is_vito_staff(auth.uid())) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  RETURN QUERY SELECT l.id, l.action, p.full_name, a.first_name || ' ' || a.surname, r.referral_code, l.created_at
  FROM public.sensitive_access_log l LEFT JOIN public.profiles p ON p.id = l.actor_id LEFT JOIN public.athletes a ON a.id = l.athlete_id
  LEFT JOIN public.referrals r ON r.id = l.referral_id
  WHERE l.school_id = _school ORDER BY l.created_at DESC LIMIT 200;
END $$;

-- ===== Execution grants =====
REVOKE EXECUTE ON FUNCTION public.log_sensitive_access(uuid, text, uuid, uuid, uuid, jsonb), public.apply_referral_consent(uuid, boolean, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.institution_can_see_athlete(uuid, uuid, uuid), public.institution_athletes(uuid), public.institution_athlete_profile(uuid, uuid),
  public.institution_register_athletes(uuid, jsonb), public.institution_update_athlete(uuid, uuid, text, text, text, text), public.institution_teams_list(uuid),
  public.institution_save_team(uuid, uuid, text, text, text, uuid), public.institution_delete_team(uuid), public.institution_set_team_athletes(uuid, uuid[]),
  public.institution_injury_records(uuid), public.institution_report_injury(uuid, uuid, text, text, text, date, text, text, text),
  public.institution_pattern_reviews_list(uuid), public.institution_add_pattern_review(uuid, text, text, text), public.institution_activity(uuid),
  public.institution_send_message(uuid, text, uuid, uuid, text, text, text), public.institution_communications(uuid),
  public.list_professionals(text, text, text), public.institution_create_referral(uuid, uuid, uuid, uuid, text, text, text[], text),
  public.respond_referral_consent(uuid, boolean), public.institution_record_consent(uuid, boolean, text, text, text), public.referral_consent_details(uuid),
  public.institution_referrals(uuid), public.institution_cancel_referral(uuid), public.professional_referrals(), public.professional_referral_detail(uuid),
  public.professional_update_referral(uuid, text, text), public.institution_audit_log(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.institution_can_see_athlete(uuid, uuid, uuid), public.institution_athletes(uuid), public.institution_athlete_profile(uuid, uuid),
  public.institution_register_athletes(uuid, jsonb), public.institution_update_athlete(uuid, uuid, text, text, text, text), public.institution_teams_list(uuid),
  public.institution_save_team(uuid, uuid, text, text, text, uuid), public.institution_delete_team(uuid), public.institution_set_team_athletes(uuid, uuid[]),
  public.institution_injury_records(uuid), public.institution_report_injury(uuid, uuid, text, text, text, date, text, text, text),
  public.institution_pattern_reviews_list(uuid), public.institution_add_pattern_review(uuid, text, text, text), public.institution_activity(uuid),
  public.institution_send_message(uuid, text, uuid, uuid, text, text, text), public.institution_communications(uuid),
  public.list_professionals(text, text, text), public.institution_create_referral(uuid, uuid, uuid, uuid, text, text, text[], text),
  public.respond_referral_consent(uuid, boolean), public.institution_record_consent(uuid, boolean, text, text, text), public.referral_consent_details(uuid),
  public.institution_referrals(uuid), public.institution_cancel_referral(uuid), public.professional_referrals(), public.professional_referral_detail(uuid),
  public.professional_update_referral(uuid, text, text), public.institution_audit_log(uuid)
  TO authenticated;