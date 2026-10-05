// Class timetable (owner request, 5 Oct 2026): entered by hand or pasted from the registrar.
import type { PlaceRef } from './user-data';

export interface ClassEntry {
  id: string;
  course: string; // e.g. "SC313002"
  title: string | null;
  day: number; // 0 = Sunday … 6 = Saturday
  start: string; // "HH:MM"
  end: string;
  place: PlaceRef | null; // null: no room given (online, or "- -" on the registrar)
  room: string | null;
}

export const DAY_NAMES = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
export const DAY_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
export const WEEK = [1, 2, 3, 4, 5, 6, 0]; // Monday first, as Thai timetables are

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Day of week and minutes since midnight in Thailand (UTC+7, no daylight saving). */
export function bangkokClock(now: Date) {
  const t = new Date(now.getTime() + 7 * 3_600_000);
  return { day: t.getUTCDay(), minutes: t.getUTCHours() * 60 + t.getUTCMinutes() };
}

/** One day's classes, earliest first. */
export const classesOn = (classes: ClassEntry[], day: number) =>
  classes.filter((c) => c.day === day).sort((a, b) => minutesOf(a.start) - minutesOf(b.start));

/**
 * The class to head to: one going on or later today, else the first one on a following day.
 * `inMinutes` is negative while the class is already running.
 */
export function nextClass(classes: ClassEntry[], now: Date): { entry: ClassEntry; inMinutes: number } | null {
  const { day, minutes } = bangkokClock(now);
  for (let ahead = 0; ahead < 7; ahead++) {
    const d = (day + ahead) % 7;
    const entry = classesOn(classes, d).find((c) => ahead > 0 || minutesOf(c.end) > minutes);
    if (entry) return { entry, inMinutes: ahead * 1440 + minutesOf(entry.start) - minutes };
  }
  return null;
}

export type EntryInput = Omit<ClassEntry, 'id'> & { id?: string };

/** Checks a class before it is saved; trims text. */
export function validateEntry(input: EntryInput): { ok: true; entry: ClassEntry } | { ok: false; error: string } {
  const course = input.course.trim().toUpperCase();
  if (!course) return { ok: false, error: 'ใส่รหัสหรือชื่อวิชา' };
  if (course.length > 20) return { ok: false, error: 'รหัสวิชายาวเกินไป' };
  if (!Number.isInteger(input.day) || input.day < 0 || input.day > 6) return { ok: false, error: 'เลือกวัน' };
  if (!TIME.test(input.start) || !TIME.test(input.end)) return { ok: false, error: 'ใส่เวลาเริ่มและเลิกเรียน' };
  if (minutesOf(input.end) <= minutesOf(input.start)) return { ok: false, error: 'เวลาเลิกต้องหลังเวลาเริ่ม' };
  const place = input.place;
  if (place && place.center?.length !== 2) return { ok: false, error: 'เลือกตึกที่เรียนใหม่' };
  if (place && !place.name.trim()) return { ok: false, error: 'ตั้งชื่อสถานที่ที่เลือกบนแผนที่' };
  return {
    ok: true,
    entry: {
      id: input.id ?? `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      course,
      title: input.title?.trim() || null,
      day: input.day,
      start: input.start,
      end: input.end,
      place: place && { ...place, name: place.name.trim() },
      room: input.room?.trim() || null,
    },
  };
}

/** "อีก 25 นาที" / "อีก 2 ชม. 5 นาที" / "กำลังเรียน" / "พรุ่งนี้" / "วันพุธ". */
export function whenLabel(inMinutes: number, day: number, today: number): string {
  if (inMinutes <= 0) return 'กำลังเรียน';
  if (day === today && inMinutes < 24 * 60) {
    const h = Math.floor(inMinutes / 60);
    const m = inMinutes % 60;
    return `อีก ${h ? `${h} ชม. ` : ''}${m} นาที`.replace(' 0 นาที', '');
  }
  return day === (today + 1) % 7 ? 'พรุ่งนี้' : `วัน${DAY_NAMES[day]}`;
}
