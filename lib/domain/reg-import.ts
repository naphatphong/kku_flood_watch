// Timetable import from the KKU registrar (reg.kku.ac.th, owner request 5 Oct 2026): the copied
// timetable grid, or rows Claude read from a screenshot. The visitor reviews every row before saving.
import { buildingCode, type Building } from './buildings';
import { minutesOf } from './timetable';
import { placeRef, type PlaceRef } from './user-data';

/** One class as the registrar shows it: "SC401201 (3) 1, SC8304 SC8" on Monday 9:00–12:00. */
export interface RegClass {
  course: string; // "SC401201"
  section: string | null; // "1"
  day: number; // 0 = Sunday … 6 = Saturday
  start: string; // "HH:MM"
  end: string;
  room: string | null; // "SC8304"
  building: string | null; // as written: "SC8", "CP9"; null for "- -"
}

/** A table cell as the browser sees it (components/timetable/reg-html.ts). */
export interface GridCell {
  text: string;
  span: number; // colspan
  rowSpan?: number;
}

const TIME = /(\d{1,2})[:.](\d{2})/g;
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const timesIn = (text: string) => [...text.matchAll(TIME)].map((m) => Number(m[1]) * 60 + Number(m[2]));

/** Day label → 0–6: "Mon", "จันทร์", "จ.", "วันเสาร์". Null for anything else. */
export function dayOf(text: string): number | null {
  const t = text.trim().toLowerCase().replace(/^วัน/, '');
  if (!t || t.length > 12 || /\d/.test(t)) return null;
  const en = ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa'].findIndex((p) => t.startsWith(p));
  if (en >= 0) return en;
  // Longer prefixes first: "อา" (Sunday) before "อ" (Tuesday), "พฤ" before "พ"; Saturday is "เสาร์".
  const th: [string, number][] = [
    ['อา', 0],
    ['จ', 1],
    ['อ', 2],
    ['พฤ', 4],
    ['พ', 3],
    ['ศ', 5],
    ['เส', 6],
    ['ส', 6],
  ];
  return th.find(([p]) => t.startsWith(p))?.[1] ?? null;
}

/** "SC401201 (3) 1, SC8304 SC8" → course, section, room, building. Null when no course code. */
export function parseRegCell(text: string): Pick<RegClass, 'course' | 'section' | 'room' | 'building'> | null {
  const t = text.replace(/\s+/g, ' ').trim().toUpperCase();
  const m = t.match(/([A-Z]{0,4}\d{6,7})\s*(?:\([^)]*\))?\s*(\d{1,3}\b)?\s*,?(.*)$/);
  if (!m) return null;
  const rest = m[3].split(/[\s,]+/).filter((x) => x && !/^-+$/.test(x));
  const isBuilding = (x: string) => /^[A-Z]{2,3}\.?\d{1,2}$/.test(x);
  const single = rest.length === 1 && isBuilding(rest[0]); // only a building, no room
  return {
    course: m[1],
    section: m[2] ?? null,
    room: single ? null : (rest[0] ?? null),
    building: single ? rest[0] : (rest.slice(1).find(isBuilding) ?? null),
  };
}

/**
 * Classes in one copied timetable grid. The header row with the time slots sets the day's time
 * line; the cells after each row's day label share it by colspan, so a class's start and end
 * come from where its cell sits (1.5-hour classes included).
 */
export function parseRegGrid(rows: GridCell[][]): RegClass[] {
  const head = rows.findIndex((r) => r.filter((c) => timesIn(c.text).length).length >= 3);
  if (head < 0) return [];
  const times = rows[head].map((c) => timesIn(c.text)).filter((t) => t.length);
  const first = times[0][0];
  const lastCell = times[times.length - 1];
  const end = lastCell.length > 1 ? lastCell[lastCell.length - 1] : lastCell[0] + (lastCell[0] - times[times.length - 2][0]); // "8:00 | 9:00 | …" headers
  const headUnits = rows[head].reduce((n, c) => n + (timesIn(c.text).length ? c.span : 0), 0);

  // Body rows: a day label first, or a row under a day label that spans several rows.
  const body: { day: number; cells: GridCell[] }[] = [];
  let carry: { day: number; left: number } | null = null;
  for (const row of rows.slice(head + 1)) {
    const day = row.length ? dayOf(row[0].text) : null;
    if (day !== null) {
      body.push({ day, cells: row.slice(1) });
      carry = (row[0].rowSpan ?? 1) > 1 ? { day, left: row[0].rowSpan! - 1 } : null;
    } else if (carry) {
      body.push({ day: carry.day, cells: row });
      carry = --carry.left > 0 ? carry : null;
    }
  }
  const width = Math.max(headUnits, ...body.map((r) => r.cells.reduce((n, c) => n + c.span, 0)));
  const at = (unit: number) => hhmm(Math.round((first + (unit / width) * (end - first)) / 5) * 5);

  const out: RegClass[] = [];
  for (const { day, cells } of body) {
    let unit = 0;
    for (const c of cells) {
      const cls = parseRegCell(c.text);
      if (cls) out.push({ ...cls, day, start: at(unit), end: at(unit + c.span) });
      unit += c.span;
    }
  }
  return out.sort((a, b) => a.day - b.day || minutesOf(a.start) - minutesOf(b.start));
}

/** The first table on the clipboard that holds a timetable (a page copy may wrap it in layout tables). */
export const parseRegTables = (tables: GridCell[][][]) => tables.map(parseRegGrid).find((list) => list.length) ?? [];

/** Rows Claude read from a screenshot (app/api/timetable/image) → classes; drops anything malformed. */
export function regClassesFrom(raw: unknown): RegClass[] {
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const time = (s: unknown) =>
    typeof s === 'string' && /^\d{1,2}:\d{2}$/.test(s.trim()) ? hhmm(minutesOf(s.trim().padStart(5, '0'))) : null;
  const text = (s: unknown, max: number) =>
    typeof s === 'string' && s.trim() && s.trim() !== '-' ? s.trim().toUpperCase().slice(0, max) : null;
  const list = (raw as { classes?: unknown })?.classes;
  if (!Array.isArray(list)) return [];
  return list.flatMap((r: Record<string, unknown>) => {
    const course = text(r.course, 20);
    const day = DAYS.indexOf(String(r.day));
    const start = time(r.start);
    const end = time(r.end);
    if (!course || day < 0 || !start || !end || minutesOf(end) <= minutesOf(start)) return [];
    return [{ course, section: text(r.section, 5), day, start, end, room: text(r.room, 20), building: text(r.building, 6) }];
  });
}

/** Building code → place, shared by everyone (table building_codes, picked by visitors). */
export type CodeMap = Record<string, PlaceRef>;

/** "SC8" / "SC 08" → "SC08", the key in a CodeMap; null when it is not a building code. */
export const codeKey = (building: string | null) => (building ? buildingCode(building) : null);

/** Where a registrar building code is: the shared mapping first, then our building list. */
export function placeForCode(building: string | null, buildings: Building[], shared: CodeMap): PlaceRef | null {
  const key = codeKey(building);
  if (!key) return null;
  if (shared[key]) return shared[key];
  const b = buildings.find((x) => x.code === key);
  return b ? placeRef(b) : null;
}
