import type { Metadata } from 'next';
import { GameRoom } from '@/components/GameRoom';

export const metadata: Metadata = {
	title: 'Game — Tambola Arena',
};

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	return <GameRoom gameID={id} />;
}
