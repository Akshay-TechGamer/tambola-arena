import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthButton } from '@/components/AuthButton';
import './globals.css';

export const metadata: Metadata = {
	title: 'Tambola Arena',
	description: 'Play Tambola / Housie online with friends — unlimited players, free.',
};

export const viewport = {
	themeColor: '#2a1633',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en">
			<body>
				<header className="site-header">
					<Link href="/" className="site-logo">
						🎡 Tambola Arena
					</Link>
					<AuthButton />
				</header>
				<main className="container">{children}</main>
			</body>
		</html>
	);
}
