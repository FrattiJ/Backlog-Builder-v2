-- HobbyVault Database Schema
-- Run this in the Supabase SQL editor

-- Profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  avatar_url text,
  bio text,
  created_at timestamptz default now() not null
);

-- Entries table
create table if not exists public.entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  hobby_category text not null check (hobby_category in ('games','movies','tv','audiobooks','manga','gundams','sports','art')),
  title text not null,
  status text not null default 'backlog' check (status in ('backlog','in_progress','completed','dropped')),
  rating numeric(3,1) check (rating >= 1 and rating <= 10),
  notes text,
  progress_current integer default 0,
  progress_total integer,
  cover_url text,
  external_id text,
  external_source text,
  metadata jsonb default '{}',
  date_started date,
  date_completed date,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Sessions table
create table if not exists public.sessions (
  id uuid default gen_random_uuid() primary key,
  entry_id uuid references public.entries(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null default current_date,
  duration_minutes integer,
  notes text,
  created_at timestamptz default now() not null
);

-- Indexes
create index if not exists entries_user_id_idx on public.entries(user_id);
create index if not exists entries_hobby_category_idx on public.entries(hobby_category);
create index if not exists entries_status_idx on public.entries(status);
create index if not exists sessions_entry_id_idx on public.sessions(entry_id);
create index if not exists sessions_user_id_idx on public.sessions(user_id);
create index if not exists profiles_username_idx on public.profiles(username);

-- Updated_at trigger
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace trigger entries_updated_at
  before update on public.entries
  for each row execute function public.handle_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.entries enable row level security;
alter table public.sessions enable row level security;

-- Profiles policies
create policy "Profiles are publicly readable"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Entries policies
create policy "Users can read own entries"
  on public.entries for select using (auth.uid() = user_id);

create policy "Users can insert own entries"
  on public.entries for insert with check (auth.uid() = user_id);

create policy "Users can update own entries"
  on public.entries for update using (auth.uid() = user_id);

create policy "Users can delete own entries"
  on public.entries for delete using (auth.uid() = user_id);

-- Public entries policy (for profile pages)
create policy "Public entries readable for completed/in_progress"
  on public.entries for select
  using (
    status in ('completed', 'in_progress')
    and exists (
      select 1 from public.profiles p where p.id = user_id
    )
  );

-- Sessions policies
create policy "Users can read own sessions"
  on public.sessions for select using (auth.uid() = user_id);

create policy "Users can insert own sessions"
  on public.sessions for insert with check (auth.uid() = user_id);

create policy "Users can update own sessions"
  on public.sessions for update using (auth.uid() = user_id);

create policy "Users can delete own sessions"
  on public.sessions for delete using (auth.uid() = user_id);
