'use client';

// A one-shot confetti shower — rendered when the game ends. Pieces fall once
// with random colour, size, drift and spin. Purely decorative.

import { useState } from 'react';

const COLORS = ['#ff9933', '#8f4e00', '#14cd57', '#006e2a', '#ffd166', '#ef476f', '#ffffff'];

interface Piece {
	left: number;
	delay: number;
	duration: number;
	color: string;
	size: number;
	rotate: number;
	drift: number;
}

export function Confetti() {
	const [pieces] = useState<Piece[]>(() =>
		Array.from({ length: 80 }, () => ({
			left: Math.random() * 100,
			delay: Math.random() * 1.6,
			duration: 3.6 + Math.random() * 2.6,
			color: COLORS[Math.floor(Math.random() * COLORS.length)],
			size: 6 + Math.random() * 7,
			rotate: 360 + Math.random() * 540,
			drift: (Math.random() - 0.5) * 140,
		})),
	);

	return (
		<div className="confetti" aria-hidden="true">
			{pieces.map((piece, index) => {
				const style = {
					left: `${piece.left}%`,
					width: `${piece.size}px`,
					height: `${piece.size * 0.55}px`,
					background: piece.color,
					animationDelay: `${piece.delay}s`,
					animationDuration: `${piece.duration}s`,
					'--drift': `${piece.drift}px`,
					'--rot': `${piece.rotate}deg`,
				} as React.CSSProperties;
				return <span key={index} className="confetti-piece" style={style} />;
			})}
		</div>
	);
}
