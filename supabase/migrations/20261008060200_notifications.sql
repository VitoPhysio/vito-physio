create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  consultation_request_id uuid references public.consultation_requests(id) on delete cascade,
  title text not null,
  body text not null,
  kind text not null default 'consultation',
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index notifications_consultation_idx on public.notifications(consultation_request_id);

grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;

create policy "users read own notifications" on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy "users update own notifications" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.notify_staff_of_consultation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, consultation_request_id, title, body, kind, data)
  select ur.user_id,
         new.id,
         'New consultation request',
         new.contact_name || ' has requested a consultation.',
         'consultation',
         jsonb_build_object(
           'contact_name', new.contact_name,
           'email', new.email,
           'phone', coalesce(new.phone, ''),
           'organisation_type', new.organisation_type,
           'message', new.message
         )
  from public.user_roles ur
  where ur.role in ('super_admin', 'vito_admin', 'clinical_professional', 'clinical_supervisor');
  return new;
end;
$$;

create trigger consultation_request_staff_notification
  after insert on public.consultation_requests
  for each row execute function public.notify_staff_of_consultation();
