import { ChevronIcon } from '@/components/ui/icons';
import { Ring } from '@/components/ui/Ring';
import { zoneLevel } from '@/lib/config';
import type { WatchDTO } from '@/lib/data/types';

export const watchName = (w: WatchDTO) => (w.name ? `พื้นที่ต่ำใกล้ ${w.name}` : 'พื้นที่ต่ำ');

/** Watch circles: estimated from rain and low ground, shown apart from reported flooding. */
export function WatchList({ watch, selectedId, onSelect }: { watch: WatchDTO[]; selectedId: string | null; onSelect: (id: string) => void }) {
  if (!watch.length) return null;
  return (
    <section>
      <h2 className="mb-1.5 px-1 text-[13px] font-semibold text-secondary">เฝ้าระวัง · คาดการณ์จากฝนและพื้นที่ต่ำ</h2>
      <ul className="rounded-2xl bg-card px-3 shadow-sm">
        {watch.map((w) => {
          const level = zoneLevel(w.pct);
          return (
            <li key={w.id} className="border-b border-separator last:border-0">
              <button
                type="button"
                onClick={() => onSelect(w.id)}
                aria-current={w.id === selectedId || undefined}
                className="flex h-[58px] w-full items-center gap-3 text-left"
              >
                <Ring pct={w.pct} color={level.color} />
                <span className="min-w-0 grow">
                  <span className="block truncate text-[15px] font-semibold">{watchName(w)}</span>
                  <span className="block text-xs text-secondary">ยังไม่มีรายงาน · รัศมี {w.radiusM} ม.</span>
                </span>
                <span className="text-[17px] font-bold" style={{ color: level.text }}>
                  {w.pct}%
                </span>
                <ChevronIcon size={14} className="text-tertiary" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
