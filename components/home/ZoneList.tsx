import { ChevronIcon } from '@/components/ui/icons';
import { Ring } from '@/components/ui/Ring';
import { zoneLevel } from '@/lib/config';
import type { ClusterDTO } from '@/lib/data/types';

export const clusterName = (c: ClusterDTO) => (c.name ? `ใกล้ ${c.name}` : 'จุดน้ำท่วม');

export function ZoneList({
  clusters,
  selectedId,
  onSelect,
}: {
  clusters: ClusterDTO[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <section>
      <h2 className="mb-1.5 px-1 text-[13px] font-semibold text-secondary">จุดที่มีรายงานน้ำท่วม</h2>
      {clusters.length === 0 ? (
        <p className="rounded-2xl bg-card p-4 text-[14px] text-secondary shadow-sm">
          ตอนนี้ยังไม่มีรายงานน้ำท่วมรอบ มข. เห็นน้ำท่วมตรงไหนช่วยรายงานได้เลย
        </p>
      ) : (
        <ul className="rounded-2xl bg-card px-3 shadow-sm">
          {clusters.map((c) => {
            const level = zoneLevel(c.final);
            return (
              <li key={c.id} className="border-b border-separator last:border-0">
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  aria-current={c.id === selectedId || undefined}
                  className="flex h-[58px] w-full items-center gap-3 text-left"
                >
                  <Ring pct={c.final} color={level.color} />
                  <span className="min-w-0 grow">
                    <span className="block truncate text-[15px] font-semibold">{clusterName(c)}</span>
                    <span className="block text-xs text-secondary">
                      {level.label} · {c.reportCount} จุด
                    </span>
                  </span>
                  <span className="text-[17px] font-bold" style={{ color: level.text }}>
                    {Math.round(c.final)}%
                  </span>
                  <ChevronIcon size={14} className="text-tertiary" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
