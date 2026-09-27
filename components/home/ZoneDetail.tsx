import { SCORE, zoneLevel } from '@/lib/config';
import type { ClusterDTO, RainDTO } from '@/lib/data/types';
import { pct } from '@/lib/format';
import { DetailCard, Row } from './DetailCard';
import { clusterName } from './ZoneList';

const LOW_LABEL = new Map<number, string>([
  [SCORE.lowFactor.low, 'พื้นที่ต่ำ'],
  [SCORE.lowFactor.normal, 'ระดับปกติ'],
  [SCORE.lowFactor.high, 'พื้นที่สูง'],
]);

/** Why this circle has its % (PLAN §5: show base, report, c and the rain used). */
export function ZoneDetail({ cluster, rain, onClose }: { cluster: ClusterDTO; rain: RainDTO | null; onClose: () => void }) {
  const level = zoneLevel(cluster.final);
  return (
    <DetailCard title={clusterName(cluster)} onClose={onClose}>
      <div className="mt-1 flex items-center gap-2.5">
        <span className="text-[40px] leading-none font-bold tracking-tight" style={{ color: level.text }}>
          {pct(cluster.final)}
        </span>
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
          style={{ color: level.text, background: `${level.color}1F` }}
        >
          {level.label}
        </span>
      </div>
      <p className="mt-1 text-[13px] text-secondary">
        โอกาสท่วม จาก {cluster.reportCount} จุดรายงานในรัศมี {cluster.radiusM} ม.
      </p>
      <dl className="mt-3 space-y-1.5 text-[13px]">
        <Row label="จากโพสต์ (report)" value={pct(cluster.report)} />
        <Row label="จากฝน × ความต่ำพื้นที่ (base)" value={pct(cluster.base)} />
        <Row label="น้ำหนักที่เชื่อโพสต์ (c)" value={cluster.c.toFixed(2)} />
        <Row label="ระดับพื้นที่" value={`${LOW_LABEL.get(cluster.lowFactor) ?? '-'} (×${cluster.lowFactor})`} />
        {rain && <Row label="ฝนที่ใช้คิด" value={`3 ชม. ${rain.r3} · 24 ชม. ${rain.r24} มม. · ${rain.rainyDays} วัน`} />}
      </dl>
      <p className="mt-3 rounded-xl bg-fill/60 px-3 py-2 text-xs leading-relaxed text-secondary">
        % = (1 − c) × base + c × report · ยิ่งมีโพสต์ใหม่มาก ยิ่งเชื่อโพสต์มาก
      </p>
    </DetailCard>
  );
}
