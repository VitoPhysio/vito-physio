-- 1. Fix institution communications history (invalid GROUP BY)
CREATE OR REPLACE FUNCTION public.institution_communications(_school uuid)
 RETURNS TABLE(batch_id uuid, kind text, subject text, body text, target text, recipients integer, sender_name text, mine boolean, created_at timestamp with time zone)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE uid uuid := auth.uid(); adm boolean;
BEGIN
  IF NOT (public.is_institution_member(uid, _school) OR public.is_vito_staff(uid)) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  adm := public.is_institution_admin(uid, _school) OR public.is_vito_staff(uid);
  RETURN QUERY
  SELECT coalesce(c.batch_id, c.id), max(c.kind), max(c.subject), max(c.body),
    CASE WHEN max(t.name) IS NOT NULL THEN max(t.name)
         WHEN count(*) = 1 AND max(c.athlete_id::text) IS NOT NULL THEN (SELECT a.first_name || ' ' || a.surname FROM public.athletes a WHERE a.id = max(c.athlete_id::text)::uuid)
         WHEN count(*) = 1 THEN 'Institution'
         ELSE 'All athletes' END,
    count(*)::int, max(p.full_name), bool_or(c.sender_id = uid), max(c.created_at)
  FROM public.communications c
  LEFT JOIN public.institution_teams t ON t.id = c.team_id
  LEFT JOIN public.profiles p ON p.id = c.sender_id
  WHERE c.school_id = _school AND (adm OR c.sender_id = uid)
  GROUP BY coalesce(c.batch_id, c.id)
  ORDER BY max(c.created_at) DESC LIMIT 100;
END $function$;

-- 2. Internal helper: find or create a two-person direct conversation
CREATE OR REPLACE FUNCTION public.ensure_direct_conversation(_a uuid, _b uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE conv uuid;
BEGIN
  SELECT c.id INTO conv FROM public.conversations c
  JOIN public.conversation_participants p1 ON p1.conversation_id = c.id AND p1.user_id = _a
  JOIN public.conversation_participants p2 ON p2.conversation_id = c.id AND p2.user_id = _b
  WHERE c.kind = 'direct' AND (SELECT count(*) FROM public.conversation_participants cp WHERE cp.conversation_id = c.id) = 2
  LIMIT 1;
  IF conv IS NULL THEN
    INSERT INTO public.conversations(kind) VALUES ('direct') RETURNING id INTO conv;
    INSERT INTO public.conversation_participants(conversation_id, user_id) VALUES (conv, _a), (conv, _b);
  END IF;
  RETURN conv;
END $function$;
REVOKE EXECUTE ON FUNCTION public.ensure_direct_conversation(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- 3. Mirror every communication into the recipients' chat inbox so they can reply
CREATE OR REPLACE FUNCTION public.mirror_communication_to_chat()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r uuid; conv uuid; header text; msg text; school_name text; kind_label text;
BEGIN
  IF NEW.sender_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.sender_id) THEN RETURN NEW; END IF;
  IF NEW.school_id IS NOT NULL THEN SELECT name INTO school_name FROM public.schools WHERE id = NEW.school_id; END IF;
  kind_label := initcap(replace(coalesce(NEW.kind, 'message'), '_', ' '));
  header := CASE
    WHEN school_name IS NOT NULL AND public.is_institution_member(NEW.sender_id, NEW.school_id) THEN '[' || kind_label || ' · ' || school_name || ']'
    WHEN public.is_vito_staff(NEW.sender_id) THEN '[VITO ' || lower(kind_label) || ']'
    ELSE NULL END;
  msg := concat_ws(E'\n', header, nullif(btrim(coalesce(NEW.subject, '')), ''));
  msg := left(CASE WHEN msg = '' THEN btrim(NEW.body) ELSE msg || E'\n\n' || btrim(NEW.body) END, 4000);
  IF btrim(msg) = '' THEN RETURN NEW; END IF;

  FOR r IN
    SELECT DISTINCT u FROM (
      SELECT NEW.recipient_id u WHERE NEW.recipient_id IS NOT NULL
      UNION ALL
      SELECT g.user_id FROM public.athlete_guardians g WHERE NEW.recipient_id IS NULL AND NEW.athlete_id IS NOT NULL AND NEW.audience IS NULL AND g.athlete_id = NEW.athlete_id
      UNION ALL
      SELECT su.user_id FROM public.school_users su WHERE NEW.recipient_id IS NULL AND NEW.athlete_id IS NULL AND NEW.audience IS NULL AND NEW.school_id IS NOT NULL
        AND su.school_id = NEW.school_id AND su.role = 'school_admin' AND su.status = 'active'
      UNION ALL
      SELECT ur.user_id FROM public.user_roles ur WHERE NEW.recipient_id IS NULL AND (
        (NEW.audience = 'clinicians' AND ur.role IN ('super_admin','vito_admin','clinical_professional','clinical_supervisor'))
        OR (NEW.audience = 'schools' AND ur.role IN ('school_admin','coach'))
        OR (NEW.audience = 'athletes' AND ur.role IN ('athlete','parent'))
        OR NEW.audience = 'everyone')
    ) x WHERE u IS NOT NULL AND u <> NEW.sender_id AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u)
    LIMIT 500
  LOOP
    conv := public.ensure_direct_conversation(NEW.sender_id, r);
    -- one batch can contain siblings sharing a guardian: deliver once
    IF NOT EXISTS (SELECT 1 FROM public.messages m WHERE m.conversation_id = conv AND m.sender_id = NEW.sender_id AND m.body = msg AND m.created_at = now()) THEN
      INSERT INTO public.messages(conversation_id, sender_id, body) VALUES (conv, NEW.sender_id, msg);
    END IF;
  END LOOP;
  RETURN NEW;
