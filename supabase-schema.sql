-- Earnly Arcade backend foundation
-- Apply through Supabase after a project is connected.
-- Reward-bearing balances are designed to be server-authoritative.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Player' check (char_length(display_name) between 1 and 18),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.player_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  xp bigint not null default 0 check (xp >= 0),
  streak integer not null default 0 check (streak >= 0),
  best_scores jsonb not null default '{}'::jsonb,
  achievements jsonb not null default '[]'::jsonb,
  mission_state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  lifetime_earned bigint not null default 0 check (lifetime_earned >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_event_id text not null unique,
  game text not null check (game in (
    'snake','blockDrop','tapRush','memory','dodger','brickBreaker','jungleHopper','towerStack'
  )),
  metric integer not null check (metric >= 0),
  client_created_at timestamptz,
  received_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  validation_note text
);

create table if not exists public.reward_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delta bigint not null,
  source text not null,
  reference_id uuid,
  balance_after bigint not null check (balance_after >= 0),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.player_progress enable row level security;
alter table public.wallets enable row level security;
alter table public.game_submissions enable row level security;
alter table public.reward_ledger enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "progress_select_own"
  on public.player_progress for select
  using (auth.uid() = user_id);

create policy "wallet_select_own"
  on public.wallets for select
  using (auth.uid() = user_id);

create policy "submissions_select_own"
  on public.game_submissions for select
  using (auth.uid() = user_id);

create policy "submissions_insert_own"
  on public.game_submissions for insert
  with check (auth.uid() = user_id);

create policy "ledger_select_own"
  on public.reward_ledger for select
  using (auth.uid() = user_id);

-- Intentionally no client UPDATE policies for wallets, reward_ledger,
-- or authoritative progress. Those mutations should happen in trusted
-- server-side functions after validating a game/reward event.
