'use client';

// Waiting room + live gameplay: number calling (auto/manual), the 1-90 board,
// and daubing your ticket. Claims + winning arrive in Phase 3.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ensureSignedIn } from '@/lib/data/authRepo';
import {
	claimPattern,
	drawNumber,
	getGame,
	getMyTickets,
	listClaims,
	listPlayers,
	startGame,
	type ClaimRow,
	type GameRow,
	type MyTicket,
	type PlayerRow,
} from '@/lib/data/gamesRepo';
import { subscribeToGame } from '@/lib/realtime/gameChannel';
import { patternLabel, validateClaim, type PatternID } from '@/lib/game/patterns';
import { ticketNumbers } from '@/lib/game/ticket';
import { TicketView } from '@/components/TicketView';
import { CalledBoard } from '@/components/CalledBoard';
import { BottomSheet } from '@/components/BottomSheet';
import { Confetti } from '@/components/Confetti';

type Phase = 'loading' | 'error' | 'ready';

export function GameRoom({ gameID }: { gameID: string }) {
	const [phase, setPhase] = useState<Phase>('loading');
	const [errorMsg, setErrorMsg] = useState('');
	const [game, setGame] = useState<GameRow | null>(null);
	const [players, setPlayers] = useState<PlayerRow[]>([]);
	const [tickets, setTickets] = useState<MyTicket[]>([]);
	const [claims, setClaims] = useState<ClaimRow[]>([]);
	const [winToast, setWinToast] = useState<{ text: string; id: number } | null>(null);
	const [claimError, setClaimError] = useState<string | null>(null);
	const [myID, setMyID] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [daubed, setDaubed] = useState<Set<number>>(new Set());
	// Host-controlled; off unless the host enabled auto-mark for the game.
	const [autoDaub, setAutoDaub] = useState(false);
	const [drawing, setDrawing] = useState(false);
	const [autoPaused, setAutoPaused] = useState(false);
	const [sheet, setSheet] = useState<'board' | 'prizes' | 'players' | 'results' | null>(null);

	// Win announcements pop as a brief toast, then fade (saves the banner row).
	useEffect(() => {
		if (!winToast) {
			return;
		}
		const timer = setTimeout(() => setWinToast(null), 4500);
		return () => clearTimeout(timer);
	}, [winToast]);

	// When the game finishes, pop the results modal.
	useEffect(() => {
		if (game?.status === 'finished') {
			setSheet('results');
		}
	}, [game?.status]);
	const seenPlayers = useRef<Set<string>>(new Set());
	const gameRef = useRef<GameRow | null>(null);
	gameRef.current = game;

	const storageKey = myID ? `tambola-daub-${gameID}-${myID}` : null;

	// Load
	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const user = await ensureSignedIn();
				const row = await getGame(gameID);
				if (!row) {
					throw new Error('Game not found — check the link.');
				}
				const [playerList, myTickets, claimList] = await Promise.all([
					listPlayers(gameID),
					getMyTickets(gameID, user.id),
					listClaims(gameID),
				]);
				if (cancelled) {
					return;
				}
				seenPlayers.current = new Set(playerList.map((p) => p.user_id));
				setGame(row);
				setAutoDaub(row.auto_daub);
				setPlayers(playerList);
				setTickets(myTickets);
				setClaims(claimList);
				setMyID(user.id);
				// restore daubs
				const saved = localStorage.getItem(`tambola-daub-${gameID}-${user.id}`);
				if (saved) {
					setDaubed(new Set(JSON.parse(saved) as number[]));
				}
				setPhase('ready');
			} catch (loadError) {
				if (!cancelled) {
					setErrorMsg(loadError instanceof Error ? loadError.message : 'Failed to load');
					setPhase('error');
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [gameID]);

	// Realtime
	useEffect(() => {
		if (!myID) {
			return;
		}
		return subscribeToGame(gameID, {
			onPlayerJoin: (player) => {
				if (seenPlayers.current.has(player.user_id)) {
					return;
				}
				seenPlayers.current.add(player.user_id);
				setPlayers((current) => [...current, player]);
			},
			onGameUpdate: (row) => setGame(row),
			onClaim: (claim) => {
				setClaims((current) =>
					current.some((c) => c.id === claim.id) ? current : [...current, claim],
				);
				if (claim.status === 'won') {
					setWinToast((prev) => ({
						text: `🎉 ${claim.username} won ${patternLabel(claim.pattern as PatternID)}`,
						id: (prev ? prev.id : 0) + 1,
					}));
				}
			},
		});
	}, [gameID, myID]);

	const myNumbers = useMemo(
		() => new Set(tickets.flatMap((ticket) => ticketNumbers(ticket.numbers))),
		[tickets],
	);
	const wonBy = useMemo(() => {
		const map = new Map<string, string>();
		for (const claim of claims) {
			if (claim.status === 'won') {
				map.set(claim.pattern, claim.username);
			}
		}
		return map;
	}, [claims]);
	const calledSet = useMemo(
		() => new Set(game?.called_numbers ?? []),
		[game?.called_numbers],
	);
	// The four calls before the current one, most recent first.
	const recentCalls = useMemo(() => {
		const all = game?.called_numbers ?? [];
		return all.slice(0, -1).slice(-4).reverse();
	}, [game?.called_numbers]);

	// Auto-daub: when new numbers are called, mark the ones on my ticket.
	useEffect(() => {
		if (!autoDaub || !game) {
			return;
		}
		setDaubed((current) => {
			const next = new Set(current);
			let changed = false;
			for (const n of game.called_numbers) {
				if (myNumbers.has(n) && !next.has(n)) {
					next.add(n);
					changed = true;
				}
			}
			return changed ? next : current;
		});
	}, [game, autoDaub, myNumbers]);

	// Persist daubs
	useEffect(() => {
		if (storageKey) {
			localStorage.setItem(storageKey, JSON.stringify([...daubed]));
		}
	}, [daubed, storageKey]);

	// Host auto-calling loop. Depends only on stable values (not the whole
	// game object) so a new draw doesn't reset the interval mid-cycle.
	const isHost = myID != null && game?.host_id === myID;
	const gameStatus = game?.status;
	const callMode = game?.call_mode;
	const autoIntervalSecs = game?.auto_interval_secs;
	useEffect(() => {
		if (!isHost || gameStatus !== 'active' || callMode !== 'auto' || autoPaused || !autoIntervalSecs) {
			return;
		}
		const tick = () => {
			const g = gameRef.current;
			if (g && g.status === 'active') {
				drawNumber(gameID).catch(() => undefined);
			}
		};
		const interval = setInterval(tick, autoIntervalSecs * 1000);
		return () => clearInterval(interval);
	}, [isHost, gameStatus, callMode, autoIntervalSecs, gameID, autoPaused]);

	const copyLink = useCallback(() => {
		navigator.clipboard.writeText(`${window.location.origin}/game/${gameID}`).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		});
	}, [gameID]);

	const onStart = useCallback(() => {
		startGame(gameID).catch((e) =>
			setErrorMsg(e instanceof Error ? e.message : 'Could not start'),
		);
	}, [gameID]);

	const onDraw = useCallback(() => {
		setDrawing(true);
		drawNumber(gameID)
			.catch(() => undefined)
			.finally(() => setDrawing(false));
	}, [gameID]);

	// Which ticket (if any) satisfies a pattern from the numbers the player has
	// actually marked (daubed) — you can only claim what you have marked, like real
	// Tambola. With auto-mark on this fills in automatically; the server still
	// verifies the numbers were genuinely called.
	const satisfyingTicket = useCallback(
		(pattern: PatternID): MyTicket | null => {
			return tickets.find((t) => validateClaim(t.numbers, daubed, pattern)) ?? null;
		},
		[tickets, daubed],
	);

	const onClaim = useCallback(
		(pattern: PatternID) => {
			const ticket = satisfyingTicket(pattern);
			if (!ticket) {
				return;
			}
			setClaimError(null);
			claimPattern(gameID, ticket.id, pattern).catch((e) =>
				setClaimError(e instanceof Error ? e.message : 'Claim failed'),
			);
		},
		[gameID, satisfyingTicket],
	);

	const toggleDaub = useCallback(
		(n: number) => {
			if (!calledSet.has(n)) {
				return; // can only mark called numbers
			}
			setDaubed((current) => {
				const next = new Set(current);
				if (next.has(n)) {
					next.delete(n);
				} else {
					next.add(n);
				}
				return next;
			});
		},
		[calledSet],
	);

	if (phase === 'loading') {
		return <p className="page-note">Loading game…</p>;
	}
	if (phase === 'error' || !game) {
		return <p className="page-note">⚠ {errorMsg}</p>;
	}

	const isWaiting = game.status === 'waiting';
	const isFinished = game.status === 'finished';
	const enabledPatterns = game.enabled_patterns as PatternID[];
	const prizeAmounts = (game.prize_amounts as Record<string, number>) ?? {};

	const claimables =
		!isWaiting && !isFinished
			? enabledPatterns.filter((id) => !wonBy.get(id) && satisfyingTicket(id) !== null)
			: [];

	const callerCard = (
		<div className="caller-card">
			<div className="caller-label">Current Number</div>
			<div className="current-circle">{game.current_number ?? '—'}</div>
			<div className="recent-calls">
				<div className="caller-label">Recent Calls</div>
				<div className="recent-row">
					{recentCalls.length === 0 && <span className="recent-empty">—</span>}
					{recentCalls.map((n) => (
						<span className="recent-chip" key={n}>
							{n}
						</span>
					))}
				</div>
			</div>
			{isHost && !isFinished && (
				<div className="host-controls">
					{game.call_mode === 'manual' ? (
						<button type="button" className="btn btn-primary" onClick={onDraw} disabled={drawing}>
							{drawing ? 'Drawing…' : '🎲 Next number'}
						</button>
					) : (
						<button type="button" className="btn" onClick={() => setAutoPaused((p) => !p)}>
							{autoPaused ? '▶ Resume auto-call' : '⏸ Pause auto-call'}
						</button>
					)}
				</div>
			)}
		</div>
	);

	const boardCard = (
		<div className="board-card">
			<div className="board-head">
				<h2 className="panel-title">Called numbers</h2>
				<span className="called-count">{calledSet.size} / 90</span>
			</div>
			<CalledBoard called={calledSet} current={game.current_number} />
		</div>
	);

	const ticketPanel = (
		<section className="panel">
			<div className="ticket-head">
				<h2 className="panel-title">Your ticket</h2>
				{!isWaiting && game.auto_daub && (
					<label className="auto-daub">
						<input
							type="checkbox"
							checked={autoDaub}
							onChange={(e) => setAutoDaub(e.target.checked)}
						/>{' '}
						Auto-mark
					</label>
				)}
			</div>
			{tickets.map((ticket) => (
				<TicketView
					key={ticket.id}
					ticket={ticket.numbers}
					marked={daubed}
					onCellClick={isWaiting ? undefined : toggleDaub}
				/>
			))}
			{!isWaiting && !autoDaub && (
				<p className="game-subtitle">Tap a called number to mark it.</p>
			)}
		</section>
	);

	const prizesPanel = (
		<section className="panel prizes-panel">
			<h2 className="panel-title">🏆 Prizes</h2>
			<ul className="pattern-list">
				{enabledPatterns.map((id) => {
					const winner = wonBy.get(id);
					const claimable = !winner && !isWaiting && satisfyingTicket(id) !== null;
					return (
						<li
							key={id}
							className={`prize${winner ? ' prize-won' : ''}${claimable ? ' prize-claimable' : ''}`}
						>
							<span className="prize-icon">{winner ? '✓' : '🏆'}</span>
							<div className="prize-info">
								<div className="prize-name">{patternLabel(id)}</div>
								<div className="prize-status">
									{winner ? `Claimed by ${winner}` : claimable ? 'Ready to claim!' : 'Available'}
								</div>
							</div>
							{prizeAmounts[id] > 0 && (
								<span className="prize-money">₹{prizeAmounts[id]}</span>
							)}
							{claimable && (
								<button type="button" className="claim-btn" onClick={() => onClaim(id)}>
									Claim
								</button>
							)}
						</li>
					);
				})}
			</ul>
			{claimError && <p className="form-error">⚠ {claimError}</p>}
		</section>
	);

	const playersPanel = (
		<section className="panel players-panel">
			<h2 className="panel-title">Players ({players.length})</h2>
			<ul className="player-list">
				{players.map((player) => (
					<li key={player.user_id}>
						{player.username}
						{player.user_id === game.host_id && <span className="host-tag">host</span>}
						{player.user_id === myID && <span className="you-tag">you</span>}
					</li>
				))}
			</ul>
		</section>
	);

	const wonClaims = claims.filter((c) => c.status === 'won');
	const winnings = players
		.map((pl) => {
			const mine = wonClaims.filter((c) => c.user_id === pl.user_id);
			return {
				username: pl.username,
				total: mine.reduce((sum, c) => sum + (prizeAmounts[c.pattern] ?? 0), 0),
				count: mine.length,
			};
		})
		.sort((a, b) => b.total - a.total);
	const totalWon = wonClaims.reduce((sum, c) => sum + (prizeAmounts[c.pattern] ?? 0), 0);
	const pot = game.entry_amount * players.length;

	const resultsPanel = (
		<section className="results">
			<header className="results-hero">
				<h2 className="results-hero-title">🏆 Final results 🏆</h2>
				<p className="results-hero-meta">
					Game {game.invite_code} · {players.length} {players.length === 1 ? 'player' : 'players'}
				</p>
			</header>
			{wonClaims.length === 0 ? (
				<p className="game-subtitle">No prizes were claimed.</p>
			) : (
				<>
					<section className="results-section">
						<h3 className="results-subhead">⭐ Category winners</h3>
						<ul className="cat-winners">
							{wonClaims.map((c) => (
								<li key={c.id} className="cat-winner-row">
									<span className="cat-pattern">{patternLabel(c.pattern as PatternID)}</span>
									<span className="cat-name">
										<span className="cat-check">✓</span> {c.username}
									</span>
									<span className="cat-amount">
										{(prizeAmounts[c.pattern] ?? 0) > 0 ? `₹${prizeAmounts[c.pattern]}` : '—'}
									</span>
								</li>
							))}
						</ul>
					</section>

					<section className="results-section">
						<h3 className="results-subhead">📊 Winnings by player</h3>
						<ul className="winnings-list">
							{winnings.map((w, index) => {
								const rank = w.total > 0 && index < 3 ? index + 1 : 0;
								return (
									<li
										key={w.username}
										className={`winning-row${rank ? ` winnings-rank-${rank}` : ''}`}
									>
										<span className="winning-left">
											{rank > 0 ? (
												<span className={`rank-pill rank-${rank}`}>
													{['🥇', '🥈', '🥉'][rank - 1]} {['1st', '2nd', '3rd'][rank - 1]}
												</span>
											) : (
												<span className="rank-spacer" />
											)}
											<span className="winning-name">{w.username}</span>
											<span className="winnings-count">
												{w.count} {w.count === 1 ? 'win' : 'wins'}
											</span>
										</span>
										<span className="prize-money">₹{w.total}</span>
									</li>
								);
							})}
						</ul>
					</section>

					<div className="results-summary">
						<div className="summary-card summary-total">
							<span className="summary-label">Total won</span>
							<span className="summary-value">₹{totalWon}</span>
						</div>
						{game.entry_amount > 0 && (
							<div className="summary-card">
								<span className="summary-label">
									Pot ({players.length} × ₹{game.entry_amount})
								</span>
								<span className="summary-value">₹{pot}</span>
							</div>
						)}
					</div>

					<div className="results-actions">
						<button
							type="button"
							className="btn btn-primary btn-block"
							onClick={() => {
								window.location.href = '/';
							}}
						>
							🎉 New game
						</button>
						<button
							type="button"
							className="btn btn-block"
							onClick={() => {
								window.location.href = '/';
							}}
						>
							Back to lobby
						</button>
					</div>
				</>
			)}
		</section>
	);

	return (
		<div className="room">
			<div className="room-head">
				<div>
					<h1 className="room-title">
						{isWaiting ? 'Waiting room' : isFinished ? 'Game over' : 'Tambola!'}
					</h1>
					<p className="game-subtitle">
						{game.call_mode === 'auto'
							? `Auto-call every ${game.auto_interval_secs}s`
							: 'Host calls numbers manually'}
					</p>
				</div>
				{isWaiting && (
					<div className="invite-box">
						<span className="invite-label">Invite code</span>
						<span className="invite-code">{game.invite_code}</span>
						<button type="button" className="btn btn-small" onClick={copyLink}>
							{copied ? '✓ Copied' : 'Copy link'}
						</button>
					</div>
				)}
			</div>

			{winToast && (
				<div className="win-toast" key={winToast.id} role="status">
					{winToast.text}
				</div>
			)}

			{isFinished && <Confetti />}

			{isWaiting && game.entry_amount > 0 && (
				<div className="pot-strip">
					<span>Entry <b>₹{game.entry_amount}</b></span>
					<span>Pot <b>₹{game.entry_amount * players.length}</b></span>
				</div>
			)}

			{isHost && isWaiting && (
				<button type="button" className="btn btn-primary btn-block" onClick={onStart}>
					Start game ({players.length} {players.length === 1 ? 'player' : 'players'})
				</button>
			)}

				<div className="arena-mobile">
					{!isWaiting && callerCard}
					{ticketPanel}
					{claimables.length > 0 && (
						<div className="claim-strip">
							{claimables.map((id) => (
								<button
									key={id}
									type="button"
									className="btn btn-primary claim-big"
									onClick={() => onClaim(id)}
								>
									🏆 {patternLabel(id)}
								</button>
							))}
						</div>
					)}
					{claimError && <p className="form-error">⚠ {claimError}</p>}
					{isFinished && (
						<button type="button" className="btn btn-primary btn-block" onClick={() => { window.location.href = '/'; }}>
							🎉 New game
						</button>
					)}
					{!isWaiting && (
						<div className="mobile-bar">
							<button type="button" className="mb-btn" onClick={() => setSheet('board')}>
								<span className="mb-icon">▦</span>
								<span>Board</span>
							</button>
							{isFinished ? (
								<button type="button" className="mb-btn" onClick={() => setSheet('results')}>
									<span className="mb-icon">🏆</span>
									<span>Results</span>
								</button>
							) : (
								<button type="button" className="mb-btn" onClick={() => setSheet('prizes')}>
									<span className="mb-icon">🏆</span>
									<span>Prizes</span>
									{claimables.length > 0 && <span className="mb-badge" aria-hidden="true" />}
								</button>
							)}
							<button type="button" className="mb-btn" onClick={() => setSheet('players')}>
								<span className="mb-icon">👥</span>
								<span>Players</span>
							</button>
						</div>
					)}
				</div>

			{isWaiting && !isHost && <p className="page-note">Waiting for the host to start…</p>}

			{sheet === 'board' && (
				<BottomSheet onClose={() => setSheet(null)}>{boardCard}</BottomSheet>
			)}
			{sheet === 'prizes' && (
				<BottomSheet title="Prizes" onClose={() => setSheet(null)}>
					{prizesPanel}
				</BottomSheet>
			)}
			{sheet === 'players' && (
				<BottomSheet title="Players" onClose={() => setSheet(null)}>
					{playersPanel}
				</BottomSheet>
			)}
			{sheet === 'results' && (
				<BottomSheet onClose={() => setSheet(null)}>{resultsPanel}</BottomSheet>
			)}
		</div>
	);
}
