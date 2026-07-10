-- Hobbylog phone-companion schema
-- Run this in the Supabase SQL editor (or let the maintainer apply it as a migration).
-- The desktop app is the source of truth; these two tables are just a mailbox.

-- Pending quick-adds and quick-logs captured on mobile, drained by desktop on launch
create table public.inbox (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('add','log')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

-- Lightweight mirror of desktop entries so the phone can search titles when logging.
-- Desktop rewrites this on each sync.
create table public.library (
  entry_id text primary key,
  title text not null,
  hobby_category text not null,
  status text not null,
  progress_current numeric,
  progress_total numeric,
  priority integer,
  updated_at timestamptz not null default now()
);

alter table public.inbox enable row level security;
alter table public.library enable row level security;

-- The anon key acts as the shared device credential (kept off the public web
-- page; entered once per device). It gets full access to these two tables only.
create policy "anon inbox access" on public.inbox for all to anon using (true) with check (true);
create policy "anon library access" on public.library for all to anon using (true) with check (true);
