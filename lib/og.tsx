import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

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
            color: 'white',
            fontSize: 44,
            fontWeight: 700,
          }}
        >
          ~
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 40, fontWeight: 700 }}>KKU Flood Watch</div>
          <div style={{ fontSize: 26, color: '#6E6E73' }}>น้ำท่วมรอบ มข. จากรายงานของชุมชน</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center' }}>{children}</div>
    </div>
  );
}
