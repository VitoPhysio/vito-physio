-- 1. Message push queue (separate from general notifications)
create table if not exists public.message_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  recipient_id uuid not null,
  device_token_id uuid not null references public.user_device_tokens(id) on delete cascade,
  status text not null default 'queued',
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  provider_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (message_id, device_token_id)
);
grant all on public.message_push_deliveries to service_role;
alter table public.message_push_deliveries enable row level security;
create index if not exists message_push_deliveries_queue_idx on public.message_push_deliveries(status, next_attempt_at);

alter table public.notification_preferences add column if not exists message_preview_enabled boolean not null default true;

-- 2. Messages enqueue device pushes only; no bell notification rows
create or replace function public.notify_direct_message()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.message_push_deliveries(message_id, recipient_id, device_token_id)
  select new.id, cp.user_id, d.id
  from public.conversation_participants cp
  join public.user_device_tokens d on d.user_id = cp.user_id and d.disabled_at is null
  left join public.notification_preferences np on np.user_id = cp.user_id
  where cp.conversation_id = new.conversation_id
    and cp.user_id <> new.sender_id
    and coalesce(np.push_enabled, true)
    and coalesce(np.messages_enabled, true)
  on conflict do nothing;
  return new;
end $$;

-- 3. General notification pushes never cover chat
create or replace function public.enqueue_notification_push()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.category = 'messages' then return new; end if;
  insert into public.notification_deliveries(notification_id, device_token_id, next_attempt_at)
  select new.id, d.id, now() from public.user_device_tokens d
  where d.user_id = new.user_id and d.disabled_at is null
    and coalesce((select push_enabled from public.notification_preferences where user_id = new.user_id), true)
  on conflict do nothing;
  return new;
end $$;

-- 4. Bell count excludes chat (legacy message rows kept for history)
create or replace function public.notification_badge_count(_user_id uuid)
returns integer language sql stable security definer set search_path to 'public' as $$
  select count(*)::integer from public.notifications
  where user_id = auth.uid() and _user_id = auth.uid() and read_at is null and category <> 'messages';
$$;

create or replace function public.mark_all_notifications_read()
returns integer language plpgsql security definer set search_path to 'public' as $$
declare _count integer;
begin
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and category <> 'messages';
  get diagnostics _count = row_count;
  return _count;
end $$;

-- 5. Unread chat counters (Messages system only)
create or replace function public.conversation_unread_counts()
returns table(conversation_id uuid, unread bigint)
language sql stable security definer set search_path to 'public' as $$
  select cp.conversation_id, count(m.id)
  from public.conversation_participants cp
  join public.messages m on m.conversation_id = cp.conversation_id
  where cp.user_id = auth.uid()
    and m.sender_id <> auth.uid()
    and m.deleted_at is null
    and (cp.last_read_at is null or m.created_at > cp.last_read_at)
    and not exists (select 1 from public.message_hidden h where h.message_id = m.id and h.user_id = auth.uid())
  group by cp.conversation_id;
$$;

create or replace function public.message_unread_count()
returns integer language sql stable security definer set search_path to 'public' as $$
  select coalesce(sum(unread), 0)::integer from public.conversation_unread_counts();
$$;
revoke execute on function public.conversation_unread_counts() from public, anon;
revoke execute on function public.message_unread_count() from public, anon;
grant execute on function public.conversation_unread_counts() to authenticated;
grant execute on function public.message_unread_count() to authenticated;

-- 6. Booking changes / cancellations reach the bell
create or replace function public.notify_appointment_change()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.status is distinct from old.status or new.scheduled_at is distinct from old.scheduled_at then
    insert into public.notifications(user_id,title,body,kind,category,source_type,source_id,actor_id,path,data)
    select g.user_id,
      case when new.status ilike 'cancel%' then 'Appointment cancelled' when new.status is distinct from old.status then 'Appointment ' || lower(new.status) else 'Appointment rescheduled' end,
      'Scheduled for ' || to_char(new.scheduled_at at time zone 'Africa/Kampala', 'DD Mon YYYY HH24:MI') || coalesce(' at ' || new.location, '') || '.',
      'appointments','appointments','appointments',new.id,auth.uid(),'/dashboard',
      jsonb_build_object('athlete_id',new.athlete_id,'appointment_id',new.id,'status',new.status)
    from public.athlete_guardians g
    where g.athlete_id = new.athlete_id and g.user_id is distinct from auth.uid()
      and public.notification_preference_enabled(g.user_id,'appointments');
  end if;
  return new;
end $$;
drop trigger if exists appointment_change_notification on public.appointments;
create trigger appointment_change_notification after update on public.appointments
for each row execute function public.notify_appointment_change();

create or replace function public.notify_care_request_update()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.status is distinct from old.status then
    perform public.create_notification(new.requester_id, 'appointments',
      'Booking request ' || lower(new.status),
      coalesce(nullif(new.response,''), 'Your care request was updated.'),
      'care_requests', new.id, coalesce(new.handled_by, auth.uid()), '/dashboard');
  end if;
  return new;
end $$;
drop trigger if exists care_request_update_notification on public.care_requests;
create trigger care_request_update_notification after update on public.care_requests
for each row execute function public.notify_care_request_update();

revoke execute on function public.notify_appointment_change() from public, anon, authenticated;
revoke execute on function public.notify_care_request_update() from public, anon, authenticated;