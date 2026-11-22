-- 1. Workspace conversations: same chat engine, kept apart from social direct chats.
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_kind_check;
ALTER TABLE public.conversations ADD CONSTRAINT conversations_kind_check CHECK (kind IN ('direct','group','workspace'));

CREATE OR REPLACE FUNCTION public.ensure_workspace_conversation(_a uuid, _b uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE conv uuid;
BEGIN
  SELECT c.id INTO conv FROM public.conversations c
  JOIN public.conversation_participants p1 ON p1.conversation_id = c.id AND p1.user_id = _a
  JOIN public.conversation_participants p2 ON p2.conversation_id = c.id AND p2.user_id = _b
  WHERE c.kind = 'workspace' AND (SELECT count(*) FROM public.conversation_participants cp WHERE cp.conversation_id = c.id) = 2
  LIMIT 1;
  IF conv IS NULL THEN
    INSERT INTO public.conversations(kind) VALUES ('workspace') RETURNING id INTO conv;
    INSERT INTO public.conversation_participants(conversation_id, user_id) VALUES (conv, _a), (conv, _b);
  END IF;
  RETURN conv;
END $$;
REVOKE ALL ON FUNCTION public.ensure_workspace_conversation(uuid, uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_workspace_conversation(_other_user uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF _other_user IS NULL OR _other_user = _me THEN RAISE EXCEPTION 'Choose another registered user'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _other_user) THEN RAISE EXCEPTION 'User not found'; END IF;
  RETURN public.ensure_workspace_conversation(_me, _other_user);
END $$;
REVOKE ALL ON FUNCTION public.create_workspace_conversation(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_workspace_conversation(uuid) TO authenticated;

-- 2. Athlete requests can go to the VITO clinical team (school_id NULL) or to the athlete's institution.
ALTER TABLE public.care_requests ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS care_requests_school_idx ON public.care_requests(school_id, created_at DESC);

DROP POLICY IF EXISTS "Linked users create requests" ON public.care_requests;
CREATE POLICY "Linked users create requests" ON public.care_requests FOR INSERT TO authenticated
WITH CHECK (
  requester_id = auth.uid() AND status = 'pending'
  AND EXISTS (SELECT 1 FROM public.athlete_guardians g WHERE g.athlete_id = care_requests.athlete_id AND g.user_id = auth.uid())
  AND (school_id IS NULL OR EXISTS (SELECT 1 FROM public.athletes a WHERE a.id = care_requests.athlete_id AND a.school_id = care_requests.school_id))
);

DROP POLICY IF EXISTS "Linked users read own requests" ON public.care_requests;
CREATE POLICY "Linked users read own requests" ON public.care_requests FOR SELECT TO authenticated
USING (
  public.is_vito_staff(auth.uid())
  OR EXISTS (SELECT 1 FROM public.athlete_guardians g WHERE g.athlete_id = care_requests.athlete_id AND g.user_id = auth.uid())
  OR (school_id IS NOT NULL AND public.institution_can_see_athlete(auth.uid(), school_id, athlete_id))
);

CREATE OR REPLACE FUNCTION public.institution_respond_care_request(_id uuid, _status text, _response text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.care_requests;
BEGIN
  IF _status NOT IN ('acknowledged','scheduled','declined','closed') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  IF length(coalesce(_response,'')) > 2000 THEN RAISE EXCEPTION 'Response too long'; END IF;
  SELECT * INTO r FROM public.care_requests WHERE id = _id;
  IF r.id IS NULL OR r.school_id IS NULL OR NOT public.institution_can_see_athlete(auth.uid(), r.school_id, r.athlete_id)
     OR coalesce(public.institution_role(auth.uid(), r.school_id), '') NOT IN ('school_admin','coach') THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  UPDATE public.care_requests SET status = _status, response = nullif(btrim(coalesce(_response,'')),''), handled_by = auth.uid() WHERE id = _id;
END $$;
REVOKE ALL ON FUNCTION public.institution_respond_care_request(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.institution_respond_care_request(uuid, text, text) TO authenticated;

-- 3. Answers to requests arrive in the requester's Workspace inbox as a thread they can reply to.
CREATE OR REPLACE FUNCTION public.notify_care_request_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE conv uuid; responder uuid; msg text;
BEGIN
  IF new.status IS DISTINCT FROM old.status THEN
    responder := coalesce(new.handled_by, auth.uid());
    IF responder IS NOT NULL AND responder <> new.requester_id
       AND EXISTS (SELECT 1 FROM public.profiles WHERE id = responder)
       AND EXISTS (SELECT 1 FROM public.profiles WHERE id = new.requester_id) THEN
      conv := public.ensure_workspace_conversation(responder, new.requester_id);
      msg := left('[' || initcap(replace(new.kind,'_',' ')) || ' request · ' || new.status || ']' || E'\n'
        || coalesce(nullif(new.response,''), 'Your request was updated.') || E'\n\nYour request: ' || new.message, 4000);
      INSERT INTO public.messages(conversation_id, sender_id, body) VALUES (conv, responder, msg);
    ELSE
      PERFORM public.create_notification(new.requester_id, 'appointments',
        'Booking request ' || lower(new.status),
        coalesce(nullif(new.response,''), 'Your care request was updated.'),
        'care_requests', new.id, responder, '/dashboard');
    END IF;
  END IF;
  RETURN new;
END $$;

-- 4. Athlete -> institution messages.
CREATE OR REPLACE FUNCTION public.validate_communication()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
begin
  if length(new.body) > 4000 then raise exception 'Message too long (max 4000 characters)'; end if;
  if new.audience is not null and new.audience not in ('everyone','clinicians','schools','athletes','institution') then raise exception 'Invalid audience'; end if;
  if new.audience = 'institution' and new.school_id is null then raise exception 'Institution messages need an institution'; end if;
  return new; end; $$;

-- 5. Workspace communications are delivered into workspace threads, never social chats.
CREATE OR REPLACE FUNCTION public.mirror_communication_to_chat()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE r uuid; conv uuid; header text; msg text; school_name text; kind_label text; athlete_name text;
BEGIN
  IF NEW.sender_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.sender_id) THEN RETURN NEW; END IF;
  IF NEW.school_id IS NOT NULL THEN SELECT name INTO school_name FROM public.schools WHERE id = NEW.school_id; END IF;
  IF NEW.athlete_id IS NOT NULL THEN SELECT first_name || ' ' || surname INTO athlete_name FROM public.athletes WHERE id = NEW.athlete_id; END IF;
  kind_label := initcap(replace(coalesce(NEW.kind, 'message'), '_', ' '));
  header := CASE
    WHEN NEW.audience IN ('institution','clinicians') AND athlete_name IS NOT NULL
         AND EXISTS (SELECT 1 FROM public.athlete_guardians g WHERE g.user_id = NEW.sender_id AND g.athlete_id = NEW.athlete_id)
      THEN '[Athlete ' || lower(kind_label) || ' · ' || athlete_name || coalesce(' → ' || CASE WHEN NEW.audience = 'institution' THEN school_name END, '') || ']'
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
      SELECT su.user_id FROM public.school_users su WHERE NEW.recipient_id IS NULL AND NEW.audience = 'institution'
        AND su.school_id = NEW.school_id AND su.status = 'active'
        AND (su.role = 'school_admin' OR (su.role = 'coach' AND EXISTS (
          SELECT 1 FROM public.institution_teams t JOIN public.institution_team_athletes ta ON ta.team_id = t.id
          WHERE t.school_id = NEW.school_id AND t.coach_id = su.user_id AND ta.athlete_id = NEW.athlete_id)))
      UNION ALL
      SELECT ur.user_id FROM public.user_roles ur WHERE NEW.recipient_id IS NULL AND (
        (NEW.audience = 'clinicians' AND ur.role IN ('super_admin','vito_admin','clinical_professional','clinical_supervisor'))
        OR (NEW.audience = 'schools' AND ur.role IN ('school_admin','coach'))
        OR (NEW.audience = 'athletes' AND ur.role IN ('athlete','parent'))
        OR NEW.audience = 'everyone')
    ) x WHERE u IS NOT NULL AND u <> NEW.sender_id AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u)
    LIMIT 500
  LOOP
    conv := public.ensure_workspace_conversation(NEW.sender_id, r);
    IF NOT EXISTS (SELECT 1 FROM public.messages m WHERE m.conversation_id = conv AND m.sender_id = NEW.sender_id AND m.body = msg AND m.created_at = now()) THEN
      INSERT INTO public.messages(conversation_id, sender_id, body) VALUES (conv, NEW.sender_id, msg);
    END IF;
  END LOOP;
  RETURN NEW;
END $function$;

-- 6. Move workspace messages already delivered into social chats (same sender + same transaction time as a communication).
DO $$
DECLARE m record; conv uuid; other uuid;
BEGIN
  FOR m IN
    SELECT DISTINCT msg.id, msg.conversation_id, msg.sender_id FROM public.messages msg
    JOIN public.conversations c ON c.id = msg.conversation_id AND c.kind = 'direct'
    JOIN public.communications cm ON cm.sender_id = msg.sender_id AND cm.created_at = msg.created_at
  LOOP
    SELECT user_id INTO other FROM public.conversation_participants WHERE conversation_id = m.conversation_id AND user_id <> m.sender_id LIMIT 1;
    IF other IS NOT NULL THEN
      conv := public.ensure_workspace_conversation(m.sender_id, other);
      UPDATE public.messages SET conversation_id = conv WHERE id = m.id;
      UPDATE public.conversations SET last_message_at = greatest(last_message_at, (SELECT created_at FROM public.messages WHERE id = m.id)) WHERE id = conv;
    END IF;
  END LOOP;
END $$;