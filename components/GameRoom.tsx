'use client';

// Waiting room + live gameplay: number calling (auto/manual), the 1-90 board,
// and daubing your ticket. Claims + winning arrive in Phase 3.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ensureSignedIn } from '@/lib/data/authRepo';
import {
	drawNumber,
	getGame,
	getMyTickets,
	listPlayers,
	startGame,
	type GameRow,
	type PlayerRow,
} from '@/lib/data/gamesRepo';
import { subscribeToGame } from '@/lib/realtime/gameChannel';
import { patternLabel, type PatternID } from '@/lib/game/patterns';
import { ticketNumbers, type Ticket } from '@/lib/game/ticket';
import { TicketView } from '@/components/TicketView';
import { CalledBoard } from '@/components/CalledBoard';

type Phase = 'loading' | 'error' | 'ready';

export function GameRoom({ gameID }: { gameID: string }) {
	const [phase, setPhase] = useState<Phase>('loading');
	const [errorMsg, setErrorMsg] = useState('');
	const [game, setGame] = useState<GameRow | null>(null);
	const [players, setPlayers] = useState<PlayerRow[]>([]);
	const [tickets, setTickets] = useState<Ticket[]>([]);
	const [myID, setMyID] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [daubed, setDaubed] = useState<Set<number>>(new Set());
	const [autoDaub, setAutoDaub] = useState(true);
	const [drawing, setDrawing] = useState(false);
	const [autoPaused, setAutoPaused] = useState(false);
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
				const [playerList, myTickets] = await Promise.all([
					listPlayers(gameID),
					getMyTickets(gameID, user.id),
				]);
				if (cancelled) {
					return;
				}
				seenPlayers.current = new Set(playerList.map((p) => p.user_id));
				setGame(row);
				setPlayers(playerList);
				setTickets(myTickets);
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
		});
	}, [gameID, myID]);

	const myNumbers = useMemo(
		() => new Set(tickets.flatMap((ticket) => ticketNumbers(ticket))),
		[tickets],
	);
	const calledSet = useMemo(
		() => new Set(game?.called_numbers ?? []),
		[game?.called_numbers],
	);

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

			{!isWaiting && (
				<div className="caller-strip">
					<div className="current-number">
						<span className="current-label">Current</span>
						<span className="current-value">{game.current_number ?? '—'}</span>
					</div>
					<div className="called-wrap">
						<CalledBoard called={calledSet} current={game.current_number} />
						<p className="called-count">{calledSet.size} / 90 called</p>
					</div>
				</div>
			)}

			{/* Host controls */}
			{isHost && isWaiting && (
				<button type="button" className="btn btn-primary btn-block" onClick={onStart}>
					Start game ({players.length} {players.length === 1 ? 'player' : 'players'})
				</button>
			)}
			{isHost && !isWaiting && !isFinished && (
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

			<section className="panel">
				<div className="ticket-head">
					<h2 className="panel-title">Your ticket</h2>
					{!isWaiting && (
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
				{tickets.map((ticket, i) => (
					<TicketView
						key={i}
						ticket={ticket}
						marked={daubed}
						onCellClick={isWaiting ? undefined : toggleDaub}
					/>
				))}
				{!isWaiting && !autoDaub && (
					<p className="game-subtitle">Tap a called number to mark it.</p>
				)}
			</section>

			<div className="room-grid">
				<section className="panel">
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
				<section className="panel">
					<h2 className="panel-title">Winning patterns</h2>
					<ul className="pattern-list">
						{(game.enabled_patterns as PatternID[]).map((id) => (
							<li key={id}>{patternLabel(id)}</li>
						))}
					</ul>
				</section>
			</div>

			{isWaiting && !isHost && <p className="page-note">Waiting for the host to start…</p>}
			{isFinished && <p className="page-note">All 90 numbers called. 🎉</p>}
		</div>
	);
}
