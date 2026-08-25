// Tambola ticket generation — pure logic (see AGENTS.md).
//
// A ticket is a 3×9 grid. Rules:
//   - every row has exactly 5 numbers and 4 blanks (15 numbers total)
//   - column j holds numbers from a fixed range:
//       col 0 -> 1..9, col 1 -> 10..19, ..., col 7 -> 70..79, col 8 -> 80..90
//   - every column holds 1 to 3 numbers
//   - numbers within a column read top-to-bottom in ascending order
//
// A cell is a number, or null for a blank.

export type TicketCell = number | null;
export type Ticket = TicketCell[][]; // [3 rows][9 cols]

export const ROWS = 3;
export const COLS = 9;
export const NUMBERS_PER_ROW = 5;
export const NUMBERS_PER_TICKET = 15;

/** Inclusive [lo, hi] number range for a column. */
export function columnRange(col: number): { lo: number; hi: number } {
	if (col === 0) {
		return { lo: 1, hi: 9 };
	}
	if (col === COLS - 1) {
		return { lo: 80, hi: 90 };
	}
	return { lo: col * 10, hi: col * 10 + 9 };
}

type Rand = () => number;

function pick<T>(items: T[], rand: Rand): T {
	return items[Math.floor(rand() * items.length)];
}

/** How many numbers each column gets: each 1..3, summing to 15. */
function chooseColumnCounts(rand: Rand): number[] {
	const counts = new Array<number>(COLS).fill(1);
	let extra = NUMBERS_PER_TICKET - COLS; // 6 more to distribute
	while (extra > 0) {
		const col = Math.floor(rand() * COLS);
		if (counts[col] < 3) {
			counts[col] += 1;
			extra -= 1;
		}
	}
	return counts;
}

/**
 * Places the column counts into a 3×9 boolean grid so every row has exactly
 * 5 filled cells. A valid layout always exists; random sampling finds one
 * quickly, and we cap attempts as a safety net.
 */
function chooseLayout(counts: number[], rand: Rand): boolean[][] {
	const MAX_ATTEMPTS = 5000;
	for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
		const grid: boolean[][] = [
			new Array<boolean>(COLS).fill(false),
			new Array<boolean>(COLS).fill(false),
			new Array<boolean>(COLS).fill(false),
		];
		const rowFill = [0, 0, 0];
		for (let col = 0; col < COLS; col++) {
			const rows = [0, 1, 2];
			// pick counts[col] distinct rows at random
			const chosen: number[] = [];
			const pool = [...rows];
			for (let k = 0; k < counts[col]; k++) {
				const idx = Math.floor(rand() * pool.length);
				chosen.push(pool.splice(idx, 1)[0]);
			}
			for (const row of chosen) {
				grid[row][col] = true;
				rowFill[row] += 1;
			}
		}
		if (rowFill.every((count) => count === NUMBERS_PER_ROW)) {
			return grid;
		}
	}
	throw new Error('Could not lay out ticket — should never happen');
}

/** Picks `count` distinct numbers from [lo, hi], ascending. */
function pickNumbers(lo: number, hi: number, count: number, rand: Rand): number[] {
	const pool: number[] = [];
	for (let n = lo; n <= hi; n++) {
		pool.push(n);
	}
	const chosen: number[] = [];
	for (let k = 0; k < count; k++) {
		const value = pick(pool, rand);
		chosen.push(value);
		pool.splice(pool.indexOf(value), 1);
	}
	return chosen.sort((a, b) => a - b);
}

/** Generates one valid Tambola ticket. Pass a seeded rand for tests. */
export function generateTicket(rand: Rand = Math.random): Ticket {
	const counts = chooseColumnCounts(rand);
	const layout = chooseLayout(counts, rand);
	const ticket: Ticket = [
		new Array<TicketCell>(COLS).fill(null),
		new Array<TicketCell>(COLS).fill(null),
		new Array<TicketCell>(COLS).fill(null),
	];
	for (let col = 0; col < COLS; col++) {
		const { lo, hi } = columnRange(col);
		const numbers = pickNumbers(lo, hi, counts[col], rand);
		let n = 0;
		for (let row = 0; row < ROWS; row++) {
			if (layout[row][col]) {
				ticket[row][col] = numbers[n];
				n += 1;
			}
		}
	}
	return ticket;
}

/** All numbers on a ticket, in no particular order. */
export function ticketNumbers(ticket: Ticket): number[] {
	const numbers: number[] = [];
	for (const row of ticket) {
		for (const cell of row) {
			if (cell !== null) {
				numbers.push(cell);
			}
		}
	}
	return numbers;
}
