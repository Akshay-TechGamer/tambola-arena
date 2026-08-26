// All tambola_* database access.

import { getSupabase } from './supabaseClient';
import type { Database } from './database.types';
import { generateTicket, type Ticket } from '@/lib/game/ticket';
import type { PatternID } from '@/lib/game/patterns';

export type GameRow = Database['public']['Tables']['tambola_games']['Row'];
export type PlayerRow = Database['public']['Tables']['tambola_players']['Row'];
export type TicketRow = Database['public']['Tables']['tambola_tickets']['Row'];
export type ClaimRow = Database['public']['Tables']['tambola_claims']['Row'];

export interface MyTicket {
	id: string;
	numbers: Ticket;
}

export interface CreateGameInput {
	hostId: string;
	username: string;
	inviteCode: string;
	callMode: 'auto' | 'manual';
	autoIntervalSecs: number;
	patterns: PatternID[];
	autoDaub: boolean;
	entryAmount: number;
	prizeAmounts: Record<string, number>;
}

export async function createGame(input: CreateGameInput): Promise<GameRow> {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('tambola_games')
		.insert({
			host_id: input.hostId,
			invite_code: input.inviteCode,
			call_mode: input.callMode,
			auto_interval_secs: input.autoIntervalSecs,
			enabled_patterns: input.patterns,
			auto_daub: input.autoDaub,
			entry_amount: input.entryAmount,
			prize_amounts: input.prizeAmounts,
		})
		.select()
		.single();
	if (error || !data) {
		throw new Error(`Could not create game: ${error?.message}`);
	}
	// The host is a player too, with the first ticket.
	await addPlayer(data.id, input.hostId, input.username);
	return data;
}

export async function getGame(gameID: string): Promise<GameRow | null> {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('tambola_games')
		.select()
		.eq('id', gameID)
		.maybeSingle();
	if (error) {
		throw new Error(`Could not load game: ${error.message}`);
	}
	return data;
}

export async function findGameByInviteCode(code: string): Promise<GameRow | null> {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('tambola_games')
		.select()
		.eq('invite_code', code.toUpperCase())
		.maybeSingle();
	if (error) {
		throw new Error(`Could not look up code: ${error.message}`);
	}
	return data;
}

/** Adds a player (if not already in) and gives them one ticket. Idempotent. */
export async function addPlayer(gameID: string, userID: string, username: string): Promise<void> {
	const supabase = getSupabase();
	const { data: existing } = await supabase
		.from('tambola_players')
		.select('user_id')
		.eq('game_id', gameID)
		.eq('user_id', userID)
		.maybeSingle();
	if (existing) {
		return;
	}
	const { error: playerError } = await supabase
		.from('tambola_players')
		.insert({ game_id: gameID, user_id: userID, username });
	if (playerError) {
		throw new Error(`Could not join: ${playerError.message}`);
	}
	// NOTE: ticket generated client-side for now; moves server-side when
	// prizes/anti-cheat land (see AGENTS.md).
	const ticket: Ticket = generateTicket();
	const { error: ticketError } = await supabase
		.from('tambola_tickets')
		.insert({ game_id: gameID, user_id: userID, ticket_index: 0, numbers: ticket });
	if (ticketError) {
		throw new Error(`Could not create ticket: ${ticketError.message}`);
	}
}

export async function listPlayers(gameID: string): Promise<PlayerRow[]> {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('tambola_players')
		.select()
		.eq('game_id', gameID)
		.order('joined_at', { ascending: true });
	if (error) {
		throw new Error(`Could not load players: ${error.message}`);
	}
	return data ?? [];
}

export async function startGame(gameID: string): Promise<void> {
	const supabase = getSupabase();
	const { error } = await supabase
		.from('tambola_games')
		.update({ status: 'active' })
		.eq('id', gameID)
		.eq('status', 'waiting');
	if (error) {
		throw new Error(`Could not start game: ${error.message}`);
	}
}

/** Draws the next number via the server RPC. Returns it, or null when done. */
export async function drawNumber(gameID: string): Promise<number | null> {
	const supabase = getSupabase();
	const { data, error } = await supabase.rpc('tambola_draw_number', { p_game_id: gameID });
	if (error) {
		throw new Error(`Could not draw: ${error.message}`);
	}
	return data ?? null;
}

export async function getMyTickets(gameID: string, userID: string): Promise<MyTicket[]> {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('tambola_tickets')
		.select()
		.eq('game_id', gameID)
		.eq('user_id', userID)
		.order('ticket_index', { ascending: true });
	if (error) {
		throw new Error(`Could not load tickets: ${error.message}`);
	}
	return (data ?? []).map((row) => ({ id: row.id, numbers: row.numbers as unknown as Ticket }));
}

export async function listClaims(gameID: string): Promise<ClaimRow[]> {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('tambola_claims')
		.select()
		.eq('game_id', gameID)
		.order('created_at', { ascending: true });
	if (error) {
		throw new Error(`Could not load claims: ${error.message}`);
	}
	return data ?? [];
}

/** Submits a claim for server-side verification. Returns 'won' or 'bogey'. */
export async function claimPattern(
	gameID: string,
	ticketId: string,
	pattern: string,
): Promise<'won' | 'bogey'> {
	const supabase = getSupabase();
	const { data, error } = await supabase.functions.invoke('claim', {
		body: { gameID, ticketId, pattern },
	});
	if (error) {
		let message = 'Claim rejected';
		const context = (error as { context?: Response }).context;
		if (context && typeof context.json === 'function') {
			try {
				const body = (await context.json()) as { error?: string };
				if (body.error) {
					message = body.error;
				}
			} catch {
				// keep generic
			}
		}
		throw new Error(message);
	}
	return (data as { status: 'won' | 'bogey' }).status;
}
