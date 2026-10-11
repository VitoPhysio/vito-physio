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
    p.full_name,
    p.avatar_path,
    cp.cover_path,
    (select r.role::text from public.user_roles r where r.user_id = p.id order by r.id limit 1),
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

revoke execute on function public.get_messaging_member_profile(uuid) from public, anon;
grant execute on function public.get_messaging_member_profile(uuid) to authenticated;
