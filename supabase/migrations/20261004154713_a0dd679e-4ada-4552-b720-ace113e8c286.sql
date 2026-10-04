alter table public.schools add column self_registered boolean not null default false, add column intake_notes text;
alter table public.athletes add column athlete_number text, add column self_registered boolean not null default false, add column gender text, add column phone text;
alter table public.injuries add column sport_context text, add column notes text;

create table public.school_users (id uuid primary key default gen_random_uuid(), user_id uuid not null, school_id uuid not null references public.schools(id) on delete cascade, created_at timestamptz not null default now(), unique(user_id, school_id));
create table public.athlete_guardians (id uuid primary key default gen_random_uuid(), user_id uuid not null, athlete_id uuid not null references public.athletes(id) on delete cascade, relationship text, created_at timestamptz not null default now(), unique(user_id, athlete_id));
grant select on public.school_users, public.athlete_guardians to authenticated;
grant all on public.school_users, public.athlete_guardians to service_role;
alter table public.school_users enable row level security;
alter table public.athlete_guardians enable row level security;
create policy "su read" on public.school_users for select to authenticated using (user_id = auth.uid() or public.is_vito_staff(auth.uid()));
create policy "ag read" on public.athlete_guardians for select to authenticated using (user_id = auth.uid() or public.is_vito_staff(auth.uid()));

