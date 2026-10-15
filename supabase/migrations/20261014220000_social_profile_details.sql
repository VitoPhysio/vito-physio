drop function if exists public.social_profile_summary(uuid);

create function public.social_profile_summary(_user_id uuid)
returns table(
  user_id uuid,
  full_name text,
  avatar_path text,
  cover_path text,
  role text,
  headline text,
  bio text,
  sport text,
  player_position text,
  school_name text,
  team text,
  interests text[],
  skills text[],
  district text,
  country text,
  followers_count bigint,
  following_count bigint,
  posts_count bigint,
  is_following boolean
)
language sql stable security definer set search_path = public
as $$
  select
    p.id,
    p.full_name,
    p.avatar_path,
    cp.cover_path,
    (select r.role::text from public.user_roles r where r.user_id = p.id limit 1),
    cp.headline,
    cp.bio,
    cp.sport,
    cp.position,
    cp.school_name,
    cp.team,
    coalesce(cp.interests, '{}'::text[]),
    coalesce(cp.skills, '{}'::text[]),
    cp.district,
    cp.country,
    (select count(*) from public.social_follows f where f.following_id = p.id),
    (select count(*) from public.social_follows f where f.follower_id = p.id),
    (select count(*) from public.social_posts sp where sp.author_id = p.id and sp.parent_post_id is null),
    exists (
      select 1
      from public.social_follows f
      where f.follower_id = auth.uid() and f.following_id = p.id
    )
  from public.profiles p
  left join public.community_profiles cp on cp.user_id = p.id
  where p.id = _user_id
    and public.social_can_view_profile(auth.uid(), p.id)
$$;

revoke execute on function public.social_profile_summary(uuid) from public, anon;
grant execute on function public.social_profile_summary(uuid) to authenticated;
