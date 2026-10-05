import Link from 'next/link';
import { RouteIcon } from '@/components/ui/icons';
import { navigateHref } from '@/lib/domain/buildings';
import type { ClassEntry } from '@/lib/domain/timetable';

/** One class: number on the map, time, course, place; navigate button; optional edit tap. */
export function ClassRow({ entry, n, onEdit }: { entry: ClassEntry; n: number; onEdit?: () => void }) {
  const body = (
    <>
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-[13px] font-bold text-white">{n}</span>
      <span className="min-w-0 grow">
        <span className="block truncate text-[15px] font-semibold">
          {entry.start}–{entry.end} · {entry.course}
        </span>
        <span className="block truncate text-xs text-secondary">
          {[entry.title, entry.place?.name ?? 'ไม่ระบุตึก', entry.room && `ห้อง ${entry.room}`].filter(Boolean).join(' · ')}
        </span>
      </span>
    </>
  );
  return (
    <li className="flex min-h-[58px] items-center gap-3 border-b border-separator py-1.5 last:border-0">
      {onEdit ? (
        <button type="button" onClick={onEdit} className="flex min-w-0 grow items-center gap-3 text-left">
          {body}
        </button>
      ) : (
        <span className="flex min-w-0 grow items-center gap-3">{body}</span>
      )}
      {entry.place && (
        <Link
          href={navigateHref(entry.place)}
          aria-label={`นำทางไป ${entry.place.name}`}
          className="grid size-9 shrink-0 place-items-center rounded-full bg-accent/10 text-link"
        >
          <RouteIcon size={17} />
        </Link>
      )}
    </li>
  );
}
