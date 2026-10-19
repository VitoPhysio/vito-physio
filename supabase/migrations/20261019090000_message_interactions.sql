-- WhatsApp-style message interactions: replies, emoji reactions and deletion.

alter table public.messages
  add column if not exists reply_to_id uuid references public.messages(id) on delete set null,
  add column if not exists deleted_at timestamptz;

create index if not exists messages_reply_to_idx on public.messages(reply_to_id);

-- Replies must point at a message in the same conversation.
create or replace function public.validate_message_reply()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.reply_to_id is not null and not exists (
    select 1 from public.messages m
    where m.id = new.reply_to_id and m.conversation_id = new.conversation_id
  ) then
    raise exception 'Replies must reference a message in the same conversation';
  end if;
  return new;
end;
$$;

revoke execute on function public.validate_message_reply() from public, anon, authenticated;

drop trigger if exists messages_validate_reply on public.messages;
create trigger messages_validate_reply before insert or update of reply_to_id on public.messages
for each row execute function public.validate_message_reply();

-- Senders may no longer rewrite rows directly; deletion goes through delete_message_for_everyone.
drop policy if exists "senders edit messages" on public.messages;
revoke update on public.messages from authenticated;

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists message_reactions_user_idx on public.message_reactions(user_id);

grant select, insert, update, delete on public.message_reactions to authenticated;
grant all on public.message_reactions to service_role;
alter table public.message_reactions enable row level security;

create or replace function public.can_access_message(_message_id uuid, _user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.messages m
    join public.conversation_participants cp
      on cp.conversation_id = m.conversation_id and cp.user_id = _user_id
    where m.id = _message_id
  );
$$;

revoke execute on function public.can_access_message(uuid, uuid) from public, anon;
grant execute on function public.can_access_message(uuid, uuid) to authenticated;

create policy message_reactions_read on public.message_reactions for select to authenticated
  using (public.can_access_message(message_id, (select auth.uid())));

create policy message_reactions_insert on public.message_reactions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.can_access_message(message_id, (select auth.uid()))
    and exists (select 1 from public.messages m where m.id = message_id and m.deleted_at is null)
  );

create policy message_reactions_update on public.message_reactions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.can_access_message(message_id, (select auth.uid())));

create policy message_reactions_delete on public.message_reactions for delete to authenticated
  using (user_id = (select auth.uid()));

-- Per-user "delete for me".
create table if not exists public.message_hidden (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists message_hidden_user_idx on public.message_hidden(user_id);

grant select, insert, delete on public.message_hidden to authenticated;
grant all on public.message_hidden to service_role;
alter table public.message_hidden enable row level security;

create policy message_hidden_read on public.message_hidden for select to authenticated
  using (user_id = (select auth.uid()));

create policy message_hidden_insert on public.message_hidden for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_access_message(message_id, (select auth.uid())));

create policy message_hidden_delete on public.message_hidden for delete to authenticated
  using (user_id = (select auth.uid()));

-- "Delete for everyone": only the sender, and the original text is wiped.
create or replace function public.delete_message_for_everyone(_message_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  _me uuid := auth.uid();
begin
  if _me is null then raise exception 'Authentication required'; end if;
  update public.messages
  set body = 'This message was deleted', deleted_at = now()
  where id = _message_id and sender_id = _me and deleted_at is null
    and public.is_conversation_participant(conversation_id, _me);
  if not found then raise exception 'Only the sender can delete this message for everyone'; end if;
  delete from public.message_reactions where message_id = _message_id;
end;
$$;

revoke execute on function public.delete_message_for_everyone(uuid) from public, anon;
grant execute on function public.delete_message_for_everyone(uuid) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.message_reactions;
exception when duplicate_object then null;
end $$;
