alter table public.notifications add column if not exists category text not null default 'system';
alter table public.notifications add column if not exists source_type text;
alter table public.notifications add column if not exists source_id uuid;
alter table public.notifications add column if not exists actor_id uuid;
alter table public.notifications add column if not exists actor_name text;
alter table public.notifications add column if not exists actor_avatar_path text;
alter table public.notifications add column if not exists path text;

update public.notifications set category = case kind when 'consultation' then 'appointments' else 'system' end where category = 'system';

create unique index if not exists notifications_event_dedupe_idx on public.notifications(user_id, source_type, source_id) where source_type is not null and source_id is not null;
create index if not exists notifications_category_created_idx on public.notifications(user_id, category, created_at desc);

create table public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  messages_enabled boolean not null default true,
  reactions_enabled boolean not null default true,
  comments_enabled boolean not null default true,
  followers_enabled boolean not null default true,
  mentions_enabled boolean not null default true,
  appointments_enabled boolean not null default true,
  rehabilitation_enabled boolean not null default true,
  push_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.notification_preferences to authenticated;
grant all on public.notification_preferences to service_role;
alter table public.notification_preferences enable row level security;
create policy "users read own notification preferences" on public.notification_preferences for select to authenticated using (user_id = auth.uid());
create policy "users insert own notification preferences" on public.notification_preferences for insert to authenticated with check (user_id = auth.uid());
create policy "users update own notification preferences" on public.notification_preferences for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.user_device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text not null default 'web' check (platform in ('web', 'android', 'ios')),
  last_seen_at timestamptz not null default now(),
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, token)
);
grant select, insert, update, delete on public.user_device_tokens to authenticated;
grant all on public.user_device_tokens to service_role;
alter table public.user_device_tokens enable row level security;
create policy "users manage own device tokens" on public.user_device_tokens for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  device_token_id uuid references public.user_device_tokens(id) on delete set null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'skipped')),
  attempt_count integer not null default 0,
  next_attempt_at timestamptz,
  last_error text,
  provider_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (notification_id, device_token_id)
);
grant select on public.notification_deliveries to authenticated;
grant all on public.notification_deliveries to service_role;
alter table public.notification_deliveries enable row level security;
create policy "users read own notification deliveries" on public.notification_deliveries for select to authenticated using (exists (select 1 from public.notifications n where n.id = notification_id and n.user_id = auth.uid()));

create or replace function public.notification_preference_enabled(_user_id uuid, _category text)
returns boolean language sql stable security definer set search_path = public as $$
  select case _category
    when 'messages' then coalesce((select messages_enabled from public.notification_preferences where user_id = _user_id), true)
    when 'reactions' then coalesce((select reactions_enabled from public.notification_preferences where user_id = _user_id), true)
    when 'comments' then coalesce((select comments_enabled from public.notification_preferences where user_id = _user_id), true)
    when 'followers' then coalesce((select followers_enabled from public.notification_preferences where user_id = _user_id), true)
    when 'mentions' then coalesce((select mentions_enabled from public.notification_preferences where user_id = _user_id), true)
    when 'appointments' then coalesce((select appointments_enabled from public.notification_preferences where user_id = _user_id), true)
    when 'rehabilitation' then coalesce((select rehabilitation_enabled from public.notification_preferences where user_id = _user_id), true)
    else true end;
$$;

create or replace function public.create_notification(_user_id uuid, _category text, _title text, _body text, _source_type text, _source_id uuid, _actor_id uuid, _path text)
returns void language plpgsql security definer set search_path = public as $$
declare _actor_name text; _actor_avatar text;
begin
  if _user_id is null or _user_id = _actor_id then return; end if;
  if not public.notification_preference_enabled(_user_id, _category) then return; end if;
  select full_name, avatar_path into _actor_name, _actor_avatar from public.profiles where id = _actor_id;
  insert into public.notifications (user_id, title, body, kind, category, source_type, source_id, actor_id, actor_name, actor_avatar_path, path, data)
  values (_user_id, _title, _body, _category, _category, _source_type, _source_id, _actor_id, _actor_name, _actor_avatar, _path, jsonb_build_object('actor_id', _actor_id, 'source_type', _source_type, 'source_id', _source_id))
  on conflict (user_id, source_type, source_id) where source_type is not null and source_id is not null do nothing;
end;
$$;

create or replace function public.notify_social_like() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.create_notification((select author_id from public.social_posts where id = new.post_id), 'reactions', 'New reaction', 'Someone reacted to your post.', 'social_like', new.post_id, new.user_id, '/profile#post-' || new.post_id::text);
  return new;
end $$;
create trigger social_like_notification after insert on public.social_likes for each row execute function public.notify_social_like();

