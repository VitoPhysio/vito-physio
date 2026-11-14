-- Older clients may send a default content type even when no attachment is present.
-- Normalize that one orphan field so text messages persist, while the CHECK
-- constraint continues to reject partial attachment metadata.
create or replace function public.normalize_message_attachment_metadata()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.attachment_path is null
    and new.attachment_name is null
    and new.attachment_size is null then
    new.attachment_content_type := null;
  end if;

  return new;
end;
$$;

revoke all on function public.normalize_message_attachment_metadata() from public, anon, authenticated;

drop trigger if exists messages_normalize_attachment_metadata on public.messages;
create trigger messages_normalize_attachment_metadata
before insert or update of attachment_path, attachment_name, attachment_content_type, attachment_size
on public.messages
for each row
execute function public.normalize_message_attachment_metadata();
