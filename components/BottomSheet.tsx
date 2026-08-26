'use client';

// Mobile bottom-sheet modal: slides up from the bottom, dims the rest, and the
// body scrolls internally so the page itself never grows a scrollbar.

import { useEffect } from 'react';

interface BottomSheetProps {
	title?: string;
	onClose: () => void;
	children: React.ReactNode;
}

export function BottomSheet({ title, onClose, children }: BottomSheetProps) {
	useEffect(() => {
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = '';
		};
	}, []);

	return (
		<div className="sheet-backdrop" onClick={onClose}>
			<div
				className="sheet"
				role="dialog"
				aria-modal="true"
				onClick={(event) => event.stopPropagation()}
			>
				<div className="sheet-grip">
					<span className="sheet-handle" />
					{title && <span className="sheet-title">{title}</span>}
					<button type="button" className="sheet-close" onClick={onClose} aria-label="Close">
						✕
					</button>
				</div>
				<div className="sheet-body">{children}</div>
			</div>
		</div>
	);
}
