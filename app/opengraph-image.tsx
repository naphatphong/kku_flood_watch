import { ImageResponse } from 'next/og';
import { OG_SIZE, OgFrame, ogFonts } from '@/lib/og';

export const alt = 'KKU Flood Watch แผนที่น้ำท่วมรอบ มข.';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <OgFrame>
        <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.15 }}>ตรงไหนท่วม ถนนไหนผ่านได้</div>
        <div style={{ fontSize: 36, color: '#6E6E73', marginTop: 18 }}>
          แผนที่จุดน้ำท่วม สถานะถนนแยกตามประเภทรถ และเส้นทางหลบน้ำ
        </div>
      </OgFrame>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
