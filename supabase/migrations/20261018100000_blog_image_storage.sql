insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'blog-images',
  'blog-images',
  true,
  6291456,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "blog writers upload article images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'blog-images'
    and name like 'articles/' || auth.uid()::text || '/%'
    and public.can_write_blog()
  );