create or replace function public.notify_social_comment() returns trigger language plpgsql security definer set search_path = public as $$
declare _post_author uuid;
begin
  select author_id into _post_author from public.social_posts where id = new.post_id;
  perform public.create_notification(_post_author, 'comments', 'New comment', 'Someone commented on your post.', 'social_comment', new.id, new.author_id, '/profile#post-' || new.post_id::text);
  return new;
end $$;
create trigger social_comment_notification after insert on public.social_comments for each row execute function public.notify_social_comment();

create or replace function public.notify_social_follow() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.create_notification(new.following_id, 'followers', 'New follower', 'Someone started following you.', 'social_follow', null, new.follower_id, '/members/' || new.follower_id::text);
  return new;
end $$;
create trigger social_follow_notification after insert on public.social_follows for each row execute function public.notify_social_follow();

create or replace function public.notify_social_share() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.create_notification((select author_id from public.social_posts where id = new.post_id), 'reactions', 'Post shared', 'Someone shared your post.', 'social_share', new.post_id, new.user_id, '/profile#post-' || new.post_id::text);
  return new;
end $$;
create trigger social_share_notification after insert on public.social_shares for each row execute function public.notify_social_share();

create or replace function public.notify_direct_message() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, title, body, kind, category, source_type, source_id, actor_id, actor_name, actor_avatar_path, path, data)
  select cp.user_id, 'New message', 'Open VITO Physio to view this private message.', 'messages', 'messages', 'message', new.id, new.sender_id, p.full_name, p.avatar_path, '/messages?conversation=' || new.conversation_id::text, jsonb_build_object('conversation_id', new.conversation_id)
  from public.conversation_participants cp left join public.profiles p on p.id = new.sender_id
  where cp.conversation_id = new.conversation_id and cp.user_id <> new.sender_id and public.notification_preference_enabled(cp.user_id, 'messages')
  on conflict (user_id, source_type, source_id) where source_type is not null and source_id is not null do nothing;
  return new;
end $$;
create trigger message_notification after insert on public.messages for each row execute function public.notify_direct_message();

create or replace function public.notify_athlete_care() returns trigger language plpgsql security definer set search_path = public as $$
declare _athlete uuid; _source uuid; _kind text; _title text; _path text;
begin
  _athlete := coalesce(new.athlete_id, (select athlete_id from public.injuries where id = new.injury_id));
  _source := new.id; _kind := TG_TABLE_NAME; _title := initcap(replace(TG_TABLE_NAME, '_', ' ')); _path := '/dashboard';
  insert into public.notifications (user_id, title, body, kind, category, source_type, source_id, actor_id, actor_name, actor_avatar_path, path, data)
  select g.user_id, _title, 'A new care update was added to an athlete record.', 'rehabilitation', case when TG_TABLE_NAME = 'appointments' then 'appointments' else 'rehabilitation' end, _kind, _source, new.created_by, p.full_name, p.avatar_path, _path, jsonb_build_object('athlete_id', _athlete, 'injury_id', new.injury_id)
  from public.athlete_guardians g left join public.profiles p on p.id = new.created_by
  where g.athlete_id = _athlete and g.user_id is distinct from new.created_by and public.notification_preference_enabled(g.user_id, case when TG_TABLE_NAME = 'appointments' then 'appointments' else 'rehabilitation' end)
  on conflict (user_id, source_type, source_id) where source_type is not null and source_id is not null do nothing;
  return new;
end $$;
create trigger assessment_care_notification after insert on public.assessments for each row execute function public.notify_athlete_care();
create trigger appointment_care_notification after insert on public.appointments for each row execute function public.notify_athlete_care();
create trigger follow_up_care_notification after insert on public.follow_ups for each row execute function public.notify_athlete_care();
create trigger recovery_care_notification after insert on public.recovery_updates for each row execute function public.notify_athlete_care();

create or replace function public.mark_all_notifications_read()
returns integer language plpgsql security definer set search_path = public as $$
declare _count integer;
begin
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null;
  get diagnostics _count = row_count;
  return _count;
end $$;
revoke execute on function public.mark_all_notifications_read() from public, anon;
grant execute on function public.mark_all_notifications_read() to authenticated;

create or replace function public.notification_badge_count(_user_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select (select count(*)::integer from public.notifications where user_id = _user_id and read_at is null) + coalesce((select count(*)::integer from public.messages m join public.conversation_participants cp on cp.conversation_id = m.conversation_id and cp.user_id = _user_id where m.sender_id <> _user_id and (cp.last_read_at is null or m.created_at > cp.last_read_at) and m.deleted_at is null), 0);
$$;
revoke execute on function public.notification_badge_count(uuid) from public, anon;
grant execute on function public.notification_badge_count(uuid) to authenticated;

do $$ begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end $$;