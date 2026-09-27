// ponytail: mock data until the Supabase API (PLAN §10) exists. Swap these exports for fetches.
// The 4x4 zone grid is a placeholder: real zone names and borders are an open question (PLAN §12).
import type { FeatureCollection } from 'geojson';
import { MAP, WATER_LEVELS, zoneLevel, type RoadStatus, type Vehicle, type WaterLevel } from './config';
import roads from './mock-roads.json'; // main roads near KKU, © OpenStreetMap contributors (ODbL)

export const rain = {
  at: '14:05',
  r3: 12,
  r24: 40,
  rainyDays: 2,
  forecast3h: 8,
  hourly: [0, 0, 1, 2, 3, 5, 6, 4, 3, 4, 5, 3], // mm, last 12 hours
};

export type Zone = {
  id: string;
  name: string;
  base: number;
  report: number;
  c: number;
  final: number;
  posts: number;
  bbox: [number, number, number, number]; // west, south, east, north
};

// [base, report, c] per cell, row-major from the north-west. base = rain(0.33) x low factor (0.6/1.0/1.3).
const SCORES: [number, number, number][] = [
  [20, 0, 0], [33, 30, 0.32], [43, 75, 0.48], [43, 95, 0.8],
  [20, 0, 0], [33, 50, 0.16], [43, 75, 0.64], [43, 80, 0.8],
  [20, 0, 0], [33, 50, 0.32], [33, 0, 0.48], [43, 60, 0.32],
  [20, 0, 0], [20, 0, 0.16], [33, 0, 0], [33, 30, 0.16],
];
const N = 4;
const CELL_KM = 1.5;
const dLat = CELL_KM / 111.32;
const dLng = CELL_KM / (111.32 * Math.cos((MAP.center[1] * Math.PI) / 180));

export const zones: Zone[] = SCORES.map(([base, report, c], i) => {
  const row = Math.floor(i / N);
  const col = i % N;
  const west = MAP.center[0] + (col - N / 2) * dLng;
  const north = MAP.center[1] + (N / 2 - row) * dLat;
  const id = `${'ABCD'[row]}${col + 1}`;
  return {
    id,
    name: `โซน ${id}`,
    base,
    report,
    c,
    final: Math.round((1 - c) * base + c * report),
    posts: Math.round(c / 0.16),
    bbox: [west, north - dLat, west + dLng, north],
  };
});

const zoneAt = ([lng, lat]: number[]) =>
  zones.find(({ bbox: [w, s, e, n] }) => lng >= w && lng < e && lat >= s && lat < n);

export const zonesGeoJSON: FeatureCollection = {
  type: 'FeatureCollection',
  features: zones.map((z) => {
    const [w, s, e, n] = z.bbox;
    return {
      type: 'Feature',
      properties: { id: z.id, final: z.final, color: zoneLevel(z.final).color },
      geometry: { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
    };
  }),
};

// Mock passability: roads in risky zones get flooded statuses, every other road has no data.
const PASS: Record<string, Record<Vehicle, RoadStatus>> = {
  knee: { motorcycle: 'blocked', car: 'hard', pickup: 'ok', walk: 'blocked' },
  ankle: { motorcycle: 'hard', car: 'ok', pickup: 'ok', walk: 'hard' },
  dry: { motorcycle: 'ok', car: 'ok', pickup: 'ok', walk: 'ok' },
};
const NO_DATA = { motorcycle: 'unknown', car: 'unknown', pickup: 'unknown', walk: 'unknown' };

export const roadsGeoJSON: FeatureCollection = {
  type: 'FeatureCollection',
  features: roads.map((r, i) => {
    const final = zoneAt(r.c[Math.floor(r.c.length / 2)])?.final ?? 0;
    const level = final >= 80 ? 'knee' : final >= 60 ? 'ankle' : 'dry';
    return {
      type: 'Feature',
      properties: { name: r.n, ...(level === 'dry' && i % 2 ? NO_DATA : PASS[level]) },
      geometry: { type: 'LineString', coordinates: r.c },
    };
  }),
};

const REPORTS: { zone: string; x: number; y: number; radius: number; water: WaterLevel }[] = [
  { zone: 'A4', x: 0.3, y: 0.6, radius: 200, water: 'knee' },
  { zone: 'B4', x: 0.5, y: 0.4, radius: 150, water: 'knee' },
  { zone: 'A3', x: 0.7, y: 0.3, radius: 120, water: 'ankle' },
  { zone: 'B3', x: 0.4, y: 0.7, radius: 80, water: 'ankle' },
  { zone: 'C3', x: 0.5, y: 0.5, radius: 60, water: 'dry' },
  { zone: 'C2', x: 0.6, y: 0.2, radius: 100, water: 'puddle' },
];

export const reportsGeoJSON: FeatureCollection = {
  type: 'FeatureCollection',
  features: REPORTS.map((r) => {
    const [w, s, e, n] = zones.find((z) => z.id === r.zone)!.bbox;
    return {
      type: 'Feature',
      properties: { radius_m: r.radius, color: zoneLevel(WATER_LEVELS[r.water].score).color },
      geometry: { type: 'Point', coordinates: [w + (e - w) * r.x, n - (n - s) * r.y] },
    };
  }),
};
