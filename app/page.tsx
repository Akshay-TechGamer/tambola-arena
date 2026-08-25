'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ensureSignedIn, suggestedName } from '@/lib/data/authRepo';
import { addPlayer, createGame, findGameByInviteCode } from '@/lib/data/gamesRepo';
import { generateInviteCode, isValidInviteCode, normalizeInviteCode } from '@/lib/game/invite';
import { PATTERNS, type PatternID } from '@/lib/game/patterns';

const AUTO_INTERVALS = [3, 5, 8, 10];

export default function HomePage() {
	const router = useRouter();
	const [username, setUsername] = useState('');
	const [callMode, setCallMode] = useState<'manual' | 'auto'>('manual');
	const [interval, setIntervalSecs] = useState(5);
	const [patterns, setPatterns] = useState<PatternID[]>(PATTERNS.map((p) => p.id));
	const [joinCode, setJoinCode] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Prefill the name once we know who the user is.
	useEffect(() => {
		ensureSignedIn()
			.then((user) => setUsername((current) => current || suggestedName(user)))
			.catch(() => undefined);
	}, []);

	const togglePattern = (id: PatternID) => {
		setPatterns((current) =>
			current.includes(id) ? current.filter((p) => p !== id) : [...current, id],
		);
	};

	const create = async () => {
		const name = username.trim();
		if (!name) {
			setError('Enter a name first');
			return;
		}
		if (patterns.length === 0) {
			setError('Pick at least one winning pattern');
			return;
		}
		setBusy(true);
		setError(null);
		try {
			const user = await ensureSignedIn();
			const game = await createGame({
				hostId: user.id,
				username: name,
				inviteCode: generateInviteCode(),
				callMode,
				autoIntervalSecs: interval,
				patterns,
			});
			router.push(`/game/${game.id}`);
		} catch (createError) {
			setError(createError instanceof Error ? createError.message : 'Could not create game');
			setBusy(false);
		}
	};

	const join = async () => {
		const name = username.trim();
		if (!name) {
			setError('Enter a name first');
			return;
		}
		const code = normalizeInviteCode(joinCode);
		if (!isValidInviteCode(code)) {
			setError('Codes are 6 letters/numbers, e.g. HOUS12');
			return;
		}
		setBusy(true);
		setError(null);
		try {
			const user = await ensureSignedIn();
			const game = await findGameByInviteCode(code);
			if (!game) {
				setError('No game found with that code.');
				setBusy(false);
				return;
			}
			await addPlayer(game.id, user.id, name);
			router.push(`/game/${game.id}`);
		} catch (joinError) {
			setError(joinError instanceof Error ? joinError.message : 'Could not join');
			setBusy(false);
		}
	};

	return (
		<div className="home">
			<h1 className="home-title">🎡 Tambola Arena</h1>
			<p className="home-tag">Play Housie online with friends. Unlimited players. Free.</p>

			<label className="field">
				<span className="field-label">Your name</span>
				<input
					className="text-input"
					value={username}
					onChange={(e) => setUsername(e.target.value)}
					placeholder="Your name"
					maxLength={24}
				/>
			</label>

			<div className="panels">
				<section className="panel">
					<h2 className="panel-title">Host a game</h2>

					<span className="field-label">Number calling</span>
					<div className="chip-row">
						<button
							type="button"
							className={`chip${callMode === 'manual' ? ' chip-on' : ''}`}
							onClick={() => setCallMode('manual')}
						>
							Manual (host clicks)
						</button>
						<button
							type="button"
							className={`chip${callMode === 'auto' ? ' chip-on' : ''}`}
							onClick={() => setCallMode('auto')}
						>
							Auto
						</button>
					</div>

					{callMode === 'auto' && (
						<>
							<span className="field-label">Seconds per number</span>
							<div className="chip-row">
								{AUTO_INTERVALS.map((secs) => (
									<button
										key={secs}
										type="button"
										className={`chip${interval === secs ? ' chip-on' : ''}`}
										onClick={() => setIntervalSecs(secs)}
									>
										{secs}s
									</button>
								))}
							</div>
						</>
					)}

					<span className="field-label">Winning patterns</span>
					<div className="chip-row chip-wrap">
						{PATTERNS.map((pattern) => (
							<button
								key={pattern.id}
								type="button"
								className={`chip${patterns.includes(pattern.id) ? ' chip-on' : ''}`}
								onClick={() => togglePattern(pattern.id)}
								title={pattern.description}
							>
								{pattern.label}
							</button>
						))}
					</div>

					<button type="button" className="btn btn-primary btn-block" onClick={create} disabled={busy}>
						{busy ? 'Creating…' : 'Create game'}
					</button>
				</section>

				<section className="panel">
					<h2 className="panel-title">Join a game</h2>
					<span className="field-label">Invite code</span>
					<input
						className="text-input code-input"
						value={joinCode}
						onChange={(e) => setJoinCode(e.target.value)}
						onKeyDown={(e) => e.key === 'Enter' && join()}
						placeholder="HOUS12"
						maxLength={6}
					/>
					<button type="button" className="btn btn-block" onClick={join} disabled={busy}>
						{busy ? 'Joining…' : 'Join game'}
					</button>
				</section>
			</div>

			{error && <p className="form-error">⚠ {error}</p>}
		</div>
	);
}
