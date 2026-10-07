-- Athlete portal: professional sports network layer.
-- Clinical tables are untouched. Community data lives in its own tables and never
-- references injuries, assessments, notes or documents.

create or replace function public.is_valid_photo_path(_p text) returns boolean
language sql immutable set search_path = public as $$
  select _p is null or _p ~ '^uploads/[0-9a-f-]{36}\.(png|jpg|webp)$' $$;

-- 1. Community profile (sporting identity). Name + photo stay on public.profiles.
create table public.community_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  headline text,
  sport text,
  position text,
  school_id uuid references public.schools(id) on delete set null,
  school_name text,
  team text,
  bio text,
  skills text[] not null default '{}',
  interests text[] not null default '{}',
  cover_path text,
  gallery_paths text[] not null default '{}',
  discoverable boolean not null default true,
  visibility text not null default 'community' check (visibility in ('community', 'connections')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(coalesce(headline, '')) <= 120 and length(coalesce(sport, '')) <= 80 and length(coalesce(position, '')) <= 80),
  check (length(coalesce(school_name, '')) <= 160 and length(coalesce(team, '')) <= 120 and length(coalesce(bio, '')) <= 1500),
  check (coalesce(array_length(skills, 1), 0) <= 20 and coalesce(array_length(interests, 1), 0) <= 20),
  check (coalesce(array_length(gallery_paths, 1), 0) <= 12),
  check (public.is_valid_photo_path(cover_path))
);

create or replace function public.validate_community_profile() returns trigger
language plpgsql set search_path = public as $$
declare p text;
begin
  foreach p in array new.gallery_paths loop
    if not public.is_valid_photo_path(p) then raise exception 'Invalid gallery photo'; end if;
  end loop;
  foreach p in array new.skills || new.interests loop
    if length(p) > 60 then raise exception 'Tags must be 60 characters or fewer'; end if;
  end loop;
  return new;
end; $$;
create trigger community_profiles_validate before insert or update on public.community_profiles for each row execute function public.validate_community_profile();
create trigger community_profiles_updated before update on public.community_profiles for each row execute function public.update_updated_at_column();

-- 2. Connections between members (request → accept; either side may remove).
create table public.connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);
create unique index connections_pair_unique on public.connections (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create or replace function public.is_connected(_a uuid, _b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.connections where status = 'accepted'
    and ((requester_id = _a and addressee_id = _b) or (requester_id = _b and addressee_id = _a))) $$;

create or replace function public.is_discoverable_member(_u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.community_profiles where user_id = _u and discoverable) $$;

-- Who may see a member's detailed community content (bio, achievements, activity).
create or replace function public.can_view_member(_viewer uuid, _owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select _viewer = _owner
    or public.is_connected(_viewer, _owner)
    or exists (select 1 from public.community_profiles where user_id = _owner and visibility = 'community') $$;

-- 3. Achievements shown on the athlete profile.
create table public.athlete_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(title) between 2 and 160),
  detail text check (length(coalesce(detail, '')) <= 600),
  category text not null default 'achievement' check (category in ('achievement', 'competition', 'award', 'selection', 'training')),
  achieved_on date,
  created_at timestamptz not null default now()
);

-- 4. Lightweight activity. Rehab milestones are limited to fixed, non-clinical wording.
create table public.community_activity (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'update' check (kind in ('achievement', 'competition', 'team', 'training', 'milestone', 'update')),
  body text not null check (length(body) between 2 and 500),
  created_at timestamptz not null default now(),
  check (kind <> 'milestone' or body in (
    'Completed my rehabilitation programme',
    'Back in full training',
    'Returned to competition',
    'Reached a recovery milestone'
  ))
);

-- 5. Opportunities (trials, teams, competitions, programmes, scholarships, recruitment).
create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('trial', 'team', 'competition', 'training', 'scholarship', 'recruitment')),
  title text not null check (length(title) between 3 and 160),
  organisation_id uuid references public.schools(id) on delete cascade,
  organiser text check (length(coalesce(organiser, '')) <= 160),
  sport text check (length(coalesce(sport, '')) <= 80),
  location text check (length(coalesce(location, '')) <= 160),
  description text check (length(coalesce(description, '')) <= 2000),
  starts_on date,
  deadline date,
  contact text check (length(coalesce(contact, '')) <= 200),
  published boolean not null default true,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger opportunities_updated before update on public.opportunities for each row execute function public.update_updated_at_column();

-- Grants & RLS
grant select, insert, update, delete on public.community_profiles, public.athlete_achievements, public.community_activity, public.opportunities to authenticated;
grant select, insert, delete on public.connections to authenticated;
grant update (status, responded_at) on public.connections to authenticated;
grant all on public.community_profiles, public.connections, public.athlete_achievements, public.community_activity, public.opportunities to service_role;
alter table public.community_profiles enable row level security;
alter table public.connections enable row level security;
alter table public.athlete_achievements enable row level security;
alter table public.community_activity enable row level security;
alter table public.opportunities enable row level security;

create policy "cp read" on public.community_profiles for select to authenticated using (public.can_view_member(auth.uid(), user_id));
create policy "cp insert own" on public.community_profiles for insert to authenticated with check (user_id = auth.uid());
create policy "cp update own" on public.community_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "cp delete own" on public.community_profiles for delete to authenticated using (user_id = auth.uid());

