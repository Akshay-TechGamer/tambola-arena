// Thin Supabase Realtime interface for one game (see AGENTS.md).

import { getSupabase } from '@/lib/data/supabaseClient';
import type { GameRow, PlayerRow } from '@/lib/data/gamesRepo';

export interface GameChannelHandlers {
	onPlayerJoin?: (player: PlayerRow) => void;
	onGameUpdate?: (game: GameRow) => void;
}

export function subscribeToGame(gameID: string, handlers: GameChannelHandlers): () => void {
	const supabase = getSupabase();
	const channel = supabase
		.channel(`tambola:${gameID}`)
		.on(
			'postgres_changes',
			{ event: 'INSERT', schema: 'public', table: 'tambola_players', filter: `game_id=eq.${gameID}` },
			(payload) => handlers.onPlayerJoin?.(payload.new as PlayerRow),
		)
		.on(
			'postgres_changes',
			{ event: 'UPDATE', schema: 'public', table: 'tambola_games', filter: `id=eq.${gameID}` },
			(payload) => handlers.onGameUpdate?.(payload.new as GameRow),
		)
		.subscribe();
	return () => {
		void supabase.removeChannel(channel);
	};
}
