-- Migration: claims + winning (Phase 3)
-- Created: 2026-08-25
--
-- Claims are written ONLY by the claim edge function (service role); there is
-- no client insert policy, so a player cannot forge a win. A partial unique
-- index enforces "each pattern is won at most once per game".

create table public.tambola_claims (
	id uuid primary key default gen_random_uuid(),
	game_id uuid not null references public.tambola_games (id) on delete cascade,
	ticket_id uuid not null references public.tambola_tickets (id) on delete cascade,
	user_id uuid not null references auth.users (id),
	username text not null,
	pattern text not null,
	status text not null check (status in ('won', 'bogey')),
	created_at timestamptz not null default now()
);

create index tambola_claims_game_idx on public.tambola_claims (game_id);
create unique index tambola_claims_one_winner
	on public.tambola_claims (game_id, pattern)
	where status = 'won';

alter table public.tambola_claims enable row level security;

create policy "tambola claims readable by everyone"
	on public.tambola_claims for select using (true);
-- No insert/update/delete policy: only the service role (claim edge function)
-- may write claims.

alter publication supabase_realtime add table public.tambola_claims;
