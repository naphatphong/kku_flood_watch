import {
  MAP,
  POST,
  ROAD_STATUS,
  STATUS_TAGS,
  VEHICLES,
  WATER_LEVELS,
  type Passability,
  type StatusTag,
  type Vehicle,
  type WaterLevel,
} from '../config';
import { distanceM, type LngLat } from './geo';
import type { ReportKind } from './types';

export interface ReportInput {
  kind: ReportKind;
  position: LngLat; // road posts: replaced by the point halfway along the chosen segments
  radiusM: number | null;
  segmentIds: number[];
  waterLevel: WaterLevel;
  statusTags: StatusTag[];
  passability: Partial<Record<Vehicle, Passability>>;
  note: string | null;
  poster: LngLat | null; // poster's GPS at posting time
}

type Result = { ok: true; input: ReportInput } | { ok: false; error: string };

const MAX_SEGMENTS = 40;
const num = (v: FormDataEntryValue | null) => (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
const list = (v: FormDataEntryValue | null) =>
  typeof v === 'string' && v ? v.split(',').map((x) => x.trim()).filter(Boolean) : [];
const isLngLat = (p: LngLat) => Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[1]) <= 90;

export const insideArea = (p: LngLat) => distanceM(p, MAP.center) <= MAP.radiusKm * 1000;

/** Validates the report form against lib/config.ts. The server is the source of truth. */
export function parseReportForm(form: FormData): Result {
  const fail = (error: string): Result => ({ ok: false, error });

  const kind = form.get('kind');
  if (kind !== 'area' && kind !== 'road') return fail('เลือกชนิดโพสต์: พื้นที่ หรือ ถนน');

  const waterLevel = form.get('water_level');
  if (typeof waterLevel !== 'string' || !Object.hasOwn(WATER_LEVELS, waterLevel)) return fail('เลือกระดับน้ำ');

  const statusTags = [...new Set(list(form.get('status_tags')))];
  if (statusTags.some((t) => !Object.hasOwn(STATUS_TAGS, t))) return fail('แท็กสถานะไม่ถูกต้อง');

  let passability: Record<string, string> = {};
  try {
    passability = JSON.parse(String(form.get('passability') ?? '{}'));
  } catch {
    return fail('ข้อมูลการผ่านไม่ถูกต้อง');
  }
  const vehicles = new Set<string>(VEHICLES.map((v) => v.id));
  if (
    typeof passability !== 'object' ||
    Array.isArray(passability) ||
    Object.entries(passability).some(([v, s]) => !vehicles.has(v) || typeof s !== 'string' || !Object.hasOwn(ROAD_STATUS, s) || s === 'unknown')
  )
    return fail('ข้อมูลการผ่านไม่ถูกต้อง');

  const note = String(form.get('note') ?? '').trim() || null;
  if (note && note.length > POST.noteMaxLength) return fail(`ข้อความยาวได้ไม่เกิน ${POST.noteMaxLength} ตัวอักษร`);

  const position: LngLat = [num(form.get('lng')), num(form.get('lat'))];
  const posterRaw: LngLat = [num(form.get('poster_lng')), num(form.get('poster_lat'))];
  const poster = isLngLat(posterRaw) ? posterRaw : null;

  let radiusM: number | null = null;
  let segmentIds: number[] = [];
  if (kind === 'area') {
    if (!isLngLat(position)) return fail('ปักหมุดตำแหน่งก่อน');
    if (!insideArea(position)) return fail(`ตำแหน่งต้องอยู่ในรัศมี ${MAP.radiusKm} กม. รอบ มข.`);
    radiusM = Math.round(num(form.get('radius_m')));
    if (!(radiusM >= POST.radiusM.min && radiusM <= POST.radiusM.max))
      return fail(`รัศมีต้องอยู่ระหว่าง ${POST.radiusM.min}–${POST.radiusM.max} ม.`);
  } else {
    segmentIds = [...new Set(list(form.get('segment_ids')).map(Number))];
    if (!segmentIds.length || segmentIds.some((id) => !Number.isInteger(id) || id <= 0))
      return fail('แตะเลือกถนนอย่างน้อย 1 ท่อน');
    if (segmentIds.length > MAX_SEGMENTS) return fail('เลือกท่อนถนนมากเกินไป');
  }

  return {
    ok: true,
    input: {
      kind,
      position,
      radiusM,
      segmentIds,
      waterLevel: waterLevel as WaterLevel,
      statusTags: statusTags as StatusTag[],
      passability: passability as Partial<Record<Vehicle, Passability>>,
      note,
      poster,
    },
  };
}
