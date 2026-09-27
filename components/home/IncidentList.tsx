import { glyphSvg } from '@/components/map/incident-icons';
import { ChevronIcon } from '@/components/ui/icons';
import { INCIDENTS, type IncidentCategory } from '@/lib/config';
import type { ReportPin } from '@/lib/data/types';
import { voteLabels } from '@/lib/domain/post';
import { timeAgo } from '@/lib/format';

/** Road incidents posted by users (accidents, closures, obstacles, road works), newest first. */
export function IncidentList({ reports, selectedId, onSelect }: { reports: ReportPin[]; selectedId: number | null; onSelect: (id: number) => void }) {
  const incidents = reports.filter((r) => r.category !== 'flood');
  if (!incidents.length) return null;
  return (
    <section>
      <h2 className="mb-1.5 px-1 text-[13px] font-semibold text-secondary">เหตุบนถนน · จากผู้ใช้</h2>
      <ul className="rounded-2xl bg-card px-3 shadow-sm">
        {incidents.map((r) => {
          const category = r.category as IncidentCategory;
          return (
            <li key={r.id} className="border-b border-separator last:border-0">
              <button
                type="button"
                onClick={() => onSelect(r.id)}
                aria-current={r.id === selectedId || undefined}
                className="flex h-[58px] w-full items-center gap-3 text-left"
              >
                <span
                  aria-hidden
                  className="grid size-8 shrink-0 place-items-center rounded-full"
                  style={{ background: INCIDENTS[category].color }}
                  dangerouslySetInnerHTML={{ __html: glyphSvg(category) }} // static SVG from constants
                />
                <span className="min-w-0 grow">
                  <span className="block truncate text-[15px] font-semibold">{INCIDENTS[category].label}</span>
                  <span className="block truncate text-xs text-secondary">
                    {timeAgo(r.createdAt)} · {voteLabels(category).still} {r.stillVotes}
                    {r.note ? ` · ${r.note}` : ''}
                  </span>
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
