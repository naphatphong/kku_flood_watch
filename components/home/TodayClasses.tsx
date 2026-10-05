'use client';

import Link from 'next/link';
import { ClassRow } from '@/components/timetable/ClassRow';
import { NextClass } from '@/components/timetable/NextClass';
import { CalendarIcon, ChevronIcon } from '@/components/ui/icons';
import type { ClassEntry } from '@/lib/domain/timetable';

/** Home card: today's classes (numbered like on the map) and the next one to go to. */
export function TodayClasses({ classes, today, now }: { classes: ClassEntry[]; today: ClassEntry[]; now: Date }) {
  if (!classes.length)
    return (
      <Link href="/timetable" className="flex items-center gap-3 rounded-2xl bg-card p-3.5 shadow-sm">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent/10 text-link">
          <CalendarIcon size={18} />
        </span>
        <span className="min-w-0 grow">
          <span className="block text-[15px] font-semibold">ใส่ตารางเรียน</span>
          <span className="block text-xs text-secondary">แล้วดูตึกที่มีเรียนแต่ละวันบนแผนที่ พร้อมนำทางไปคาบถัดไป</span>
        </span>
        <ChevronIcon size={14} className="text-tertiary" />
      </Link>
    );
  return (
    <section className="flex flex-col gap-2">
      <NextClass classes={classes} now={now} />
      <div>
        <h2 className="mb-1.5 flex items-center px-1 text-[13px] font-semibold text-secondary">
          <span className="grow">{today.length ? `วันนี้มีเรียน ${today.length} วิชา` : 'วันนี้ไม่มีเรียน'}</span>
          <Link href="/timetable" className="font-normal text-link">
            ตารางเรียน ›
          </Link>
        </h2>
        {today.length > 0 && (
          <ul className="rounded-2xl bg-card px-3 shadow-sm">
            {today.map((c, i) => (
              <ClassRow key={c.id} entry={c} n={i + 1} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
