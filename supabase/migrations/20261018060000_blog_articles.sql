create table public.blog_articles (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 4 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  excerpt text not null default '' check (char_length(excerpt) <= 260),
  content_markdown text not null default '',
  category text not null default 'Clinical insights',
  cover_image_url text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default 'VITO Physio team',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(content_markdown) <= 100000)
);

create index blog_articles_published_at_idx
  on public.blog_articles (published_at desc nulls last)
  where status = 'published';
create index blog_articles_category_idx
  on public.blog_articles (category, published_at desc nulls last)
  where status = 'published';
create index blog_articles_author_drafts_idx
  on public.blog_articles (author_id, updated_at desc)
  where status = 'draft';

create or replace function public.can_write_blog()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = auth.uid()
      and r.role in ('super_admin', 'vito_admin', 'clinical_professional', 'clinical_supervisor')
  );
$$;

create or replace function public.is_blog_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = auth.uid()
      and r.role in ('super_admin', 'vito_admin')
  );
$$;

revoke execute on function public.can_write_blog() from public, anon;
revoke execute on function public.is_blog_admin() from public, anon;
grant execute on function public.can_write_blog() to authenticated;
grant execute on function public.is_blog_admin() to authenticated;

grant select, insert, update, delete on public.blog_articles to authenticated;
grant all on public.blog_articles to service_role;
revoke all on public.blog_articles from anon;
alter table public.blog_articles enable row level security;

create or replace function public.sync_blog_author_name()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select coalesce(nullif(trim(p.full_name), ''), 'VITO Physio team')
    into new.author_name
  from public.profiles p
  where p.id = new.author_id;
  new.author_name := coalesce(new.author_name, 'VITO Physio team');
  return new;
end;
$$;

create trigger blog_articles_author_name
  before insert or update on public.blog_articles
  for each row execute function public.sync_blog_author_name();

create policy "authenticated readers see published articles and their drafts"
  on public.blog_articles for select to authenticated
  using (status = 'published' or author_id = auth.uid() or public.is_blog_admin());

create policy "clinicians and administrators can author articles"
  on public.blog_articles for insert to authenticated
  with check (author_id = auth.uid() and public.can_write_blog());

create policy "authors and administrators can update articles"
  on public.blog_articles for update to authenticated
  using ((author_id = auth.uid() and public.can_write_blog()) or public.is_blog_admin())
  with check ((author_id = auth.uid() and public.can_write_blog()) or public.is_blog_admin());

create policy "authors and administrators can delete articles"
  on public.blog_articles for delete to authenticated
  using ((author_id = auth.uid() and public.can_write_blog()) or public.is_blog_admin());

create trigger blog_articles_updated
  before update on public.blog_articles
  for each row execute function public.update_updated_at_column();
