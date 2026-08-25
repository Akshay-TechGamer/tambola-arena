-- Migration: initial Tambola schema
-- Created: 2026-08-25
-- SHARED Supabase project: every object is prefixed tambola_. Never touch
-- objects without that prefix (chess_*, wishes, game_rooms, ...).

create type public.tambola_game_status as enum ('waiting', 'active', 'finished');
create type public.tambola_call_mode as enum ('auto', 'manual');

-- ============================================================
-- tambola_games
-- ============================================================
create table public.tambola_games (
	id uuid primary key default gen_random_uuid(),
	host_id uuid not null references auth.users (id),
	invite_code text not null unique,
	status public.tambola_game_status not null default 'waiting',
	call_mode public.tambola_call_mode not null default 'manual',
	auto_interval_secs integer not null default 5,
	-- draw order of numbers already called (1..90, no repeats)
	called_numbers integer[] not null default '{}',
	current_number integer,
	enabled_patterns text[] not null default
		'{early_five,top_line,middle_line,bottom_line,four_corners,full_house}',
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index tambola_games_status_idx on public.tambola_games (status);

alter table public.tambola_games enable row level security;

create policy "tambola games readable by everyone"
	on public.tambola_games for select using (true);

create policy "authenticated users create their own games"
	on public.tambola_games for insert
	with check (auth.uid() = host_id);

-- Host may update their game (draws move to a server RPC in a later phase).
create policy "host updates own game"
	on public.tambola_games for update
	using (auth.uid() = host_id);

-- ============================================================
-- tambola_players (unlimited — no cap)
-- ============================================================
create table public.tambola_players (
	game_id uuid not null references public.tambola_games (id) on delete cascade,
	user_id uuid not null references auth.users (id),
	username text not null check (char_length(username) between 1 and 24),
	joined_at timestamptz not null default now(),
	primary key (game_id, user_id)
);

alter table public.tambola_players enable row level security;

create policy "tambola players readable by everyone"
	on public.tambola_players for select using (true);

create policy "users join as themselves"
	on public.tambola_players for insert
	with check (auth.uid() = user_id);

-- ============================================================
-- tambola_tickets (a player may hold more than one)
-- ============================================================
create table public.tambola_tickets (
	id uuid primary key default gen_random_uuid(),
	game_id uuid not null references public.tambola_games (id) on delete cascade,
	user_id uuid not null references auth.users (id),
	ticket_index integer not null default 0,
	-- 3x9 grid of number|null, stored as JSON
	numbers jsonb not null,
	created_at timestamptz not null default now(),
	unique (game_id, user_id, ticket_index)
);

create index tambola_tickets_game_idx on public.tambola_tickets (game_id);

alter table public.tambola_tickets enable row level security;

create policy "tambola tickets readable by everyone"
	on public.tambola_tickets for select using (true);

create policy "users insert their own tickets"
	on public.tambola_tickets for insert
	with check (auth.uid() = user_id);

-- ============================================================
-- updated_at trigger for games
-- ============================================================
create or replace function public.tambola_set_updated_at()
returns trigger language plpgsql as $$
begin
	new.updated_at = now();
	return new;
end;
$$;

create trigger tambola_games_set_updated_at
	before update on public.tambola_games
	for each row execute function public.tambola_set_updated_at();

-- ============================================================
-- Realtime
-- ============================================================
alter publication supabase_realtime add table public.tambola_games;
alter publication supabase_realtime add table public.tambola_players;
alter publication supabase_realtime add table public.tambola_tickets;
