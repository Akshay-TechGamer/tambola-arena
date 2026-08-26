'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ensureSignedIn, suggestedName } from '@/lib/data/authRepo';
import { addPlayer, createGame, findGameByInviteCode } from '@/lib/data/gamesRepo';
import { generateInviteCode, isValidInviteCode, normalizeInviteCode } from '@/lib/game/invite';
import { PATTERNS, type PatternID } from '@/lib/game/patterns';
import { BottomSheet } from '@/components/BottomSheet';

const AUTO_INTERVALS = [3, 5, 8, 10];

export default function HomePage() {
	const router = useRouter();
	const [username, setUsername] = useState('');
	const [callMode, setCallMode] = useState<'manual' | 'auto'>('manual');
	const [interval, setIntervalSecs] = useState(5);
	const [patterns, setPatterns] = useState<PatternID[]>(PATTERNS.map((p) => p.id));
	const [autoDaub, setAutoDaub] = useState(false);
	const [entryAmount, setEntryAmount] = useState(0);
	const [prizeAmounts, setPrizeAmounts] = useState<Record<string, number>>({});
	const [joinCode, setJoinCode] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [configOpen, setConfigOpen] = useState(false);

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
			setError('Pick at least one winning pattern in Configure');
			setConfigOpen(true);
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
				autoDaub,
				entryAmount,
				prizeAmounts,
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

	const configSummary = `${callMode === 'auto' ? `Auto · ${interval}s` : 'Manual'} · ${patterns.length}/${PATTERNS.length} patterns · Auto-mark ${autoDaub ? 'on' : 'off'}`;

	return (
		<div className="home">
			<h1 className="home-title">🎡 Tambola Arena</h1>
			<p className="home-tag">Play Housie online. Unlimited players. Free.</p>

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
					<button
						type="button"
						className="config-btn"
						onClick={() => setConfigOpen(true)}
					>
						<span className="config-btn-main">⚙ Configure</span>
						<span className="config-btn-sub">{configSummary}</span>
					</button>
					<button
						type="button"
						className="btn btn-primary btn-block"
						onClick={create}
						disabled={busy}
					>
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

			{configOpen && (
				<BottomSheet title="Game settings" onClose={() => setConfigOpen(false)}>
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

					<span className="field-label">Entry per player (₹)</span>
					<input
						type="number"
						className="text-input"
						value={entryAmount || ''}
						onChange={(e) => setEntryAmount(Math.max(0, Number(e.target.value) || 0))}
						placeholder="0"
						min={0}
					/>

					<span className="field-label">Winning patterns & prizes</span>
					<div className="prize-config">
						{PATTERNS.map((pattern) => {
							const on = patterns.includes(pattern.id);
							return (
								<div className="prize-config-row" key={pattern.id}>
									<button
										type="button"
										className={`chip${on ? ' chip-on' : ''}`}
										onClick={() => togglePattern(pattern.id)}
										title={pattern.description}
									>
										{pattern.label}
									</button>
									<div className="prize-amount">
										<span className="prize-amount-cur">₹</span>
										<input
											type="number"
											className="prize-amount-input"
											value={prizeAmounts[pattern.id] || ''}
											onChange={(e) =>
												setPrizeAmounts((prev) => ({
													...prev,
													[pattern.id]: Math.max(0, Number(e.target.value) || 0),
												}))
											}
											placeholder="0"
											min={0}
											disabled={!on}
										/>
									</div>
								</div>
							);
						})}
					</div>

					<span className="field-label">Auto-mark called numbers</span>
					<div className="chip-row">
						<button
							type="button"
							className={`chip${!autoDaub ? ' chip-on' : ''}`}
							onClick={() => setAutoDaub(false)}
						>
							Off (players mark)
						</button>
						<button
							type="button"
							className={`chip${autoDaub ? ' chip-on' : ''}`}
							onClick={() => setAutoDaub(true)}
						>
							On (auto)
						</button>
					</div>
					<p className="config-hint">
						Off by default — everyone marks their own ticket. When off, the auto-mark option is
						hidden for all players.
					</p>

					<button
						type="button"
						className="btn btn-primary btn-block"
						onClick={() => setConfigOpen(false)}
					>
						Done
					</button>
				</BottomSheet>
			)}
		</div>
	);
}
