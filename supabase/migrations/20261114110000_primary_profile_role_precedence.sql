-- Keep profile identity selection deterministic for users with more than one role.
-- VITO administrators represent VITO Physio; school administrators represent their institution.

create or replace function public.social_profile_summary(_user_id uuid)
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
    case
      when (
        select r.role::text
        from public.user_roles r
        where r.user_id = p.id
        order by case r.role::text
          when 'super_admin' then 1
          when 'vito_admin' then 1
          when 'school_admin' then 2
          when 'clinical_professional' then 3
          when 'clinical_supervisor' then 3
          when 'coach' then 4
          when 'athlete' then 5
          when 'parent' then 6
          else 7
        end, r.role::text, r.id
        limit 1
      ) in ('super_admin', 'vito_admin') then 'VITO Physio'
      when (
        select r.role::text
        from public.user_roles r
        where r.user_id = p.id
        order by case r.role::text
          when 'super_admin' then 1
          when 'vito_admin' then 1
          when 'school_admin' then 2
          when 'clinical_professional' then 3
          when 'clinical_supervisor' then 3
          when 'coach' then 4
          when 'athlete' then 5
          when 'parent' then 6
          else 7
        end, r.role::text, r.id
        limit 1
      ) = 'school_admin' then coalesce(
        nullif(btrim(s.name), ''),
        nullif(btrim(cp.school_name), ''),
        'Institution profile'
      )
      else p.full_name
    end,
    p.avatar_path,
    cp.cover_path,
    (
      select r.role::text
      from public.user_roles r
      where r.user_id = p.id
      order by case r.role::text
        when 'super_admin' then 1
        when 'vito_admin' then 1
        when 'school_admin' then 2
        when 'clinical_professional' then 3
        when 'clinical_supervisor' then 3
        when 'coach' then 4
        when 'athlete' then 5
        when 'parent' then 6
        else 7
      end, r.role::text, r.id
      limit 1
    ),
    cp.headline,
    cp.bio,
    cp.sport,
    cp.position,
    coalesce(s.name, cp.school_name),
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
  left join public.schools s on s.id = cp.school_id
  where p.id = _user_id
    and public.social_can_view_profile(auth.uid(), p.id)
$$;

create or replace function public.get_messaging_member_profile(_user_id uuid)
returns table(
  id uuid,
  full_name text,
  avatar_path text,
  cover_path text,
  role text,
  headline text,
  sport text,
  "position" text,
  school text,
  school_id uuid,
  school_verified boolean,
  team text,
  visibility text
)
language sql stable security definer set search_path = public as $$
  select
    p.id,
    case
      when (
        select r.role::text
        from public.user_roles r
        where r.user_id = p.id
        order by case r.role::text
          when 'super_admin' then 1
          when 'vito_admin' then 1
          when 'school_admin' then 2
          when 'clinical_professional' then 3
          when 'clinical_supervisor' then 3
          when 'coach' then 4
          when 'athlete' then 5
          when 'parent' then 6
          else 7
        end, r.role::text, r.id
        limit 1
      ) in ('super_admin', 'vito_admin') then 'VITO Physio'
      when (
        select r.role::text
        from public.user_roles r
        where r.user_id = p.id
        order by case r.role::text
          when 'super_admin' then 1
          when 'vito_admin' then 1
          when 'school_admin' then 2
          when 'clinical_professional' then 3
          when 'clinical_supervisor' then 3
          when 'coach' then 4
          when 'athlete' then 5
          when 'parent' then 6
          else 7
        end, r.role::text, r.id
        limit 1
      ) = 'school_admin' then coalesce(
        nullif(btrim(s.name), ''),
        nullif(btrim(cp.school_name), ''),
        'Institution profile'
      )
      else p.full_name
    end,
    p.avatar_path,
    cp.cover_path,
    (
      select r.role::text
      from public.user_roles r
      where r.user_id = p.id
      order by case r.role::text
        when 'super_admin' then 1
        when 'vito_admin' then 1
        when 'school_admin' then 2
        when 'clinical_professional' then 3
        when 'clinical_supervisor' then 3
        when 'coach' then 4
        when 'athlete' then 5
        when 'parent' then 6
        else 7
      end, r.role::text, r.id
      limit 1
    ),
    cp.headline,
    cp.sport,
    cp.position,
    coalesce(s.name, cp.school_name),
    cp.school_id,
    (cp.school_id is not null and (
      exists (
        select 1
        from public.athlete_guardians ag
        join public.athletes a on a.id = ag.athlete_id
        where ag.user_id = p.id and ag.relationship = 'self' and a.school_id = cp.school_id
      )
      or exists (
        select 1
        from public.school_users su
        where su.user_id = p.id and su.school_id = cp.school_id
      )
    )),
    cp.team,
    cp.visibility
  from public.profiles p
  left join public.community_profiles cp on cp.user_id = p.id
  left join public.schools s on s.id = cp.school_id
  where p.id = _user_id
    and (
      p.id = auth.uid()
      or public.is_vito_staff(auth.uid())
      or exists (
        select 1
        from public.conversation_participants mine
        join public.conversation_participants other
          on other.conversation_id = mine.conversation_id
        where mine.user_id = auth.uid()
          and other.user_id = p.id
      )
    );
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
    case
      when primary_role.role in ('super_admin', 'vito_admin') then 'VITO Physio'
      when primary_role.role = 'school_admin' then coalesce(
        nullif(btrim(s.name), ''),
        nullif(btrim(cp.school_name), ''),
        'Institution profile'
      )
      else p.full_name
    end,
    p.avatar_path,
    primary_role.role,
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
  left join public.community_profiles cp on cp.user_id = p.id
  left join public.schools s on s.id = cp.school_id
  left join lateral (
    select r.role::text as role
    from public.user_roles r
    where r.user_id = sp.author_id
    order by case r.role::text
      when 'super_admin' then 1
      when 'vito_admin' then 1
      when 'school_admin' then 2
      when 'clinical_professional' then 3
      when 'clinical_supervisor' then 3
      when 'coach' then 4
      when 'athlete' then 5
      when 'parent' then 6
      else 7
    end, r.role::text, r.id
    limit 1
  ) primary_role on true
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
        or exists (select 1 from public.community_profiles discoverable where discoverable.user_id = sp.author_id and discoverable.discoverable)
      ))
    )
  order by sp.created_at desc
  limit greatest(1, least(coalesce(_limit, 30), 60))
  offset greatest(0, coalesce(_offset, 0))
