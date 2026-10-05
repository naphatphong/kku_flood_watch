import Link from 'next/link';
import { RouteIcon } from '@/components/ui/icons';
import { navigateHref } from '@/lib/domain/buildings';
import { bangkokClock, nextClass, whenLabel, type ClassEntry } from '@/lib/domain/timetable';

/** "Next: SC313002 at 13:00, SC09 — in 25 min" with a navigate button. */
export function NextClass({ classes, now }: { classes: ClassEntry[]; now: Date }) {
  const next = nextClass(classes, now);
  if (!next) return null;
  const { entry, inMinutes } = next;
  return (
    <section className="flex items-center gap-3 rounded-2xl bg-accent p-3.5 text-white shadow-sm">
      <span className="min-w-0 grow">
        <span className="block text-[12px] font-semibold opacity-85">คาบถัดไป · {whenLabel(inMinutes, entry.day, bangkokClock(now).day)}</span>
        <span className="block truncate text-[16px] font-bold">
          {entry.start} · {entry.course}
        </span>
        <span className="block truncate text-[13px] opacity-90">
          {entry.place.name}
          {entry.room ? ` · ห้อง ${entry.room}` : ''}
        </span>
      </span>
      <Link
        href={navigateHref(entry.place)}
        className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 text-[14px] font-semibold text-link"
      >
        <RouteIcon size={16} />
        นำทาง
      </Link>
    </section>
  );
}
