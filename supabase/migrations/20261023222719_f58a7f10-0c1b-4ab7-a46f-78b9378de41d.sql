create or replace function public.can_access_message(_message_id uuid, _user_id uuid default auth.uid()) returns boolean language sql stable security invoker set search_path = public as $$ select _user_id = auth.uid() and exists (select 1 from public.messages m join public.conversation_participants cp on cp.conversation_id=m.conversation_id and cp.user_id=auth.uid() where m.id=_message_id); $$;
create schema if not exists messaging_private;
revoke all on schema messaging_private from public, anon;
grant usage on schema messaging_private to authenticated;
create or replace function messaging_private.delete_message_for_everyone(_message_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare _me uuid := auth.uid();
begin
 if _me is null then raise exception 'Authentication required'; end if;
 update public.messages set body='This message was deleted', deleted_at=now() where id=_message_id and sender_id=_me and deleted_at is null and public.is_conversation_participant(conversation_id,_me);
 if not found then raise exception 'Only the sender can delete this message for everyone'; end if;
 delete from public.message_reactions where message_id=_message_id;
end; $$;
revoke all on function messaging_private.delete_message_for_everyone(uuid) from public, anon;
grant execute on function messaging_private.delete_message_for_everyone(uuid) to authenticated;
create or replace function public.delete_message_for_everyone(_message_id uuid) returns void language sql security invoker set search_path=public as $$ select messaging_private.delete_message_for_everyone(_message_id); $$;