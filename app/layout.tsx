import type { Metadata, Viewport } from 'next';
import { Noto_Sans_Thai } from 'next/font/google';
import { SITE } from '@/lib/config';
import './globals.css';

const thai = Noto_Sans_Thai({ subsets: ['thai', 'latin'], variable: '--font-thai' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name} · ${SITE.tagline}`, template: `%s · ${SITE.name}` },
  description: SITE.description,
  openGraph: { siteName: SITE.name, locale: 'th_TH', type: 'website' },
};

export const viewport: Viewport = { themeColor: '#F5F3EE', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={thai.variable}>
      <body>{children}</body>
    </html>
  );
}
