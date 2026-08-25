'use client';

// The 1-90 board showing which numbers have been called.

const ALL_NUMBERS = Array.from({ length: 90 }, (_, i) => i + 1);

export function CalledBoard({
	called,
	current,
}: {
	called: Set<number>;
	current: number | null;
}) {
	return (
		<div className="called-board">
			{ALL_NUMBERS.map((n) => {
				const isCalled = called.has(n);
				const isCurrent = n === current;
				return (
					<span
						key={n}
						className={`called-cell${isCalled ? ' called-on' : ''}${isCurrent ? ' called-current' : ''}`}
					>
						{n}
					</span>
				);
			})}
		</div>
	);
}
