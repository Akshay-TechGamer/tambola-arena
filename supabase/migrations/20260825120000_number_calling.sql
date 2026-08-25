-- Migration: server-side number drawing (Phase 2)
-- Created: 2026-08-25
--
-- The draw is a security-definer RPC so the RNG and the no-repeat guarantee
-- live on the server (a client cannot pick its own numbers). Only the host of
-- an active game may draw. Returns the number drawn, or null when all 90 are
-- gone (and marks the game finished).

create or replace function public.tambola_draw_number(p_game_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
	g record;
	picked integer;
begin
	select * into g from tambola_games where id = p_game_id for update;
	if not found or g.host_id <> auth.uid() or g.status <> 'active' then
		return null;
	end if;

	select n into picked
	from generate_series(1, 90) as s(n)
	where not (n = any(g.called_numbers))
	order by random()
	limit 1;

	if picked is null then
		update tambola_games set status = 'finished' where id = p_game_id;
		return null;
	end if;

	update tambola_games
	set called_numbers = array_append(called_numbers, picked),
	    current_number = picked
	where id = p_game_id;

	return picked;
end;
$$;

revoke all on function public.tambola_draw_number(uuid) from public, anon;
grant execute on function public.tambola_draw_number(uuid) to authenticated;
