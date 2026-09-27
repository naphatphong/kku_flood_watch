import Link from 'next/link';
import { zoneLevel } from '@/lib/config';
import type { RainDTO, WatchDTO } from '@/lib/data/types';
import { DetailCard, Row } from './DetailCard';
import { watchName } from './WatchList';

/** Why a watch circle is shown: rain × low ground, not a report. */
export function WatchDetail({ watch, rain, onClose }: { watch: WatchDTO; rain: RainDTO | null; onClose: () => void }) {
  const level = zoneLevel(watch.pct);
  return (
    <DetailCard title={watchName(watch)} onClose={onClose}>
      <div className="mt-1 flex items-center gap-2.5">
        <span className="text-[40px] leading-none font-bold tracking-tight" style={{ color: level.text }}>
          {watch.pct}%
        </span>
        <span className="rounded-full bg-fill px-2.5 py-0.5 text-xs font-semibold text-secondary">คาดการณ์ · เฝ้าระวัง</span>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-secondary">
        ที่นี่เป็นแอ่งที่ต่ำกว่าพื้นที่รอบข้าง น้ำฝนมักไหลมารวม ยังไม่มีใครรายงานว่าท่วม % คิดจากฝนกับความต่ำของพื้นที่เท่านั้น
      </p>
      <dl className="mt-3 space-y-1.5 text-[13px]">
        <Row label="ความสูงพื้นดิน" value={`${watch.elevationM} ม.`} />
        <Row label="รัศมี" value={`${watch.radiusM} ม.`} />
        {rain && <Row label="ฝนที่ใช้คิด" value={`3 ชม. ${rain.r3} · 24 ชม. ${rain.r24} มม. · ${rain.rainyDays} วัน`} />}
      </dl>
      <Link href="/report" className="mt-3 block rounded-xl bg-accent/10 px-3 py-2 text-center text-[13px] font-semibold text-link">
        อยู่แถวนี้? ช่วยรายงานว่าน้ำท่วมจริงไหม
      </Link>
    </DetailCard>
  );
}
