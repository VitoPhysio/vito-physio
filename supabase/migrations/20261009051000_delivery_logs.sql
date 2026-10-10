create table public.delivery_logs (
  id uuid primary key default gen_random_uuid(),
  consultation_request_id uuid references public.consultation_requests(id) on delete cascade,
  recipient_user_id uuid references auth.users(id) on delete set null,
  source text not null default 'consultation' check (source in ('consultation', 'admin_email')),
  channel text not null check (channel in ('email', 'whatsapp')),
  subject text,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  constraint delivery_logs_source_reference_check check (
    (source = 'consultation' and consultation_request_id is not null)
    or (source = 'admin_email' and consultation_request_id is null)
  )
);

create index delivery_logs_created_at_idx on public.delivery_logs(created_at desc);
create index delivery_logs_request_channel_idx on public.delivery_logs(consultation_request_id, channel);
create index delivery_logs_recipient_idx on public.delivery_logs(recipient_user_id, created_at desc);

grant select on public.delivery_logs to authenticated;
grant all on public.delivery_logs to service_role;
alter table public.delivery_logs enable row level security;
create policy "staff read delivery logs" on public.delivery_logs for select to authenticated using (public.is_vito_staff(auth.uid()));
