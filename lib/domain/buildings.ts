// Campus buildings and places (public/data/kku-buildings.json, from scripts/import-buildings.ts).
import { BUILDING_ALIASES } from '../building-aliases';
import type { LngLat } from './geo';

export interface Building {
  id: string; // OSM: "w<way id>" or "n<node id>"
  name: string;
  nameEn: string | null;
  code: string | null; // e.g. "SC01", when the name or ref carries one
  kind: 'building' | 'faculty' | 'dorm' | 'library' | 'food' | 'health' | 'service' | 'sport';
  levels: number | null;
  center: LngLat;
  polygon: LngLat[] | null; // outline, for the 3D highlight
}

/** First building code in a text: "SC 1", "sc-01", "SC. 09", "EN18" → "SC01", "SC09", "EN18". */
export function buildingCode(text: string): string | null {
  const m = text.toUpperCase().match(/\b([A-Z]{2,3})[\s.\-]*(\d{1,2})\b/);
  return m ? `${m[1]}${m[2].padStart(2, '0')}` : null;
}

// Search text: no spaces or case, no leading zeros ("sc09" = "sc9"), and no "ะ" so "วิศวะ" finds "วิศวกรรม".
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[\s\-_.()]+/g, '')
    .replace(/ะ/g, '')
    .replace(/(^|\D)0+(\d)/g, '$1$2');
const STOP = new Set(['ตึก', 'อาคาร', 'building', 'bldg']); // people say either; names use one

/** Places matching every word of the query, best first. */
export function searchBuildings(list: Building[], query: string, limit = 8): Building[] {
  const words = query
    .replace(/([A-Za-z]{2,3})[\s.\-]+(\d)/g, '$1$2') // "SC 09" is one word
    .split(/\s+/).filter((w) => w && !STOP.has(w.toLowerCase())).map(norm).filter(Boolean);
  if (!words.length) return [];
  const scored = list.flatMap((b) => {
    const names = [b.name, b.nameEn ?? '', ...(BUILDING_ALIASES[b.id] ?? [])].map(norm);
    const code = b.code ? norm(b.code) : '';
    let score = 0;
    for (const w of words) {
      if (w === code) score += 100;
      else if (names.some((n) => n.startsWith(w))) score += 40;
      else if (names.some((n) => n.includes(w)) || (code && code.startsWith(w))) score += 20;
      else return [];
    }
    if (b.kind === 'building' || b.kind === 'faculty') score += 5; // teaching places first on ties
    return [{ b, score: score - b.name.length / 100 }];
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.b);
}

/** 3D highlight height: levels × 3.5 m, or a typical 3-storey block. */
export const buildingHeightM = (b: Pick<Building, 'levels'>) => (b.levels ?? 3) * 3.5;

export const KIND_LABELS: Record<Building['kind'], string> = {
  building: 'อาคาร',
  faculty: 'คณะ/หน่วยงาน',
  dorm: 'หอพัก',
  library: 'ห้องสมุด',
  food: 'ร้านอาหาร',
  health: 'สุขภาพ',
  service: 'บริการ',
  sport: 'กีฬา',
};

/** `/navigate` link that ends at a place. */
export const navigateHref = (p: { name: string; center: LngLat }) =>
  `/navigate?${new URLSearchParams({ to: p.center.join(','), name: p.name })}`;