create or replace function public.can_view_athlete(_user uuid, _athlete uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_vito_staff(_user)
    or exists (select 1 from public.athlete_guardians where user_id = _user and athlete_id = _athlete)
    or exists (select 1 from public.athletes a join public.school_users su on su.school_id = a.school_id where a.id = _athlete and su.user_id = _user) $$;
revoke execute on function public.can_view_athlete(uuid, uuid) from anon;

create policy "linked read athletes" on public.athletes for select to authenticated using (public.can_view_athlete(auth.uid(), id));
create policy "linked read schools" on public.schools for select to authenticated using (exists (select 1 from public.school_users where user_id = auth.uid() and school_id = schools.id));
create policy "linked read injuries" on public.injuries for select to authenticated using (public.can_view_athlete(auth.uid(), athlete_id));

create sequence public.assessment_code_seq;
create sequence public.rehab_code_seq;
create sequence public.referral_code_seq;
create sequence public.appointment_code_seq;

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  assessment_code text not null unique default ('VITO-ASM-' || lpad(nextval('public.assessment_code_seq')::text, 8, '0')),
  injury_id uuid not null references public.injuries(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  assessment_type text, assessment_date date default current_date,
  presenting_complaint text, history text, mechanism text, symptoms text, pain text,
  observation text, range_of_motion text, strength text, balance text, functional_tests text,
  sport_specific_findings text, red_flags text, clinical_impression text, plan text,
  referral_recommendation text, follow_up_date date,
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table public.rehabilitation_plans (
  id uuid primary key default gen_random_uuid(),
  plan_code text not null unique default ('VITO-RHB-' || lpad(nextval('public.rehab_code_seq')::text, 8, '0')),
  injury_id uuid not null references public.injuries(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  goals text, phase text, start_date date, target_return_date date, notes text,
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.rehabilitation_plans(id) on delete cascade,
  injury_id uuid not null references public.injuries(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  name text not null, sets int, reps text, frequency text, instructions text,
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  injury_id uuid not null references public.injuries(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  review_date date not null, pain_score int, progress text, findings text, next_steps text,
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table public.recovery_updates (
  id uuid primary key default gen_random_uuid(),
  injury_id uuid not null references public.injuries(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  status text not null, notes text,
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referral_code text not null unique default ('VITO-REF-' || lpad(nextval('public.referral_code_seq')::text, 8, '0')),
  injury_id uuid references public.injuries(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  referred_to text not null, reason text, status text not null default 'open',
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  appointment_code text not null unique default ('VITO-APT-' || lpad(nextval('public.appointment_code_seq')::text, 8, '0')),
  injury_id uuid references public.injuries(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  scheduled_at timestamptz not null, location text, purpose text, status text not null default 'scheduled',
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table public.clinical_notes (
  id uuid primary key default gen_random_uuid(),
  injury_id uuid not null references public.injuries(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  note text not null,
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  injury_id uuid references public.injuries(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  title text not null, storage_path text not null, file_size bigint,
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now());

do $$ declare t text; begin
  foreach t in array array['assessments','rehabilitation_plans','exercises','follow_ups','recovery_updates','referrals','appointments','clinical_notes','documents'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "staff manage" on public.%I for all to authenticated using (public.is_vito_staff(auth.uid())) with check (public.is_vito_staff(auth.uid()))', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.update_updated_at_column()', t || '_updated', t);
  end loop;
  foreach t in array array['rehabilitation_plans','exercises','follow_ups','recovery_updates','appointments'] loop
    execute format('create policy "linked read" on public.%I for select to authenticated using (public.can_view_athlete(auth.uid(), athlete_id))', t);
  end loop;
end $$;

create or replace function public.mark_injury_assessed() returns trigger language plpgsql security definer set search_path = public as $$
begin update public.injuries set status = 'assessed' where id = new.injury_id and status = 'new'; return new; end; $$;
revoke execute on function public.mark_injury_assessed() from public, anon, authenticated;
create trigger assessments_mark after insert on public.assessments for each row execute function public.mark_injury_assessed();

create table public.communications (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null,
  recipient_id uuid,
  athlete_id uuid references public.athletes(id) on delete cascade,
  school_id uuid references public.schools(id) on delete cascade,
  audience text,
  subject text,
  body text not null,
  created_at timestamptz not null default now());
grant select, insert, delete on public.communications to authenticated;
grant all on public.communications to service_role;
alter table public.communications enable row level security;

create or replace function public.validate_communication() returns trigger language plpgsql set search_path = public as $$
begin
  if length(new.body) > 4000 then raise exception 'Message too long (max 4000 characters)'; end if;
  if new.audience is not null and new.audience not in ('everyone','clinicians','schools','athletes') then raise exception 'Invalid audience'; end if;
  return new; end; $$;
create trigger communications_validate before insert on public.communications for each row execute function public.validate_communication();

create or replace function public.can_read_communication(_user uuid, _c public.communications) returns boolean
language sql stable security definer set search_path = public as $$
  select _c.sender_id = _user or _c.recipient_id = _user
    or (_c.athlete_id is not null and exists (select 1 from public.athlete_guardians where user_id = _user and athlete_id = _c.athlete_id))
    or (_c.school_id is not null and exists (select 1 from public.school_users where user_id = _user and school_id = _c.school_id))
    or _c.audience = 'everyone'
    or (_c.audience = 'clinicians' and public.is_vito_staff(_user))
    or (_c.audience = 'schools' and exists (select 1 from public.user_roles where user_id = _user and role in ('school_admin','coach')))
    or (_c.audience = 'athletes' and exists (select 1 from public.user_roles where user_id = _user and role in ('athlete','parent')))
    or public.has_role(_user, 'super_admin') $$;
revoke execute on function public.can_read_communication(uuid, public.communications) from anon;

create policy "read own comms" on public.communications for select to authenticated using (public.can_read_communication(auth.uid(), communications));
create policy "staff send" on public.communications for insert to authenticated with check (sender_id = auth.uid() and public.is_vito_staff(auth.uid()));
create policy "sender delete" on public.communications for delete to authenticated using (sender_id = auth.uid());

create or replace function public.get_sender_names(_ids uuid[]) returns table(id uuid, full_name text, is_admin boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, exists (select 1 from public.user_roles r where r.user_id = p.id and r.role in ('super_admin','vito_admin'))
  from public.profiles p where p.id = any(_ids) $$;
revoke execute on function public.get_sender_names(uuid[]) from anon;

create policy "staff read documents files" on storage.objects for select to authenticated using (bucket_id = 'case-documents' and public.is_vito_staff(auth.uid()));
create policy "staff upload documents files" on storage.objects for insert to authenticated with check (bucket_id = 'case-documents' and public.is_vito_staff(auth.uid()));
create policy "staff delete documents files" on storage.objects for delete to authenticated using (bucket_id = 'case-documents' and public.is_vito_staff(auth.uid()));