import type { Metadata } from 'next';
import Link from 'next/link';
import { PATTERNS, type PatternID } from '@/lib/game/patterns';

export const metadata: Metadata = {
	title: 'How to play — Tambola Arena',
};

const STEPS: { title: string; desc: string }[] = [
	{
		title: 'Host & share',
		desc: 'Host a game and share the invite code (or link) with friends. Free, unlimited players.',
	},
	{
		title: 'Everyone joins',
		desc: 'Each player joins with a name and gets an auto-generated 3×9 ticket.',
	},
	{
		title: 'Numbers called',
		desc: 'The host starts the game. Numbers 1–90 are called one at a time.',
	},
	{
		title: 'Mark matches',
		desc: 'Tap a called number on your ticket to stamp it — or turn on Auto-mark.',
	},
	{
		title: 'Claim the prize',
		desc: 'Complete a winning pattern? Hit Claim! The server verifies it and announces the win.',
	},
];

const PATTERN_ICON: Record<PatternID, string> = {
	early_five: '⭐',
	top_line: '⬆️',
	middle_line: '➖',
	bottom_line: '⬇️',
	four_corners: '◈',
	full_house: '🏠',
};

// A sample ticket row: numbers in their columns, one stamped, the rest blank.
const SAMPLE_ROW: { n: number | null; stamped?: boolean }[] = [
	{ n: 4 },
	{ n: null },
	{ n: 29 },
	{ n: null },
	{ n: 45 },
	{ n: 56, stamped: true },
	{ n: null },
	{ n: 71 },
	{ n: null },
];

export default function RulesPage() {
	return (
		<div className="rules-page">
			<div className="rules-head">
				<h1 className="rules-title">How to play</h1>
				<Link href="/" className="btn btn-primary btn-small rules-start">
					▶ Start a game
				</Link>
			</div>
			<p className="rules-lead">
				Master the digital version of the classic game — fast, fair, and free.
			</p>

			<section className="rules-section">
				<h2 className="results-subhead">🌀 The flow</h2>
				<ol className="rules-flow">
					{STEPS.map((step, i) => (
						<li className="rules-step" key={step.title}>
							<span className="rules-step-badge">{i + 1}</span>
							<div className="rules-step-body">
								<h3 className="rules-step-title">{step.title}</h3>
								<p className="rules-step-desc">{step.desc}</p>
							</div>
						</li>
					))}
				</ol>
			</section>

			<section className="rules-card">
				<h2 className="results-subhead">🎟️ Your ticket</h2>
				<p className="rules-step-desc">
					A ticket is a 3-row × 9-column grid with 15 numbers. Column 1 holds 1–9, column 2
					holds 10–19, and so on up to column 9 (80–90). The rest of the cells are blank.
				</p>
				<div className="rules-ticket-row">
					{SAMPLE_ROW.map((cell, i) =>
						cell.n === null ? (
							<span className="rt-cell rt-blank" key={i} />
						) : (
							<span
								className={`rt-cell${cell.stamped ? ' rt-stamped' : ''}`}
								key={i}
							>
								{cell.n}
							</span>
						),
					)}
				</div>
				<div className="rules-legend">
					<span className="rules-legend-dot" />
					Indicates a stamped (marked) number
				</div>
			</section>

			<section className="rules-section">
				<h2 className="results-subhead">🏆 Winning patterns</h2>
				<ul className="rules-patterns">
					{PATTERNS.map((pattern) => (
						<li className="rules-pattern" key={pattern.id}>
							<span className="rules-pattern-icon">{PATTERN_ICON[pattern.id]}</span>
							<div>
								<h3 className="rules-pattern-name">{pattern.label}</h3>
								<p className="rules-step-desc">{pattern.description}</p>
							</div>
						</li>
					))}
				</ul>
			</section>

			<section className="rules-card">
				<h2 className="results-subhead">✅ Fair play</h2>
				<p className="rules-step-desc">
					Every claim is checked on the server against the numbers that were actually called —
					you cannot win a pattern you have not completed. Each prize is won once. A wrong
					claim is a “bogey” and does not count.
				</p>
			</section>

		</div>
	);
}
