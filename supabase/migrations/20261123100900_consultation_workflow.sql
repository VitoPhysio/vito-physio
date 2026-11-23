alter table public.consultation_requests
  add column requester_user_id uuid references public.profiles(id) on delete set null,
  add column preferred_mode text not null default 'physical',
  add column preferred_details text,
  add column assigned_to uuid references public.profiles(id) on delete set null,
  add column claimed_at timestamptz,
  add column accepted_mode text,
  add column scheduled_at timestamptz,
  add column meeting_details text,
  add column completed_at timestamptz;

alter table public.consultation_requests
  drop constraint if exists consultation_requests_status_check;
update public.consultation_requests set status = 'new' where status = 'contacted';
alter table public.consultation_requests
  add constraint consultation_requests_status_check
  check (status in ('new', 'in_progress', 'confirmed', 'completed', 'closed'));
alter table public.consultation_requests
  add constraint consultation_requests_preferred_mode_check
  check (preferred_mode in ('physical', 'phone', 'google_meet', 'whatsapp_call'));
alter table public.consultation_requests
  add constraint consultation_requests_accepted_mode_check
  check (accepted_mode is null or accepted_mode in ('physical', 'phone', 'google_meet', 'whatsapp_call'));
alter table public.consultation_requests
  add constraint consultation_requests_preferred_details_length
  check (length(coalesce(preferred_details, '')) <= 500);
alter table public.consultation_requests
  add constraint consultation_requests_meeting_details_length
  check (length(coalesce(meeting_details, '')) <= 500);

create index consultation_requests_status_created_idx
  on public.consultation_requests(status, created_at desc);
create index consultation_requests_assigned_idx
  on public.consultation_requests(assigned_to, status, created_at desc);
create index consultation_requests_requester_idx
  on public.consultation_requests(requester_user_id, created_at desc);

-- Keep request ownership/meeting transitions inside guarded RPCs. A staff member
-- claims atomically; after that only that assignee can confirm or complete it.
drop policy if exists "staff manage consultation requests" on public.consultation_requests;
create policy "staff read consultation requests" on public.consultation_requests
  for select to authenticated using (public.is_vito_staff(auth.uid()));
create policy "requesters read own consultation requests" on public.consultation_requests
  for select to authenticated using (requester_user_id = auth.uid());
create policy "athletes create own consultation requests" on public.consultation_requests
  for insert to authenticated with check (
    requester_user_id = auth.uid()
    and status = 'new'
    and assigned_to is null
    and accepted_mode is null
    and scheduled_at is null
    and meeting_details is null
    and completed_at is null
  );
revoke update, delete on public.consultation_requests from authenticated;
grant select, insert on public.consultation_requests to authenticated;

create or replace function public.claim_consultation_request(_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare claimed_count integer;
begin
  if not public.is_vito_staff(auth.uid()) then
    raise exception 'Only VITO staff can claim consultation requests';
  end if;
  update public.consultation_requests
     set assigned_to = auth.uid(), claimed_at = coalesce(claimed_at, now()), status = 'in_progress'
   where id = _id and status = 'new' and assigned_to is null;
  get diagnostics claimed_count = row_count;
  if claimed_count > 0 then return true; end if;
  return exists (
    select 1 from public.consultation_requests
     where id = _id and assigned_to = auth.uid() and status in ('in_progress', 'confirmed')
  );
end;
$$;

create or replace function public.confirm_consultation_meeting(
  _id uuid,
  _accepted_mode text,
  _scheduled_at timestamptz,
  _meeting_details text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare clean_details text := nullif(btrim(_meeting_details), '');
begin
  if not public.is_vito_staff(auth.uid()) then
    raise exception 'Only VITO staff can confirm consultation meetings';
  end if;
  if _accepted_mode is null or _accepted_mode not in ('physical', 'phone', 'google_meet', 'whatsapp_call') then
    raise exception 'Choose a valid meeting mode';
  end if;
  if _scheduled_at is null then raise exception 'Choose a date and time'; end if;
  if clean_details is null or length(clean_details) > 500 then
    raise exception 'Add the location, phone number, or meeting link';
  end if;
  if _accepted_mode = 'google_meet' and clean_details !~* '^https://(meet\.google\.com|calendar\.google\.com)/' then
    raise exception 'Enter a valid Google Meet or Calendar link';
  end if;
  update public.consultation_requests
     set accepted_mode = _accepted_mode,
         scheduled_at = _scheduled_at,
         meeting_details = clean_details,
         status = 'confirmed'
   where id = _id and assigned_to = auth.uid() and status in ('in_progress', 'confirmed');
  if not found then raise exception 'This request is not assigned to you or is no longer active'; end if;
  return true;
end;
$$;

create or replace function public.complete_consultation_request(_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_vito_staff(auth.uid()) then
    raise exception 'Only VITO staff can complete consultation requests';
  end if;
  update public.consultation_requests
     set status = 'completed', completed_at = now()
   where id = _id and assigned_to = auth.uid() and status = 'confirmed';
  if not found then raise exception 'Only your confirmed consultations can be marked successful'; end if;
  return true;
end;
$$;

create or replace function public.close_consultation_request(_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_vito_staff(auth.uid()) then
    raise exception 'Only VITO staff can close consultation requests';
  end if;
  update public.consultation_requests
     set status = 'closed'
   where id = _id and assigned_to = auth.uid() and status in ('in_progress', 'confirmed');
  if not found then raise exception 'This request is not assigned to you or is no longer active'; end if;
  return true;
end;
$$;

revoke all on function public.claim_consultation_request(uuid) from public, anon;
revoke all on function public.confirm_consultation_meeting(uuid, text, timestamptz, text) from public, anon;
revoke all on function public.complete_consultation_request(uuid) from public, anon;
revoke all on function public.close_consultation_request(uuid) from public, anon;
grant execute on function public.claim_consultation_request(uuid) to authenticated;
grant execute on function public.confirm_consultation_meeting(uuid, text, timestamptz, text) to authenticated;
grant execute on function public.complete_consultation_request(uuid) to authenticated;
grant execute on function public.close_consultation_request(uuid) to authenticated;

-- Consultation inbox entries are actionable links into the exact staff workspace item.
create or replace function public.notify_staff_of_consultation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.create_notification(
    ur.user_id,
    'appointments',
    'New consultation request',
    new.contact_name || ' has requested a consultation. Open the request workspace to review the preferred meeting mode and details.',
    'consultation_request',
    new.id,
    null,
    '/dashboard?section=consultations&request=' || new.id::text
  )
  from public.user_roles ur
  where ur.role in ('super_admin', 'vito_admin', 'clinical_professional', 'clinical_supervisor');
  return new;
end;
$$;

create or replace function public.notify_consultation_requester()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.requester_user_id is not null and new.status is distinct from old.status
     and new.status in ('confirmed', 'completed', 'closed') then
    perform public.create_notification(
      new.requester_user_id,
      'appointments',
      case new.status when 'confirmed' then 'Consultation confirmed' when 'completed' then 'Consultation completed' else 'Consultation request closed' end,
      case new.status when 'confirmed' then 'Your clinician confirmed the consultation details.' when 'completed' then 'Your consultation was marked as completed.' else 'Your consultation request has been closed.' end,
      'consultation_status_' || new.status,
      new.id,
      new.assigned_to,
      '/dashboard?section=requests'
    );
  end if;
  return new;
end;
$$;
drop trigger if exists consultation_requester_status_notification on public.consultation_requests;
create trigger consultation_requester_status_notification
  after update on public.consultation_requests
  for each row execute function public.notify_consultation_requester();
