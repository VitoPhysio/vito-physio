-- Phase 1: Institutional foundation
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS district text,
  ADD COLUMN IF NOT EXISTS sports text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.schools DROP CONSTRAINT IF EXISTS schools_verification_status_check;
ALTER TABLE public.schools ADD CONSTRAINT schools_verification_status_check CHECK (verification_status IN ('pending','verified','rejected'));
UPDATE public.schools SET verification_status = 'verified' WHERE self_registered = false AND verification_status = 'pending';

ALTER TABLE public.school_users
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'school_admin',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE public.school_users DROP CONSTRAINT IF EXISTS school_users_role_check;
ALTER TABLE public.school_users ADD CONSTRAINT school_users_role_check CHECK (role IN ('school_admin','coach'));
ALTER TABLE public.school_users DROP CONSTRAINT IF EXISTS school_users_status_check;
ALTER TABLE public.school_users ADD CONSTRAINT school_users_status_check CHECK (status IN ('active','suspended'));
CREATE INDEX IF NOT EXISTS school_users_school_idx ON public.school_users (school_id);
CREATE INDEX IF NOT EXISTS org_join_requests_school_status_idx ON public.org_join_requests (school_id, status);
CREATE INDEX IF NOT EXISTS schools_name_lookup_idx ON public.schools (lower(btrim(name)), school_type);