create policy "conn read" on public.connections for select to authenticated using (auth.uid() in (requester_id, addressee_id));
create policy "conn request" on public.connections for insert to authenticated with check (
  requester_id = auth.uid() and status = 'pending' and responded_at is null
  and public.is_discoverable_member(addressee_id));
create policy "conn accept" on public.connections for update to authenticated using (addressee_id = auth.uid()) with check (addressee_id = auth.uid() and status = 'accepted');
create policy "conn remove" on public.connections for delete to authenticated using (auth.uid() in (requester_id, addressee_id));

create policy "ach read" on public.athlete_achievements for select to authenticated using (public.can_view_member(auth.uid(), user_id));
create policy "ach own" on public.athlete_achievements for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "act read" on public.community_activity for select to authenticated using (public.can_view_member(auth.uid(), author_id));
create policy "act post" on public.community_activity for insert to authenticated with check (author_id = auth.uid());
create policy "act delete" on public.community_activity for delete to authenticated using (author_id = auth.uid());

create policy "opp read" on public.opportunities for select to authenticated using (published or created_by = auth.uid() or public.is_vito_staff(auth.uid()));
create policy "opp post" on public.opportunities for insert to authenticated with check (
  created_by = auth.uid() and (
    public.is_vito_staff(auth.uid())
    or (exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('school_admin', 'coach'))
        and (organisation_id is null or exists (select 1 from public.school_users where user_id = auth.uid() and school_id = organisation_id)))));
create policy "opp manage" on public.opportunities for update to authenticated using (created_by = auth.uid() or public.is_vito_staff(auth.uid())) with check (created_by = auth.uid() or public.is_vito_staff(auth.uid()));
create policy "opp delete" on public.opportunities for delete to authenticated using (created_by = auth.uid() or public.is_vito_staff(auth.uid()));

-- Directory functions: expose only the non-clinical member card for people who joined the community.
create or replace function public.get_member_cards(_ids uuid[]) returns table(
  id uuid, full_name text, avatar_path text, role text, headline text, sport text, "position" text,
  school_id uuid, school text, team text, cover_path text, school_verified boolean, visibility text)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.avatar_path,
    (select r.role::text from public.user_roles r where r.user_id = p.id limit 1),
    cp.headline, cp.sport, cp.position, cp.school_id, coalesce(s.name, cp.school_name), cp.team, cp.cover_path,
    (cp.school_id is not null and (
      exists (select 1 from public.athlete_guardians ag join public.athletes a on a.id = ag.athlete_id
              where ag.user_id = p.id and ag.relationship = 'self' and a.school_id = cp.school_id)
      or exists (select 1 from public.school_users su where su.user_id = p.id and su.school_id = cp.school_id))),
    cp.visibility
  from public.community_profiles cp
  join public.profiles p on p.id = cp.user_id
  left join public.schools s on s.id = cp.school_id
  where cp.user_id = any(_ids)
    and (cp.discoverable or cp.user_id = auth.uid() or public.is_connected(auth.uid(), cp.user_id)) $$;

create or replace function public.discover_members(_role text default null, _q text default null, _sport text default null, _school uuid default null)
returns setof uuid
language sql stable security definer set search_path = public as $$
  select cp.user_id from public.community_profiles cp
  join public.profiles p on p.id = cp.user_id
  left join public.schools s on s.id = cp.school_id
  where cp.discoverable and cp.user_id <> auth.uid()
    and (_role is null or exists (select 1 from public.user_roles r where r.user_id = cp.user_id and r.role::text = _role))
    and (_sport is null or cp.sport ilike '%' || _sport || '%')
    and (_school is null or cp.school_id = _school)
    and (_q is null or concat_ws(' ', p.full_name, cp.sport, cp.position, cp.team, cp.school_name, s.name, cp.headline) ilike '%' || _q || '%')
  order by cp.updated_at desc
  limit 60 $$;

create or replace function public.discover_schools(_q text default null) returns table(
  id uuid, name text, school_type text, location text, logo_path text, member_count bigint, sports text[])
language sql stable security definer set search_path = public as $$
  select s.id, s.name, s.school_type, s.location, s.logo_path,
    (select count(*) from public.community_profiles cp where cp.school_id = s.id and cp.discoverable),
    coalesce((select array_agg(distinct cp.sport) from public.community_profiles cp where cp.school_id = s.id and cp.discoverable and cp.sport is not null), '{}')
  from public.schools s
  where _q is null or concat_ws(' ', s.name, s.location, s.school_type) ilike '%' || _q || '%'
  order by s.name
  limit 100 $$;

revoke execute on function public.is_connected(uuid, uuid) from public, anon;
revoke execute on function public.can_view_member(uuid, uuid) from public, anon;
revoke execute on function public.is_discoverable_member(uuid) from public, anon;
revoke execute on function public.get_member_cards(uuid[]) from public, anon;
revoke execute on function public.discover_members(text, text, text, uuid) from public, anon;
revoke execute on function public.discover_schools(text) from public, anon;
grant execute on function public.is_connected(uuid, uuid) to authenticated;
grant execute on function public.can_view_member(uuid, uuid) to authenticated;
grant execute on function public.is_discoverable_member(uuid) to authenticated;
grant execute on function public.get_member_cards(uuid[]) to authenticated;
grant execute on function public.discover_members(text, text, text, uuid) to authenticated;
grant execute on function public.discover_schools(text) to authenticated;
