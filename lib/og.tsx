import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SITE } from './config';

// Noto Sans Thai (SIL OFL, assets/fonts/OFL.txt) for Open Graph images; satori needs TTF/OTF/WOFF.
const FONT_FILES = [
  ['thai-400', 400],
  ['thai-700', 700],
  ['latin-400', 400],
  ['latin-700', 700],
] as const;

export async function ogFonts() {
  return Promise.all(
    FONT_FILES.map(async ([file, weight]) => ({
      name: 'Noto Sans Thai',
      data: await readFile(join(process.cwd(), 'assets/fonts', `noto-sans-thai-${file}-normal.woff`)),
      weight,
      style: 'normal' as const,
    })),
  );
}

export const OG_SIZE = { width: 1200, height: 630 };

/** Shared frame: brand bar on top, content below. */
export function OgFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: 64,
        background: 'linear-gradient(135deg, #F5F3EE 0%, #E8F1FB 100%)',
        fontFamily: 'Noto Sans Thai',
        color: '#1D1D1F',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 18,
            background: '#0071E3',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* The drop from app/icon.svg */}
          <svg width="44" height="44" viewBox="0 0 64 64" fill="none" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M32 10c7 9.5 14 17.8 14 26a14 14 0 01-28 0c0-8.2 7-16.5 14-26z" />
            <path d="M25 38a7 7 0 007 7" />
          </svg>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 40, fontWeight: 700 }}>{SITE.name}</div>
          <div style={{ fontSize: 26, color: '#6E6E73' }}>{SITE.tagline}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center' }}>{children}</div>
    </div>
  );
}
