create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'direct' check (kind in ('direct', 'group')),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

grant select, insert on public.conversations to authenticated;
grant all on public.conversations to service_role;
alter table public.conversations enable row level security;

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);

grant select, insert, update on public.conversation_participants to authenticated;
grant all on public.conversation_participants to service_role;
alter table public.conversation_participants enable row level security;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete restrict,
  body text not null check (char_length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

grant select, insert, update on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;

create index if not exists conversations_activity_idx on public.conversations(last_message_at desc);
create index if not exists conversation_participants_user_idx on public.conversation_participants(user_id, conversation_id);
create index if not exists messages_conversation_created_idx on public.messages(conversation_id, created_at);

create or replace function public.is_conversation_participant(_conversation_id uuid, _user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = _conversation_id and cp.user_id = _user_id
  );
$$;

revoke execute on function public.is_conversation_participant(uuid, uuid) from public, anon;
grant execute on function public.is_conversation_participant(uuid, uuid) to authenticated;

create policy "participants read conversations" on public.conversations
for select to authenticated using (public.is_conversation_participant(id));

create policy "participants read participant rows" on public.conversation_participants
for select to authenticated using (user_id = auth.uid() or public.is_conversation_participant(conversation_id));

create policy "participants update own read state" on public.conversation_participants
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "participants read messages" on public.messages
for select to authenticated using (public.is_conversation_participant(conversation_id));

create policy "participants send messages" on public.messages
for insert to authenticated
with check (sender_id = auth.uid() and public.is_conversation_participant(conversation_id));

create policy "senders edit messages" on public.messages
for update to authenticated
using (sender_id = auth.uid() and public.is_conversation_participant(conversation_id))
with check (sender_id = auth.uid());

create or replace function public.touch_conversation_after_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation after insert on public.messages
for each row execute function public.touch_conversation_after_message();

create or replace function public.create_direct_conversation(_other_user uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  _conversation uuid;
  _me uuid := auth.uid();
begin
  if _me is null then raise exception 'Authentication required'; end if;
  if _other_user is null or _other_user = _me then raise exception 'Choose another registered user'; end if;
  if not exists (select 1 from public.profiles where id = _other_user) then raise exception 'User not found'; end if;

  select c.id into _conversation
  from public.conversations c
  join public.conversation_participants cp1 on cp1.conversation_id = c.id and cp1.user_id = _me
  join public.conversation_participants cp2 on cp2.conversation_id = c.id and cp2.user_id = _other_user
  where c.kind = 'direct'
    and (select count(*) from public.conversation_participants cp where cp.conversation_id = c.id) = 2
  limit 1;

  if _conversation is null then
    insert into public.conversations(kind) values ('direct') returning id into _conversation;
    insert into public.conversation_participants(conversation_id, user_id)
    values (_conversation, _me), (_conversation, _other_user);
  end if;
  return _conversation;
end;
$$;

revoke execute on function public.create_direct_conversation(uuid) from public, anon;
grant execute on function public.create_direct_conversation(uuid) to authenticated;

create or replace function public.mark_conversation_read(_conversation_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.conversation_participants
  set last_read_at = now()
  where conversation_id = _conversation_id and user_id = auth.uid();
end;
$$;

revoke execute on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.conversations;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.conversation_participants;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;

create or replace function public.list_messaging_users()
returns table(id uuid, full_name text, avatar_path text, role text)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.avatar_path, coalesce(ur.role::text, 'athlete')
  from public.profiles p
  left join lateral (
    select r.role from public.user_roles r where r.user_id = p.id order by r.id limit 1
  ) ur on true
  where p.id <> auth.uid()
    and exists (select 1 from public.user_roles r where r.user_id = p.id)
  order by p.full_name nulls last;
$$;

revoke execute on function public.list_messaging_users() from public, anon;
grant execute on function public.list_messaging_users() to authenticated;

-- Preserve direct staff communications in the new inbox when the migration is applied.
do $$
declare
  row record;
  conversation uuid;
begin
  for row in
    select id, sender_id, recipient_id, body, created_at
    from public.communications
    where recipient_id is not null and sender_id <> recipient_id
  loop
    select c.id into conversation
    from public.conversations c
    join public.conversation_participants a on a.conversation_id = c.id and a.user_id = row.sender_id
    join public.conversation_participants b on b.conversation_id = c.id and b.user_id = row.recipient_id
    where c.kind = 'direct'
      and (select count(*) from public.conversation_participants x where x.conversation_id = c.id) = 2
    limit 1;

    if conversation is null then
      insert into public.conversations(kind, last_message_at)
      values ('direct', row.created_at)
      returning id into conversation;
      insert into public.conversation_participants(conversation_id, user_id)
      values (conversation, row.sender_id), (conversation, row.recipient_id);
    end if;

    insert into public.messages(conversation_id, sender_id, body, created_at)
    select conversation, row.sender_id, row.body, row.created_at
    where not exists (
      select 1 from public.messages m
      where m.conversation_id = conversation
        and m.sender_id = row.sender_id
        and m.body = row.body
        and m.created_at = row.created_at
    );
    conversation := null;
  end loop;
end $$;
