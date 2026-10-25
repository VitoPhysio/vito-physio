alter table public.message_reactions add column if not exists updated_at timestamptz not null default now();
alter table public.message_hidden add column if not exists created_at timestamptz not null default now(), add column if not exists updated_at timestamptz not null default now();