END $function$;
REVOKE EXECUTE ON FUNCTION public.mirror_communication_to_chat() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS communications_mirror_chat ON public.communications;
CREATE TRIGGER communications_mirror_chat AFTER INSERT ON public.communications
  FOR EACH ROW EXECUTE FUNCTION public.mirror_communication_to_chat();

-- 4. Institution send: chat delivery replaces the separate notification loop (avoids double phone alerts)
CREATE OR REPLACE FUNCTION public.institution_send_message(_school uuid, _target text, _team uuid, _athlete uuid, _kind text, _subject text, _body text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); adm boolean; batch uuid := gen_random_uuid(); ids uuid[]; subj text; n_accounts int := 0;
BEGIN
  IF NOT (public.is_institution_member(uid, _school) OR public.is_vito_staff(uid)) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  adm := public.is_institution_admin(uid, _school) OR public.is_vito_staff(uid);
  IF _kind NOT IN ('message','announcement','reminder','appointment','follow_up') THEN RAISE EXCEPTION 'Invalid message type'; END IF;
  IF btrim(coalesce(_body, '')) = '' THEN RAISE EXCEPTION 'Write a message'; END IF;
  IF length(_body) > 3700 THEN RAISE EXCEPTION 'Message too long (max 3700 characters)'; END IF;
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
  SELECT count(DISTINCT user_id) INTO n_accounts FROM public.athlete_guardians WHERE athlete_id = ANY (ids) AND user_id <> uid;
  RETURN jsonb_build_object('recipients', array_length(ids, 1), 'notified', n_accounts, 'batch_id', batch);
END $function$;

-- 5. People an institution member may chat with
CREATE OR REPLACE FUNCTION public.institution_contacts(_school uuid)
 RETURNS TABLE(user_id uuid, full_name text, avatar_path text, relation text, detail text)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE uid uuid := auth.uid(); staff boolean;
BEGIN
  staff := public.is_vito_staff(uid);
  IF NOT (public.is_institution_member(uid, _school) OR staff) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  RETURN QUERY
  WITH c AS (
    SELECT su.user_id u, CASE su.role WHEN 'school_admin' THEN 'administrator' ELSE 'coach' END rel, NULL::text det, 1 ord
      FROM public.school_users su WHERE su.school_id = _school AND su.status = 'active'
    UNION ALL
    SELECT g.user_id, CASE WHEN g.relationship = 'self' THEN 'athlete' ELSE 'guardian' END, a.first_name || ' ' || a.surname, 2
      FROM public.athlete_guardians g JOIN public.athletes a ON a.id = g.athlete_id
      WHERE a.school_id = _school AND (staff OR public.institution_can_see_athlete(uid, _school, a.id))
    UNION ALL
    SELECT r.user_id, CASE WHEN r.role IN ('super_admin','vito_admin') THEN 'vito_admin' ELSE 'clinician' END, NULL, 3
      FROM public.user_roles r WHERE r.role IN ('super_admin','vito_admin','clinical_professional','clinical_supervisor')
  )
  SELECT DISTINCT ON (c.u) c.u, p.full_name, p.avatar_path, c.rel, c.det
  FROM c JOIN public.profiles p ON p.id = c.u
  WHERE c.u <> uid
  ORDER BY c.u, c.ord;
END $function$;
REVOKE EXECUTE ON FUNCTION public.institution_contacts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.institution_contacts(uuid) TO authenticated;