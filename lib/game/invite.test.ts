import { describe, expect, it } from 'vitest';
import {
	INVITE_CODE_LENGTH,
	generateInviteCode,
	isValidInviteCode,
	normalizeInviteCode,
} from './invite';

describe('generateInviteCode', () => {
	it('has the right length and no ambiguous characters', () => {
		for (let i = 0; i < 200; i++) {
			const code = generateInviteCode();
			expect(code).toHaveLength(INVITE_CODE_LENGTH);
			expect(code).not.toMatch(/[0O1IL]/);
			expect(isValidInviteCode(code)).toBe(true);
		}
	});

	it('is deterministic with an injected source', () => {
		expect(generateInviteCode(() => 0)).toBe('AAAAAA');
	});
});

describe('normalizeInviteCode', () => {
	it('trims and uppercases', () => {
		expect(normalizeInviteCode('  h0us12 ')).toBe('H0US12');
	});
});

describe('isValidInviteCode', () => {
	it('rejects wrong length and bad characters', () => {
		expect(isValidInviteCode('ABC')).toBe(false);
		expect(isValidInviteCode('ABCDE0')).toBe(false);
		expect(isValidInviteCode('ABCDEF')).toBe(true);
	});
});
