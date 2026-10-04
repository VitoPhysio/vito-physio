create type public.app_role as enum ('super_admin','vito_admin','clinical_professional','clinical_supervisor','school_admin','coach','athlete','parent');

create or replace function public.update_updated_at_column() returns trigger language plpgsql set search_path = public as $$ begin new.updated_at = now(); return new; end; $$;

create table public.profiles (
  id uuid primary key,
  full_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create or replace function public.is_vito_staff(_user_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id
    and role in ('super_admin','vito_admin','clinical_professional','clinical_supervisor')) $$;

create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.is_vito_staff(auth.uid()));
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "own roles read" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.is_vito_staff(auth.uid()));
create trigger profiles_updated before update on public.profiles for each row execute function public.update_updated_at_column();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare req text; r public.app_role;
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email);
  req := new.raw_user_meta_data->>'requested_role';
  if lower(new.email) = 'vitophysio256@gmail.com' then r := 'super_admin';
  elsif req in ('clinical_professional','school_admin','coach','athlete','parent') then r := req::public.app_role;
  else r := 'athlete';
  end if;
  insert into public.user_roles (user_id, role) values (new.id, r);
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create sequence public.school_code_seq;
create sequence public.athlete_code_seq;
create sequence public.injury_code_seq;

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  school_code text not null unique default ('VITO-SCH-' || lpad(nextval('public.school_code_seq')::text, 8, '0')),
  name text not null,
  school_type text not null default 'school',
  location text,
  contact_phone text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.schools to authenticated;
grant all on public.schools to service_role;
alter table public.schools enable row level security;
create policy "staff manage schools" on public.schools for all to authenticated using (public.is_vito_staff(auth.uid())) with check (public.is_vito_staff(auth.uid()));
create trigger schools_updated before update on public.schools for each row execute function public.update_updated_at_column();

create table public.athletes (
  id uuid primary key default gen_random_uuid(),
  athlete_code text not null unique default ('VITO-ATH-' || lpad(nextval('public.athlete_code_seq')::text, 8, '0')),
  first_name text not null,
  surname text not null,
  sport text,
  date_of_birth date,
  school_id uuid references public.schools(id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.athletes to authenticated;
grant all on public.athletes to service_role;
alter table public.athletes enable row level security;
create policy "staff manage athletes" on public.athletes for all to authenticated using (public.is_vito_staff(auth.uid())) with check (public.is_vito_staff(auth.uid()));
create trigger athletes_updated before update on public.athletes for each row execute function public.update_updated_at_column();

create table public.injuries (
  id uuid primary key default gen_random_uuid(),
  injury_code text not null unique default ('VITO-INJ-' || lpad(nextval('public.injury_code_seq')::text, 8, '0')),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  body_region text not null,
  mechanism text,
  injury_date date,
  pain_score int,
  status text not null default 'new',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.injuries to authenticated;
grant all on public.injuries to service_role;
alter table public.injuries enable row level security;
create policy "staff manage injuries" on public.injuries for all to authenticated using (public.is_vito_staff(auth.uid())) with check (public.is_vito_staff(auth.uid()));
create trigger injuries_updated before update on public.injuries for each row execute function public.update_updated_at_column();