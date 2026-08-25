'use client';

// Phase 1 waiting room: invite code, live player list, and my ticket(s).
// Number calling, daubing, and claims arrive in Phase 2/3.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ensureSignedIn } from '@/lib/data/authRepo';
import {
	getGame,
	getMyTickets,
	listPlayers,
	type GameRow,
	type PlayerRow,
} from '@/lib/data/gamesRepo';
import { subscribeToGame } from '@/lib/realtime/gameChannel';
import { patternLabel, type PatternID } from '@/lib/game/patterns';
import type { Ticket } from '@/lib/game/ticket';
import { TicketView } from '@/components/TicketView';

type Phase = 'loading' | 'error' | 'ready';

export function GameRoom({ gameID }: { gameID: string }) {
	const [phase, setPhase] = useState<Phase>('loading');
	const [errorMsg, setErrorMsg] = useState('');
	const [game, setGame] = useState<GameRow | null>(null);
	const [players, setPlayers] = useState<PlayerRow[]>([]);
	const [tickets, setTickets] = useState<Ticket[]>([]);
	const [myID, setMyID] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const seenPlayers = useRef<Set<string>>(new Set());

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

	const copyLink = useCallback(() => {
		navigator.clipboard.writeText(`${window.location.origin}/game/${gameID}`).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		});
	}, [gameID]);

	if (phase === 'loading') {
		return <p className="page-note">Loading game…</p>;
	}
	if (phase === 'error' || !game) {
		return <p className="page-note">⚠ {errorMsg}</p>;
	}

	const isHost = myID === game.host_id;

	return (
		<div className="room">
			<div className="room-head">
				<div>
					<h1 className="room-title">Waiting room</h1>
					<p className="game-subtitle">
						{game.call_mode === 'auto'
							? `Auto-call every ${game.auto_interval_secs}s`
							: 'Host calls numbers manually'}
					</p>
				</div>
				<div className="invite-box">
					<span className="invite-label">Invite code</span>
					<span className="invite-code">{game.invite_code}</span>
					<button type="button" className="btn btn-small" onClick={copyLink}>
						{copied ? '✓ Copied' : 'Copy link'}
					</button>
				</div>
			</div>

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

			<section className="panel">
				<h2 className="panel-title">Your ticket</h2>
				{tickets.map((ticket, i) => (
					<TicketView ticket={ticket} key={i} />
				))}
			</section>

			{isHost ? (
				<button type="button" className="btn btn-primary btn-block" disabled>
					Start game — number calling arrives next 🚧
				</button>
			) : (
				<p className="page-note">Waiting for the host to start…</p>
			)}
		</div>
	);
}
