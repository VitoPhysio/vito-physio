create table public.blog_bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  article_id uuid not null references public.blog_articles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, article_id)
);

create index blog_bookmarks_article_id_idx on public.blog_bookmarks (article_id);

grant select, insert, delete on public.blog_bookmarks to authenticated;
grant all on public.blog_bookmarks to service_role;
revoke all on public.blog_bookmarks from anon;
alter table public.blog_bookmarks enable row level security;

create policy "read own blog bookmarks"
  on public.blog_bookmarks for select to authenticated
  using (user_id = auth.uid());

create policy "bookmark published articles"
  on public.blog_bookmarks for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.blog_articles a
      where a.id = article_id and a.status = 'published'
    )
  );

create policy "remove own blog bookmarks"
  on public.blog_bookmarks for delete to authenticated
  using (user_id = auth.uid());
