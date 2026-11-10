alter table public.messages
  add column if not exists attachment_path text,
  add column if not exists attachment_name text,
  add column if not exists attachment_content_type text,
  add column if not exists attachment_size integer;

alter table public.messages
  add constraint messages_attachment_metadata_check check (
    (attachment_path is null and attachment_name is null and attachment_content_type is null and attachment_size is null)
    or (
      attachment_path is not null
      and attachment_name is not null
      and attachment_content_type is not null
      and attachment_size is not null
      and attachment_size > 0
      and attachment_size <= 26214400
    )
  );

insert into storage.buckets (id, name, public, file_size_limit)
values ('message-attachments', 'message-attachments', false, 26214400)
on conflict (id) do update set file_size_limit = excluded.file_size_limit, public = false;

create policy "conversation participants read message attachments"
on storage.objects for select to authenticated
using (
  bucket_id = 'message-attachments'
  and public.is_conversation_participant((storage.foldername(name))[1]::uuid)
);

create policy "conversation participants upload message attachments"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'message-attachments'
  and (storage.foldername(name))[2] = auth.uid()::text
  and public.is_conversation_participant((storage.foldername(name))[1]::uuid)
);

create policy "message attachment owners delete their uploads"
on storage.objects for delete to authenticated
using (
  bucket_id = 'message-attachments'
  and (storage.foldername(name))[2] = auth.uid()::text
  and public.is_conversation_participant((storage.foldername(name))[1]::uuid)
);
