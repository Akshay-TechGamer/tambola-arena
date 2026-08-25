import { describe, expect, it } from 'vitest';
import { validateClaim } from './patterns';
import { ticketNumbers, type Ticket } from './ticket';

// A hand-built ticket so we know exactly which numbers sit where.
// Row 0: 3, 27, 45, 61, 88
// Row 1: 7, 33, 52, 70, 81
// Row 2: 9, 40, 55, 74, 90
const TICKET: Ticket = [
	[3, null, 27, null, 45, 61, null, null, 88],
	[7, null, 33, null, 52, null, 70, null, 81],
	[9, null, 40, null, 55, null, 74, null, 90],
];

describe('validateClaim', () => {
	it('early_five needs any five marked', () => {
		expect(validateClaim(TICKET, [3, 27, 45, 61], 'early_five')).toBe(false);
		expect(validateClaim(TICKET, [3, 27, 45, 61, 88], 'early_five')).toBe(true);
		expect(validateClaim(TICKET, [3, 7, 9, 40, 90, 12], 'early_five')).toBe(true);
	});

	it('top_line needs the whole top row', () => {
		expect(validateClaim(TICKET, [3, 27, 45, 61], 'top_line')).toBe(false);
		expect(validateClaim(TICKET, [3, 27, 45, 61, 88], 'top_line')).toBe(true);
	});

	it('middle_line needs the whole middle row', () => {
		expect(validateClaim(TICKET, [7, 33, 52, 70, 81], 'middle_line')).toBe(true);
		expect(validateClaim(TICKET, [7, 33, 52, 70], 'middle_line')).toBe(false);
	});

	it('bottom_line needs the whole bottom row', () => {
		expect(validateClaim(TICKET, [9, 40, 55, 74, 90], 'bottom_line')).toBe(true);
	});

	it('four_corners needs the four extreme numbers', () => {
		// corners: top-left 3, top-right 88, bottom-left 9, bottom-right 90
		expect(validateClaim(TICKET, [3, 88, 9, 90], 'four_corners')).toBe(true);
		expect(validateClaim(TICKET, [3, 88, 9], 'four_corners')).toBe(false);
	});

	it('full_house needs every number', () => {
		const all = ticketNumbers(TICKET);
		expect(validateClaim(TICKET, all, 'full_house')).toBe(true);
		expect(validateClaim(TICKET, all.slice(1), 'full_house')).toBe(false);
	});

	it('accepts a Set of called numbers too', () => {
		expect(validateClaim(TICKET, new Set([3, 27, 45, 61, 88]), 'top_line')).toBe(true);
	});
});
