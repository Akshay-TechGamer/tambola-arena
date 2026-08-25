'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/data/supabaseClient';
import { isGuestUser, suggestedName } from '@/lib/data/authRepo';

interface View {
	name: string;
	isGuest: boolean;
}

export function AuthButton() {
	const [view, setView] = useState<View | null>(null);

	useEffect(() => {
		const supabase = getSupabase();
		let cancelled = false;
		const refresh = async () => {
			const { data } = await supabase.auth.getSession();
			const user = data.session?.user;
			if (!cancelled) {
				setView(user ? { name: suggestedName(user), isGuest: isGuestUser(user) } : null);
			}
		};
		void refresh();
		const { data: sub } = supabase.auth.onAuthStateChange(() => void refresh());
		return () => {
			cancelled = true;
			sub.subscription.unsubscribe();
		};
	}, []);

	// Google sign-in is disabled for now: this Supabase project is shared and
	// its OAuth redirects to another app (Chowka Bhara). Players use the
	// anonymous guest session (ensureSignedIn) instead. To re-enable, restore
	// the button below and wire up signInWithGoogle again.
	//
	// const signInWithGoogle = () => {
	// 	void getSupabase().auth.signInWithOAuth({
	// 		provider: 'google',
	// 		options: { redirectTo: window.location.href },
	// 	});
	// };

	const signOut = () => {
		void getSupabase()
			.auth.signOut()
			.then(() => setView(null));
	};

	return (
		<div className="auth-box">
			{view && <span className="auth-name">{view.name}</span>}
			{view && !view.isGuest && (
				<button type="button" className="btn btn-small" onClick={signOut}>
					Sign out
				</button>
			)}
		</div>
	);
}
