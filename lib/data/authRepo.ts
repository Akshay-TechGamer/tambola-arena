// Auth: guests get an anonymous session; Google users keep their name.

import type { User } from '@supabase/supabase-js';
import { getSupabase } from './supabaseClient';

export async function ensureSignedIn(): Promise<User> {
	const supabase = getSupabase();
	const { data: sessionData } = await supabase.auth.getSession();
	if (sessionData.session) {
		return sessionData.session.user;
	}
	const { data, error } = await supabase.auth.signInAnonymously();
	if (error || !data.user) {
		throw new Error(`Sign-in failed: ${error?.message}`);
	}
	return data.user;
}

export function isGuestUser(user: User): boolean {
	return user.is_anonymous === true;
}

/** A friendly default display name from the user's Google name, else Guest. */
export function suggestedName(user: User): string {
	const metadata = user.user_metadata as Record<string, unknown> | null;
	const raw =
		(typeof metadata?.full_name === 'string' && metadata.full_name) ||
		(typeof metadata?.name === 'string' && metadata.name) ||
		'';
	const cleaned = raw.replace(/\s+/g, ' ').trim().slice(0, 24);
	if (cleaned.length >= 1) {
		return cleaned;
	}
	return `Guest-${user.id.replace(/-/g, '').slice(0, 4)}`;
}
