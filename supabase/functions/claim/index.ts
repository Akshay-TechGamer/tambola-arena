// Server-authoritative claim verification (anti-cheat).
// A player cannot forge a win: this function re-derives whether the pattern
// is actually complete against the numbers the server has called. Clients
// have no write access to tambola_claims — only this function's service role.
//
// The pattern logic here mirrors lib/game/patterns.ts (kept small and in sync;
// that file has the unit tests).

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: Record<string, unknown>, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...CORS, 'Content-Type': 'application/json' },
	});
}

type Cell = number | null;
type Ticket = Cell[][];

function ticketNumbers(ticket: Ticket): number[] {
	const out: number[] = [];
	for (const row of ticket) {
		for (const cell of row) {
			if (cell !== null) {
				out.push(cell);
			}
		}
	}
	return out;
}

function rowNumbers(ticket: Ticket, row: number): number[] {
	return ticket[row].filter((c): c is number => c !== null);
}

function rowEnds(ticket: Ticket, row: number): number[] {
	const filled = rowNumbers(ticket, row);
	return filled.length === 0 ? [] : [filled[0], filled[filled.length - 1]];
}

function validateClaim(ticket: Ticket, called: Set<number>, pattern: string): boolean {
	const allMarked = (nums: number[]) => nums.every((n) => called.has(n));
	switch (pattern) {
		case 'early_five':
			return ticketNumbers(ticket).filter((n) => called.has(n)).length >= 5;
		case 'top_line':
			return allMarked(rowNumbers(ticket, 0));
		case 'middle_line':
			return allMarked(rowNumbers(ticket, 1));
		case 'bottom_line':
			return allMarked(rowNumbers(ticket, 2));
		case 'four_corners':
			return allMarked([...rowEnds(ticket, 0), ...rowEnds(ticket, 2)]);
		case 'full_house':
			return allMarked(ticketNumbers(ticket));
		default:
			return false;
	}
}

Deno.serve(async (req) => {
	if (req.method === 'OPTIONS') {
		return new Response('ok', { headers: CORS });
	}
	try {
		const { gameID, ticketId, pattern } = await req.json();
		if (typeof gameID !== 'string' || typeof ticketId !== 'string' || typeof pattern !== 'string') {
			return json({ error: 'bad request' }, 400);
		}

		const authClient = createClient(
			Deno.env.get('SUPABASE_URL')!,
			Deno.env.get('SUPABASE_ANON_KEY')!,
			{ global: { headers: { Authorization: req.headers.get('Authorization')! } } },
		);
		const { data: userData } = await authClient.auth.getUser();
		const user = userData?.user;
		if (!user) {
			return json({ error: 'not signed in' }, 401);
		}

		const admin = createClient(
			Deno.env.get('SUPABASE_URL')!,
			Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
		);

		const { data: game } = await admin.from('tambola_games').select().eq('id', gameID).single();
		if (!game || game.status !== 'active') {
			return json({ error: 'game is not active' }, 400);
		}
		if (!(game.enabled_patterns as string[]).includes(pattern)) {
			return json({ error: 'that pattern is not in this game' }, 400);
		}

		const { data: ticket } = await admin
			.from('tambola_tickets')
			.select()
			.eq('id', ticketId)
			.single();
		if (!ticket || ticket.user_id !== user.id || ticket.game_id !== gameID) {
			return json({ error: 'not your ticket' }, 403);
		}

		// already won?
		const { data: existingWin } = await admin
			.from('tambola_claims')
			.select('id')
			.eq('game_id', gameID)
			.eq('pattern', pattern)
			.eq('status', 'won')
			.maybeSingle();
		if (existingWin) {
			return json({ error: 'that prize is already won' }, 409);
		}

		const { data: player } = await admin
			.from('tambola_players')
			.select('username')
			.eq('game_id', gameID)
			.eq('user_id', user.id)
			.maybeSingle();
		const username = player?.username ?? 'Player';

		const called = new Set<number>((game.called_numbers as number[]) ?? []);
		const valid = validateClaim(ticket.numbers as Ticket, called, pattern);
		const status = valid ? 'won' : 'bogey';

		const { error: insertError } = await admin.from('tambola_claims').insert({
			game_id: gameID,
			ticket_id: ticketId,
			user_id: user.id,
			username,
			pattern,
			status,
		});
		if (insertError) {
			// unique winner index tripped — someone won it a moment ago
			return json({ error: 'that prize is already won' }, 409);
		}

		if (valid && pattern === 'full_house') {
			await admin.from('tambola_games').update({ status: 'finished' }).eq('id', gameID);
		}

		return json({ status });
	} catch (error) {
		return json({ error: String(error) }, 500);
	}
});
