import { ImageResponse } from 'next/og';
import { STATUS_TAGS } from '@/lib/config';
import { getPost } from '@/lib/data/post';
import { postLabel } from '@/lib/domain/post';
import { clock } from '@/lib/format';
import { OG_SIZE, OgFrame, ogFonts } from '@/lib/og';

export const alt = 'รายงานน้ำท่วมรอบ มข.';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const post = await getPost(Number((await params).id), null);
  const head = post && postLabel(post);
  return new ImageResponse(
    (
      <OgFrame>
        {post && head ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div style={{ display: 'flex' }}>
              <div
                style={{ fontSize: 88, fontWeight: 700, color: head.text, background: `${head.color}26`, borderRadius: 40, padding: '8px 40px' }}
              >
                {head.label}
              </div>
            </div>
            <div style={{ fontSize: 44, fontWeight: 700 }}>
              {post.placeName ? `ใกล้ ${post.placeName}` : 'รายงานจากชุมชน'}
            </div>
            <div style={{ fontSize: 32, color: '#6E6E73' }}>
              {[`เมื่อ ${clock(post.createdAt)} น.`, ...post.statusTags.map((t) => STATUS_TAGS[t].label)].join(' · ')}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 64, fontWeight: 700 }}>รายงานน้ำท่วม</div>
        )}
      </OgFrame>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
