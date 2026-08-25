// Winning-pattern definitions and claim validation — pure logic (AGENTS.md).

import { ROWS, ticketNumbers, type Ticket } from './ticket';

export type PatternID =
	| 'early_five'
	| 'top_line'
	| 'middle_line'
	| 'bottom_line'
	| 'four_corners'
	| 'full_house';

export interface PatternDef {
	id: PatternID;
	label: string;
	description: string;
}

export const PATTERNS: readonly PatternDef[] = [
	{ id: 'early_five', label: 'Early Five', description: 'First to mark any 5 numbers' },
	{ id: 'top_line', label: 'Top Line', description: 'All numbers in the top row' },
	{ id: 'middle_line', label: 'Middle Line', description: 'All numbers in the middle row' },
	{ id: 'bottom_line', label: 'Bottom Line', description: 'All numbers in the bottom row' },
	{ id: 'four_corners', label: 'Four Corners', description: 'Corner numbers of the ticket' },
	{ id: 'full_house', label: 'Full House', description: 'Every number on the ticket' },
];

export function patternLabel(id: PatternID): string {
	return PATTERNS.find((pattern) => pattern.id === id)?.label ?? id;
}

/** Leftmost and rightmost filled numbers of a row (for corners). */
function rowEnds(ticket: Ticket, row: number): number[] {
	const filled = ticket[row].filter((cell): cell is number => cell !== null);
	if (filled.length === 0) {
		return [];
	}
	return [filled[0], filled[filled.length - 1]];
}

function rowNumbers(ticket: Ticket, row: number): number[] {
	return ticket[row].filter((cell): cell is number => cell !== null);
}

/**
 * True when the ticket satisfies the pattern given the numbers called so far.
 * This is the authority behind server-side claim verification.
 */
export function validateClaim(
	ticket: Ticket,
	calledNumbers: Iterable<number>,
	pattern: PatternID,
): boolean {
	const called = calledNumbers instanceof Set ? calledNumbers : new Set(calledNumbers);
	const allMarked = (numbers: number[]) => numbers.every((n) => called.has(n));

	switch (pattern) {
		case 'early_five':
			return ticketNumbers(ticket).filter((n) => called.has(n)).length >= 5;
		case 'top_line':
			return allMarked(rowNumbers(ticket, 0));
		case 'middle_line':
			return allMarked(rowNumbers(ticket, 1));
		case 'bottom_line':
			return allMarked(rowNumbers(ticket, ROWS - 1));
		case 'four_corners':
			return allMarked([...rowEnds(ticket, 0), ...rowEnds(ticket, ROWS - 1)]);
		case 'full_house':
			return allMarked(ticketNumbers(ticket));
		default:
			return false;
	}
}
