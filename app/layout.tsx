import type { Metadata } from 'next';
import { Anybody, Plus_Jakarta_Sans, Space_Grotesk } from 'next/font/google';
import Link from 'next/link';
import { AuthButton } from '@/components/AuthButton';
import './globals.css';

const display = Anybody({ subsets: ['latin'], weight: ['700', '800'], variable: '--font-display' });
const body = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-body' });
const mono = Space_Grotesk({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-num' });

export const metadata: Metadata = {
	title: 'Tambola Arena',
	description: 'Play Tambola / Housie online with friends — unlimited players, free.',
};

export const viewport = {
	themeColor: '#fcf9f8',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
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
