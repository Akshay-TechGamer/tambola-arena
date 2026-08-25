import { describe, expect, it } from 'vitest';
import {
	COLS,
	NUMBERS_PER_ROW,
	NUMBERS_PER_TICKET,
	ROWS,
	columnRange,
	generateTicket,
	ticketNumbers,
} from './ticket';

// Deterministic RNG (mulberry32) so tests are reproducible.
function seeded(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

describe('columnRange', () => {
	it('maps columns to the right ranges', () => {
		expect(columnRange(0)).toEqual({ lo: 1, hi: 9 });
		expect(columnRange(1)).toEqual({ lo: 10, hi: 19 });
		expect(columnRange(7)).toEqual({ lo: 70, hi: 79 });
		expect(columnRange(8)).toEqual({ lo: 80, hi: 90 });
	});
});

describe('generateTicket', () => {
	// Run many seeds so structural invariants are well exercised.
	const tickets = Array.from({ length: 200 }, (_, i) => generateTicket(seeded(i + 1)));

	it('is always 3 rows by 9 columns', () => {
		for (const ticket of tickets) {
			expect(ticket).toHaveLength(ROWS);
			for (const row of ticket) {
				expect(row).toHaveLength(COLS);
			}
		}
	});

	it('has exactly 5 numbers per row and 15 total', () => {
		for (const ticket of tickets) {
			for (const row of ticket) {
				expect(row.filter((c) => c !== null)).toHaveLength(NUMBERS_PER_ROW);
			}
			expect(ticketNumbers(ticket)).toHaveLength(NUMBERS_PER_TICKET);
		}
	});

	it('keeps every column within its range and 1..3 numbers', () => {
		for (const ticket of tickets) {
			for (let col = 0; col < COLS; col++) {
				const { lo, hi } = columnRange(col);
				const colNums = [ticket[0][col], ticket[1][col], ticket[2][col]].filter(
					(c): c is number => c !== null,
				);
				expect(colNums.length).toBeGreaterThanOrEqual(1);
				expect(colNums.length).toBeLessThanOrEqual(3);
				for (const n of colNums) {
					expect(n).toBeGreaterThanOrEqual(lo);
					expect(n).toBeLessThanOrEqual(hi);
				}
			}
		}
	});

	it('sorts each column ascending top-to-bottom', () => {
		for (const ticket of tickets) {
			for (let col = 0; col < COLS; col++) {
				const colNums = [ticket[0][col], ticket[1][col], ticket[2][col]].filter(
					(c): c is number => c !== null,
				);
				const sorted = [...colNums].sort((a, b) => a - b);
				expect(colNums).toEqual(sorted);
			}
		}
	});

	it('has no duplicate numbers on a ticket', () => {
		for (const ticket of tickets) {
			const nums = ticketNumbers(ticket);
			expect(new Set(nums).size).toBe(nums.length);
		}
	});
});
