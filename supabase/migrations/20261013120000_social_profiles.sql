-- Additive VITO community layer. Clinical and care tables remain untouched.

create table if not exists public.social_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text,
  media_path text,
  parent_post_id uuid references public.social_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(coalesce(body, '')) <= 2000),
  check (length(trim(coalesce(body, ''))) > 0 or media_path is not null),
  check (public.is_valid_photo_path(media_path))
);

create table if not exists public.social_likes (
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.social_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 800),
  created_at timestamptz not null default now()
);

create table if not exists public.social_shares (
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists social_follows_following_idx on public.social_follows(following_id);
create index if not exists social_posts_author_created_idx on public.social_posts(author_id, created_at desc);
create index if not exists social_posts_parent_created_idx on public.social_posts(parent_post_id, created_at desc);
create index if not exists social_comments_post_created_idx on public.social_comments(post_id, created_at asc);
create index if not exists social_likes_post_idx on public.social_likes(post_id);
create index if not exists social_shares_post_idx on public.social_shares(post_id);

create or replace function public.social_can_view_profile(_viewer uuid, _owner uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select _viewer = _owner
    or exists (
      select 1 from public.community_profiles cp
      where cp.user_id = _owner
        and (
          cp.discoverable
          or public.is_connected(_viewer, _owner)
          or public.is_vito_staff(_viewer)
        )
    )
$$;

create or replace function public.social_profile_summary(_user_id uuid)
returns table(
  user_id uuid,
  full_name text,
  avatar_path text,
  cover_path text,
  role text,
  headline text,
  bio text,
  followers_count bigint,
  following_count bigint,
  posts_count bigint,
  is_following boolean
)
language sql stable security definer set search_path = public
as $$
  select p.id,
    p.full_name,
    p.avatar_path,
    cp.cover_path,
    (select r.role::text from public.user_roles r where r.user_id = p.id limit 1),
    cp.headline,
    cp.bio,
    (select count(*) from public.social_follows f where f.following_id = p.id),
    (select count(*) from public.social_follows f where f.follower_id = p.id),
    (select count(*) from public.social_posts sp where sp.author_id = p.id and sp.parent_post_id is null),
    exists (select 1 from public.social_follows f where f.follower_id = auth.uid() and f.following_id = p.id)
  from public.profiles p
  left join public.community_profiles cp on cp.user_id = p.id
  where p.id = _user_id
    and public.social_can_view_profile(auth.uid(), p.id)
$$;

create or replace function public.toggle_social_follow(_following uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare followed boolean;
begin
  if auth.uid() is null or auth.uid() = _following then
    raise exception 'You cannot follow this account';
  end if;
  if not exists (select 1 from public.community_profiles cp where cp.user_id = _following and cp.discoverable) then
    raise exception 'This profile is not available for following';
  end if;
  if exists (select 1 from public.social_follows where follower_id = auth.uid() and following_id = _following) then
    delete from public.social_follows where follower_id = auth.uid() and following_id = _following;
    followed := false;
  else
    insert into public.social_follows (follower_id, following_id) values (auth.uid(), _following);
    followed := true;
  end if;
  return followed;
end;
$$;

create or replace function public.create_social_post(
  _body text default null,
  _media_path text default null,
  _parent_post_id uuid default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare post_id uuid;
begin
  if auth.uid() is null then raise exception 'You must be signed in to post'; end if;
  if length(trim(coalesce(_body, ''))) = 0 and _media_path is null then raise exception 'Add text or a picture before publishing'; end if;
  if length(coalesce(_body, '')) > 2000 then raise exception 'Posts must be 2000 characters or fewer'; end if;
  if not public.is_valid_photo_path(_media_path) then raise exception 'That picture could not be accepted'; end if;
  if _parent_post_id is not null and not exists (
    select 1 from public.social_posts parent
    where parent.id = _parent_post_id and public.social_can_view_profile(auth.uid(), parent.author_id)
  ) then
    raise exception 'That post is not available for replies';
  end if;
  insert into public.social_posts (author_id, body, media_path, parent_post_id)
  values (auth.uid(), nullif(trim(_body), ''), _media_path, _parent_post_id)
  returning id into post_id;
  return post_id;
end;
$$;

create or replace function public.list_social_posts(
  _profile_id uuid default null,
  _tab text default 'feed',
  _limit integer default 30,
  _offset integer default 0
)
returns table(
  id uuid,
  author_id uuid,
  author_name text,
  author_avatar_path text,
  author_role text,
  body text,
  media_path text,
  parent_post_id uuid,
  created_at timestamptz,
  likes_count bigint,
  comments_count bigint,
  shares_count bigint,
  liked boolean,
  shared boolean
)
language sql stable security definer set search_path = public
as $$
  select sp.id,
    sp.author_id,
    p.full_name,
    p.avatar_path,
    (select r.role::text from public.user_roles r where r.user_id = sp.author_id limit 1),
    sp.body,
    sp.media_path,
    sp.parent_post_id,
    sp.created_at,
    (select count(*) from public.social_likes sl where sl.post_id = sp.id),
    (select count(*) from public.social_comments sc where sc.post_id = sp.id),
    (select count(*) from public.social_shares ss where ss.post_id = sp.id),
    exists (select 1 from public.social_likes sl where sl.post_id = sp.id and sl.user_id = auth.uid()),
    exists (select 1 from public.social_shares ss where ss.post_id = sp.id and ss.user_id = auth.uid())
  from public.social_posts sp
  join public.profiles p on p.id = sp.author_id
  where public.social_can_view_profile(auth.uid(), sp.author_id)
    and (
      (_profile_id is not null and sp.author_id = _profile_id and (
        (_tab = 'posts' and sp.parent_post_id is null)
        or (_tab = 'replies' and sp.parent_post_id is not null)
        or (_tab = 'media' and sp.parent_post_id is null and sp.media_path is not null)
      ))
      or (_profile_id is null and _tab = 'feed' and sp.parent_post_id is null and (
        sp.author_id = auth.uid()
        or exists (select 1 from public.social_follows sf where sf.follower_id = auth.uid() and sf.following_id = sp.author_id)
        or exists (select 1 from public.community_profiles cp where cp.user_id = sp.author_id and cp.discoverable)
      ))
    )
  order by sp.created_at desc
  limit greatest(1, least(coalesce(_limit, 30), 60))
  offset greatest(0, coalesce(_offset, 0))
$$;

create or replace function public.toggle_social_like(_post_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare liked boolean;
begin
  if auth.uid() is null or not exists (
    select 1 from public.social_posts sp where sp.id = _post_id and public.social_can_view_profile(auth.uid(), sp.author_id)
  ) then raise exception 'That post is not available'; end if;
  if exists (select 1 from public.social_likes where post_id = _post_id and user_id = auth.uid()) then
    delete from public.social_likes where post_id = _post_id and user_id = auth.uid();
    liked := false;
  else
    insert into public.social_likes (post_id, user_id) values (_post_id, auth.uid());
    liked := true;
  end if;
  return liked;
end;
$$;

create or replace function public.add_social_comment(_post_id uuid, _body text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare comment_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from public.social_posts sp where sp.id = _post_id and public.social_can_view_profile(auth.uid(), sp.author_id)
  ) then raise exception 'That post is not available'; end if;
  if length(trim(coalesce(_body, ''))) not between 1 and 800 then raise exception 'Comments must be between 1 and 800 characters'; end if;
  insert into public.social_comments (post_id, author_id, body) values (_post_id, auth.uid(), trim(_body)) returning id into comment_id;
  return comment_id;
end;
$$;

create or replace function public.list_social_comments(_post_id uuid)
returns table(id uuid, author_id uuid, author_name text, author_avatar_path text, body text, created_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select sc.id, sc.author_id, p.full_name, p.avatar_path, sc.body, sc.created_at
  from public.social_comments sc
  join public.profiles p on p.id = sc.author_id
  join public.social_posts sp on sp.id = sc.post_id
  where sc.post_id = _post_id and public.social_can_view_profile(auth.uid(), sp.author_id)
  order by sc.created_at asc
  limit 100
$$;

create or replace function public.share_social_post(_post_id uuid)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  count_value bigint;
begin
  if auth.uid() is null or not exists (
    select 1 from public.social_posts sp where sp.id = _post_id and public.social_can_view_profile(auth.uid(), sp.author_id)
  ) then raise exception 'That post is not available'; end if;
  insert into public.social_shares (post_id, user_id) values (_post_id, auth.uid()) on conflict do nothing;
  select count(*) into count_value from public.social_shares where post_id = _post_id;
  return count_value;
end;
$$;

create or replace function public.touch_social_post_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists social_posts_updated on public.social_posts;
create trigger social_posts_updated before update on public.social_posts for each row execute function public.touch_social_post_updated_at();

grant select, insert, update, delete on public.social_follows, public.social_posts, public.social_likes, public.social_comments, public.social_shares to authenticated;
grant all on public.social_follows, public.social_posts, public.social_likes, public.social_comments, public.social_shares to service_role;

alter table public.social_follows enable row level security;
alter table public.social_posts enable row level security;
alter table public.social_likes enable row level security;
alter table public.social_comments enable row level security;
alter table public.social_shares enable row level security;

drop policy if exists social_follows_read on public.social_follows;
create policy social_follows_read on public.social_follows for select to authenticated using (auth.uid() in (follower_id, following_id));
drop policy if exists social_follows_insert on public.social_follows;
create policy social_follows_insert on public.social_follows for insert to authenticated with check (follower_id = auth.uid() and following_id <> auth.uid());
drop policy if exists social_follows_delete on public.social_follows;
create policy social_follows_delete on public.social_follows for delete to authenticated using (follower_id = auth.uid());

drop policy if exists social_posts_read on public.social_posts;
create policy social_posts_read on public.social_posts for select to authenticated using (public.social_can_view_profile(auth.uid(), author_id));
drop policy if exists social_posts_insert on public.social_posts;
create policy social_posts_insert on public.social_posts for insert to authenticated with check (author_id = auth.uid());
drop policy if exists social_posts_update on public.social_posts;
create policy social_posts_update on public.social_posts for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists social_posts_delete on public.social_posts;
create policy social_posts_delete on public.social_posts for delete to authenticated using (author_id = auth.uid());

drop policy if exists social_likes_read on public.social_likes;
create policy social_likes_read on public.social_likes for select to authenticated using (exists (select 1 from public.social_posts sp where sp.id = post_id and public.social_can_view_profile(auth.uid(), sp.author_id)));
drop policy if exists social_likes_insert on public.social_likes;
create policy social_likes_insert on public.social_likes for insert to authenticated with check (user_id = auth.uid());
drop policy if exists social_likes_delete on public.social_likes;
create policy social_likes_delete on public.social_likes for delete to authenticated using (user_id = auth.uid());

drop policy if exists social_comments_read on public.social_comments;
create policy social_comments_read on public.social_comments for select to authenticated using (exists (select 1 from public.social_posts sp where sp.id = post_id and public.social_can_view_profile(auth.uid(), sp.author_id)));
drop policy if exists social_comments_insert on public.social_comments;
create policy social_comments_insert on public.social_comments for insert to authenticated with check (author_id = auth.uid());
drop policy if exists social_comments_delete on public.social_comments;
create policy social_comments_delete on public.social_comments for delete to authenticated using (author_id = auth.uid());

drop policy if exists social_shares_read on public.social_shares;
create policy social_shares_read on public.social_shares for select to authenticated using (exists (select 1 from public.social_posts sp where sp.id = post_id and public.social_can_view_profile(auth.uid(), sp.author_id)));
drop policy if exists social_shares_insert on public.social_shares;
create policy social_shares_insert on public.social_shares for insert to authenticated with check (user_id = auth.uid());
drop policy if exists social_shares_delete on public.social_shares;
create policy social_shares_delete on public.social_shares for delete to authenticated using (user_id = auth.uid());

revoke execute on function public.social_can_view_profile(uuid, uuid) from public, anon;
revoke execute on function public.social_profile_summary(uuid) from public, anon;
revoke execute on function public.toggle_social_follow(uuid) from public, anon;
revoke execute on function public.create_social_post(text, text, uuid) from public, anon;
revoke execute on function public.list_social_posts(uuid, text, integer, integer) from public, anon;
revoke execute on function public.toggle_social_like(uuid) from public, anon;
revoke execute on function public.add_social_comment(uuid, text) from public, anon;
revoke execute on function public.list_social_comments(uuid) from public, anon;
revoke execute on function public.share_social_post(uuid) from public, anon;
grant execute on function public.social_can_view_profile(uuid, uuid) to authenticated;
grant execute on function public.social_profile_summary(uuid) to authenticated;
grant execute on function public.toggle_social_follow(uuid) to authenticated;
grant execute on function public.create_social_post(text, text, uuid) to authenticated;
grant execute on function public.list_social_posts(uuid, text, integer, integer) to authenticated;
grant execute on function public.toggle_social_like(uuid) to authenticated;
grant execute on function public.add_social_comment(uuid, text) to authenticated;
grant execute on function public.list_social_comments(uuid) to authenticated;
grant execute on function public.share_social_post(uuid) to authenticated;