$$;

create or replace function public.list_social_comments(_post_id uuid)
returns table(id uuid, author_id uuid, author_name text, author_avatar_path text, body text, created_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select sc.id,
    sc.author_id,
    case
      when primary_role.role in ('super_admin', 'vito_admin') then 'VITO Physio'
      when primary_role.role = 'school_admin' then coalesce(
        nullif(btrim(s.name), ''),
        nullif(btrim(cp.school_name), ''),
        'Institution profile'
      )
      else p.full_name
    end,
    p.avatar_path,
    sc.body,
    sc.created_at
  from public.social_comments sc
  join public.profiles p on p.id = sc.author_id
  join public.social_posts sp on sp.id = sc.post_id
  left join public.community_profiles cp on cp.user_id = p.id
  left join public.schools s on s.id = cp.school_id
  left join lateral (
    select r.role::text as role
    from public.user_roles r
    where r.user_id = sc.author_id
    order by case r.role::text
      when 'super_admin' then 1
      when 'vito_admin' then 1
      when 'school_admin' then 2
      when 'clinical_professional' then 3
      when 'clinical_supervisor' then 3
      when 'coach' then 4
      when 'athlete' then 5
      when 'parent' then 6
      else 7
    end, r.role::text, r.id
    limit 1
  ) primary_role on true
  where sc.post_id = _post_id
    and public.social_can_view_profile(auth.uid(), sp.author_id)
  order by sc.created_at asc
  limit 100
$$;

create or replace function public.list_messaging_users(_query text default null)
returns table(id uuid, full_name text, avatar_path text, role text)
language sql stable security definer set search_path = public as $$
  with members as (
    select
      p.id,
      p.avatar_path,
      case
        when primary_role.role in ('super_admin', 'vito_admin') then 'VITO Physio'
        when primary_role.role = 'school_admin' then coalesce(
          nullif(btrim(s.name), ''),
          nullif(btrim(cp.school_name), ''),
          'Institution profile'
        )
        else p.full_name
      end as display_name,
      primary_role.role
    from public.profiles p
    left join public.community_profiles cp on cp.user_id = p.id
    left join public.schools s on s.id = cp.school_id
    left join lateral (
      select r.role::text as role
      from public.user_roles r
      where r.user_id = p.id
      order by case r.role::text
        when 'super_admin' then 1
        when 'vito_admin' then 1
        when 'school_admin' then 2
        when 'clinical_professional' then 3
        when 'clinical_supervisor' then 3
        when 'coach' then 4
        when 'athlete' then 5
        when 'parent' then 6
        else 7
      end, r.role::text, r.id
      limit 1
    ) primary_role on true
    where p.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
      and exists (select 1 from public.user_roles r where r.user_id = p.id)
  )
  select members.id, members.display_name, members.avatar_path, coalesce(members.role, 'athlete')
  from members
  where nullif(trim(_query), '') is null
    or members.display_name ilike '%' || trim(_query) || '%'
  order by lower(trim(coalesce(members.display_name, ''))), members.id
  limit 200;
$$;