-- Helpers (security definer avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.institution_role(_user uuid, _school uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.school_users WHERE user_id = _user AND school_id = _school AND status = 'active' LIMIT 1
$$;
CREATE OR REPLACE FUNCTION public.is_institution_member(_user uuid, _school uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.school_users WHERE user_id = _user AND school_id = _school AND status = 'active')
$$;
CREATE OR REPLACE FUNCTION public.is_institution_admin(_user uuid, _school uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.school_users WHERE user_id = _user AND school_id = _school AND status = 'active' AND role = 'school_admin')
$$;

-- Institution admins can read requests for their institution
DROP POLICY IF EXISTS "Institution admins read join requests" ON public.org_join_requests;
CREATE POLICY "Institution admins read join requests" ON public.org_join_requests
FOR SELECT TO authenticated USING (public.is_institution_admin(auth.uid(), school_id));

-- Approved requests create memberships with the requested institution role
CREATE OR REPLACE FUNCTION public.org_join_approved()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF new.status = 'approved' AND old.status <> 'approved' THEN
    IF new.role = 'athlete' THEN
      UPDATE public.athletes a SET school_id = new.school_id, updated_at = now()
      FROM public.athlete_guardians g
      WHERE g.user_id = new.user_id AND g.athlete_id = a.id AND g.relationship = 'self';
    ELSE
      INSERT INTO public.school_users (user_id, school_id, role)
      VALUES (new.user_id, new.school_id, CASE WHEN new.role = 'coach' THEN 'coach' ELSE 'school_admin' END)
      ON CONFLICT (user_id, school_id) DO UPDATE SET role = excluded.role, status = 'active';
    END IF;
  END IF;
  RETURN new;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.org_join_approved() FROM PUBLIC, anon, authenticated;

-- Workspace entry: my institutions + pending requests
CREATE OR REPLACE FUNCTION public.my_institutions()
RETURNS TABLE (id uuid, name text, school_type text, location text, district text, logo_path text, verification_status text, role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.name, s.school_type, s.location, s.district, s.logo_path, s.verification_status, su.role
  FROM public.school_users su JOIN public.schools s ON s.id = su.school_id
  WHERE su.user_id = auth.uid() AND su.status = 'active'
  ORDER BY s.name
$$;

CREATE OR REPLACE FUNCTION public.search_institutions(_q text DEFAULT '')
RETURNS TABLE (id uuid, name text, school_type text, location text, district text, logo_path text, verification_status text, admin_name text, my_request_status text, is_member boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.name, s.school_type, s.location, s.district, s.logo_path, s.verification_status,
    (SELECT p.full_name FROM public.school_users su JOIN public.profiles p ON p.id = su.user_id
      WHERE su.school_id = s.id AND su.role = 'school_admin' AND su.status = 'active' ORDER BY su.created_at LIMIT 1),
    (SELECT r.status FROM public.org_join_requests r WHERE r.school_id = s.id AND r.user_id = auth.uid()),
    public.is_institution_member(auth.uid(), s.id)
  FROM public.schools s
  WHERE auth.uid() IS NOT NULL
    AND s.verification_status <> 'rejected'
    AND (coalesce(btrim(_q), '') = '' OR s.name ILIKE '%' || btrim(_q) || '%' OR s.location ILIKE '%' || btrim(_q) || '%' OR s.district ILIKE '%' || btrim(_q) || '%')
  ORDER BY s.name
  LIMIT 50
$$;

CREATE OR REPLACE FUNCTION public.request_institution_membership(_school uuid, _role text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); existing text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF _role NOT IN ('school_admin','coach') THEN RAISE EXCEPTION 'Choose administrator or coach'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.schools WHERE id = _school AND verification_status <> 'rejected') THEN RAISE EXCEPTION 'Institution not found'; END IF;
  IF public.is_institution_member(uid, _school) THEN RETURN 'member'; END IF;
  SELECT status INTO existing FROM public.org_join_requests WHERE user_id = uid AND school_id = _school;
  IF existing = 'pending' THEN RETURN 'pending'; END IF;
  INSERT INTO public.org_join_requests (user_id, school_id, role, status)
  VALUES (uid, _school, _role, 'pending')
  ON CONFLICT (user_id, school_id) DO UPDATE SET role = excluded.role, status = 'pending', handled_by = NULL, updated_at = now();
  RETURN 'pending';
END;
$$;

CREATE OR REPLACE FUNCTION public.register_institution(
  _name text, _type text, _location text, _district text, _sports text[],
  _phone text, _email text, _notes text, _logo_path text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); sid uuid; clean text := btrim(coalesce(_name, ''));
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF NOT (public.has_role(uid, 'school_admin') OR public.has_role(uid, 'coach') OR public.is_vito_staff(uid)) THEN
    RAISE EXCEPTION 'Only administrators and coaches can register an institution';
  END IF;
  IF length(clean) < 3 THEN RAISE EXCEPTION 'Enter the institution name'; END IF;
  IF _type NOT IN ('school','club','academy') THEN RAISE EXCEPTION 'Choose school, club or academy'; END IF;
  IF _logo_path IS NOT NULL AND _logo_path !~ '^uploads/[0-9a-f-]{36}\.(png|jpg|webp)$' THEN _logo_path := NULL; END IF;
  IF EXISTS (SELECT 1 FROM public.schools WHERE lower(btrim(name)) = lower(clean) AND school_type = _type
      AND lower(coalesce(btrim(district), '')) = lower(coalesce(btrim(_district), ''))) THEN
    RAISE EXCEPTION 'This institution is already registered. Search for it and request to join instead.';
  END IF;
  INSERT INTO public.schools (name, school_type, location, district, sports, contact_phone, contact_email, intake_notes, logo_path, created_by, self_registered, verification_status)
  VALUES (left(clean, 160), _type, left(nullif(btrim(_location), ''), 160), left(nullif(btrim(_district), ''), 120),
    coalesce((SELECT array_agg(DISTINCT left(btrim(x), 60)) FROM unnest(coalesce(_sports, '{}')) x WHERE btrim(x) <> ''), '{}'),
    left(nullif(btrim(_phone), ''), 40), left(nullif(btrim(_email), ''), 160), left(nullif(btrim(_notes), ''), 1000),
    _logo_path, uid, true, 'pending')
  RETURNING id INTO sid;
  INSERT INTO public.school_users (user_id, school_id, role) VALUES (uid, sid, 'school_admin')
  ON CONFLICT (user_id, school_id) DO UPDATE SET role = 'school_admin', status = 'active';
  RETURN sid;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_institution_profile(
  _school uuid, _name text, _location text, _district text, _sports text[], _phone text, _email text, _logo_path text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_institution_admin(auth.uid(), _school) OR public.is_vito_staff(auth.uid())) THEN
    RAISE EXCEPTION 'Only institution administrators can edit this profile';
  END IF;
  IF length(btrim(coalesce(_name, ''))) < 3 THEN RAISE EXCEPTION 'Enter the institution name'; END IF;
  IF _logo_path IS NOT NULL AND _logo_path !~ '^uploads/[0-9a-f-]{36}\.(png|jpg|webp)$' THEN _logo_path := NULL; END IF;
  UPDATE public.schools SET
    name = left(btrim(_name), 160),
    location = left(nullif(btrim(_location), ''), 160),
    district = left(nullif(btrim(_district), ''), 120),
    sports = coalesce((SELECT array_agg(DISTINCT left(btrim(x), 60)) FROM unnest(coalesce(_sports, '{}')) x WHERE btrim(x) <> ''), '{}'),
    contact_phone = left(nullif(btrim(_phone), ''), 40),
    contact_email = left(nullif(btrim(_email), ''), 160),
    logo_path = coalesce(_logo_path, logo_path),
    updated_at = now()
  WHERE id = _school;
END;
$$;

CREATE OR REPLACE FUNCTION public.institution_join_requests(_school uuid)
RETURNS TABLE (id uuid, user_id uuid, full_name text, email text, role text, status text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_institution_admin(auth.uid(), _school) OR public.is_vito_staff(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  RETURN QUERY SELECT r.id, r.user_id, p.full_name, p.email, r.role, r.status, r.created_at
  FROM public.org_join_requests r LEFT JOIN public.profiles p ON p.id = r.user_id
  WHERE r.school_id = _school AND r.status = 'pending' AND r.role IN ('school_admin','coach')
  ORDER BY r.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_join_request(_request uuid, _approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sid uuid;
BEGIN
  SELECT school_id INTO sid FROM public.org_join_requests WHERE id = _request AND status = 'pending';
  IF sid IS NULL THEN RAISE EXCEPTION 'Request not found or already handled'; END IF;
  IF NOT (public.is_institution_admin(auth.uid(), sid) OR public.is_vito_staff(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  UPDATE public.org_join_requests
  SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END, handled_by = auth.uid(), updated_at = now()
  WHERE id = _request;
END;
$$;

CREATE OR REPLACE FUNCTION public.institution_members(_school uuid)
RETURNS TABLE (user_id uuid, full_name text, email text, avatar_path text, role text, status text, joined_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_institution_member(auth.uid(), _school) OR public.is_vito_staff(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  RETURN QUERY SELECT su.user_id, p.full_name,
    CASE WHEN public.is_institution_admin(auth.uid(), _school) OR public.is_vito_staff(auth.uid()) THEN p.email ELSE NULL END,
    p.avatar_path, su.role, su.status, su.created_at
  FROM public.school_users su LEFT JOIN public.profiles p ON p.id = su.user_id
  WHERE su.school_id = _school
  ORDER BY su.role DESC, p.full_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_institution_member_role(_school uuid, _user uuid, _role text, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.is_institution_admin(auth.uid(), _school) OR public.is_vito_staff(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  IF _role NOT IN ('school_admin','coach') OR _status NOT IN ('active','suspended') THEN RAISE EXCEPTION 'Invalid role or status'; END IF;
  IF _user = auth.uid() AND (_role <> 'school_admin' OR _status <> 'active')
     AND NOT EXISTS (SELECT 1 FROM public.school_users WHERE school_id = _school AND user_id <> _user AND role = 'school_admin' AND status = 'active') THEN
    RAISE EXCEPTION 'An institution needs at least one active administrator';
  END IF;
  UPDATE public.school_users SET role = _role, status = _status WHERE school_id = _school AND user_id = _user;
END;
$$;

CREATE OR REPLACE FUNCTION public.institution_overview(_school uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT (public.is_institution_member(auth.uid(), _school) OR public.is_vito_staff(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  SELECT jsonb_build_object(
    'athletes', (SELECT count(*) FROM public.athletes WHERE school_id = _school),
    'injured', (SELECT count(DISTINCT i.athlete_id) FROM public.injuries i JOIN public.athletes a ON a.id = i.athlete_id
                WHERE a.school_id = _school AND coalesce(i.status, '') NOT IN ('closed','resolved','recovered')),
    'injuries_30d', (SELECT count(*) FROM public.injuries i JOIN public.athletes a ON a.id = i.athlete_id
                WHERE a.school_id = _school AND i.created_at >= now() - interval '30 days'),
    'administrators', (SELECT count(*) FROM public.school_users WHERE school_id = _school AND role = 'school_admin' AND status = 'active'),
    'coaches', (SELECT count(*) FROM public.school_users WHERE school_id = _school AND role = 'coach' AND status = 'active'),
    'pending_requests', (SELECT count(*) FROM public.org_join_requests WHERE school_id = _school AND status = 'pending'),
    'sports', (SELECT coalesce(jsonb_agg(jsonb_build_object('sport', sport, 'count', n) ORDER BY n DESC), '[]'::jsonb)
               FROM (SELECT coalesce(nullif(btrim(sport), ''), 'Not set') sport, count(*) n FROM public.athletes WHERE school_id = _school GROUP BY 1) t)
  ) INTO result;
  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.my_institutions(), public.search_institutions(text), public.request_institution_membership(uuid, text),
  public.register_institution(text, text, text, text, text[], text, text, text, text),
  public.update_institution_profile(uuid, text, text, text, text[], text, text, text),
  public.institution_join_requests(uuid), public.review_join_request(uuid, boolean), public.institution_members(uuid),
  public.set_institution_member_role(uuid, uuid, text, text), public.institution_overview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_institutions(), public.search_institutions(text), public.request_institution_membership(uuid, text),
  public.register_institution(text, text, text, text, text[], text, text, text, text),
  public.update_institution_profile(uuid, text, text, text, text[], text, text, text),
  public.institution_join_requests(uuid), public.review_join_request(uuid, boolean), public.institution_members(uuid),
  public.set_institution_member_role(uuid, uuid, text, text), public.institution_overview(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.institution_role(uuid, uuid), public.is_institution_member(uuid, uuid), public.is_institution_admin(uuid, uuid) TO authenticated;