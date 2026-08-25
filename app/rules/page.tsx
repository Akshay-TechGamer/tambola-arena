import type { Metadata } from 'next';
import Link from 'next/link';
import { PATTERNS } from '@/lib/game/patterns';

export const metadata: Metadata = {
	title: 'How to play — Tambola Arena',
};

const STEPS = [
	'Host a game and share the invite code (or link) with friends.',
	'Everyone joins with a name and gets an auto-generated 3×9 ticket.',
	'The host starts the game. Numbers 1–90 are called one at a time.',
	'Mark (daub) a called number if it is on your ticket — or turn on Auto-mark.',
	'Complete a winning pattern? Hit Claim! The server checks it and announces the win.',
];

export default function RulesPage() {
	return (
		<div className="setup">
			<h1 className="setup-title">How to play</h1>
			<p className="game-subtitle">
				Tambola (Housie) is a friendly numbers game. Here is the whole thing in a minute.
			</p>

			<section className="panel">
				<h2 className="panel-title">The flow</h2>
				<ol className="rules-steps">
					{STEPS.map((step, i) => (
						<li key={i}>{step}</li>
					))}
				</ol>
			</section>

			<section className="panel">
				<h2 className="panel-title">Your ticket</h2>
				<p>
					A ticket is a 3-row × 9-column grid. Each row has exactly 5 numbers (so 15 per
					ticket). Column 1 holds numbers 1–9, column 2 holds 10–19, and so on up to
					column 9 (80–90). The rest of the cells are blank.
				</p>
			</section>

			<section className="panel">
				<h2 className="panel-title">Winning patterns</h2>
				<ul className="pattern-list">
					{PATTERNS.map((pattern) => (
						<li key={pattern.id} className="prize">
							<div>
								<div className="prize-name">{pattern.label}</div>
								<div className="prize-status">{pattern.description}</div>
							</div>
						</li>
					))}
				</ul>
			</section>

			<section className="panel">
				<h2 className="panel-title">Fair play</h2>
				<p>
					Every claim is checked on the server against the numbers that were actually
					called — you cannot win a pattern you have not completed. Each prize is won once.
					A wrong claim is a “bogey” and does not count.
				</p>
			</section>

			<Link href="/" className="btn btn-primary btn-block">
				Start a game
			</Link>
		</div>
	);
}
