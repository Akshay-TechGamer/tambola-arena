'use client';

// Renders a 3×9 Tambola ticket. In Phase 2 the marked numbers get a daub;
// for now `marked` is optional and defaults to none.

import type { Ticket } from '@/lib/game/ticket';

interface TicketViewProps {
	ticket: Ticket;
	marked?: Set<number>;
	onCellClick?: (n: number) => void;
}

export function TicketView({ ticket, marked, onCellClick }: TicketViewProps) {
	return (
		<div className="ticket">
			{ticket.map((row, r) => (
				<div className="ticket-row" key={r}>
					{row.map((cell, c) => {
						if (cell === null) {
							return <span className="ticket-cell ticket-blank" key={c} />;
						}
						const isMarked = marked?.has(cell) ?? false;
						return (
							<button
								type="button"
								key={c}
								className={`ticket-cell${isMarked ? ' ticket-marked' : ''}`}
								onClick={onCellClick ? () => onCellClick(cell) : undefined}
								disabled={!onCellClick}
							>
								<span className="cell-num">{cell}</span>
							</button>
						);
					})}
				</div>
			))}
		</div>
	);
}
