import type { Metadata, Viewport } from 'next';
import { Noto_Sans_Thai } from 'next/font/google';
import './globals.css';

const thai = Noto_Sans_Thai({ subsets: ['thai', 'latin'], variable: '--font-thai' });

export const metadata: Metadata = {
  title: 'น้ำท่วมรอบ มข.',
  description: 'แผนที่ความเสี่ยงน้ำท่วม สถานะถนน และเส้นทางหลบน้ำรอบมหาวิทยาลัยขอนแก่น',
};

export const viewport: Viewport = { themeColor: '#F5F3EE' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={thai.variable}>
      <body>{children}</body>
    </html>
  );
}
