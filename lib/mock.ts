// ponytail: mock data until the Supabase API (PLAN §10) exists. Swap these exports for fetches.
// Zones are circles (center + radius); real zone list is an open question (PLAN §12).
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

// km <-> degrees around the map center (equirectangular, fine for a 5 km area)
const KM_LAT = 1 / 111.32;
const KM_LNG = 1 / (111.32 * Math.cos((MAP.center[1] * Math.PI) / 180));
const toLngLat = (dxKm: number, dyKm: number): [number, number] => [MAP.center[0] + dxKm * KM_LNG, MAP.center[1] + dyKm * KM_LAT];
const distKm = ([lng, lat]: number[], [lng0, lat0]: number[]) => Math.hypot((lng - lng0) / KM_LNG, (lat - lat0) / KM_LAT);

export type Zone = {
  id: string;
  name: string;
  center: [number, number];
  radiusM: number;
  base: number;
  report: number;
  c: number;
  final: number;
  points: number; // report pins in this zone
  bbox: [number, number, number, number]; // west, south, east, north
};

// [dx km, dy km from map center, base, report, c]. base = rain(0.33) x low factor (0.6/1.0/1.3).
const ZONES: [number, number, number, number, number][] = [
  [2.2, 2.0, 43, 95, 0.8],
  [2.4, 0.5, 43, 80, 0.8],
  [0.9, 0.6, 43, 75, 0.64],
  [0.8, 2.2, 43, 75, 0.48],
  [2.3, -1.2, 43, 60, 0.32],
  [-0.7, -0.8, 33, 50, 0.32],
  [-0.8, 1.5, 33, 50, 0.16],
  [0.9, -1.0, 33, 0, 0.48],
  [0.5, -2.4, 33, 30, 0.16],
  [-2.2, 0.3, 20, 0, 0],
];
const RADIUS_M = 600;

// Only flooded zones are shown: at least one report with water (puddle or deeper).
export const zones = ZONES.map(([dx, dy, base, report, c], i): Zone => {
  const r = RADIUS_M / 1000;
  const [w, s] = toLngLat(dx - r, dy - r);
  const [e, n] = toLngLat(dx + r, dy + r);
  return {
    id: String(i + 1),
    name: `โซน ${i + 1}`,
    center: toLngLat(dx, dy),
    radiusM: RADIUS_M,
    base,
    report,
    c,
    final: Math.round((1 - c) * base + c * report),
    points: Math.round(c / 0.16), // c = min(0.8, 0.16 * Σw), so c/0.16 recent reports
    bbox: [w, s, e, n],
  };
}).filter((z) => z.points > 0 && z.report >= WATER_LEVELS.puddle.score);

const zoneAt = (p: number[]) => zones.find((z) => distKm(p, z.center) * 1000 < z.radiusM);

export const zonesGeoJSON: FeatureCollection = {
  type: 'FeatureCollection',
  features: zones.map((z) => ({
    type: 'Feature',
    properties: { id: z.id, final: z.final, points: z.points, radius_m: z.radiusM, color: zoneLevel(z.final).color },
    geometry: { type: 'Point', coordinates: z.center },
  })),
};

// Mock passability: roads in risky zones get flooded statuses, roads outside zones mostly have no data.
const PASS: Record<string, Record<Vehicle, RoadStatus>> = {
  knee: { motorcycle: 'blocked', car: 'hard', pickup: 'ok', walk: 'blocked' },
  ankle: { motorcycle: 'hard', car: 'ok', pickup: 'ok', walk: 'hard' },
  dry: { motorcycle: 'ok', car: 'ok', pickup: 'ok', walk: 'ok' },
};
const NO_DATA = { motorcycle: 'unknown', car: 'unknown', pickup: 'unknown', walk: 'unknown' };

export const roadsGeoJSON: FeatureCollection = {
  type: 'FeatureCollection',
  features: roads.map((r, i) => {
    const zone = zoneAt(r.c[Math.floor(r.c.length / 2)]);
    const final = zone?.final ?? 0;
    const level = final >= 80 ? 'knee' : final >= 60 ? 'ankle' : 'dry';
    return {
      type: 'Feature',
      properties: { name: r.n, ...(!zone && i % 3 ? NO_DATA : PASS[level]) },
      geometry: { type: 'LineString', coordinates: r.c },
    };
  }),
};

// Report pins: `points` per zone, spread on a sunflower spiral inside the zone circle.
const levelFor = (score: number) =>
  (Object.keys(WATER_LEVELS) as WaterLevel[]).reduce((a, b) =>
    Math.abs(WATER_LEVELS[b].score - score) < Math.abs(WATER_LEVELS[a].score - score) ? b : a,
  );

export const reportsGeoJSON: FeatureCollection = {
  type: 'FeatureCollection',
  features: zones.flatMap((z) =>
    Array.from({ length: z.points }, (_, k) => {
      const angle = k * 2.39996; // golden angle, radians
      const d = (z.radiusM / 1000) * 0.75 * Math.sqrt((k + 0.5) / z.points);
      const [lng0, lat0] = z.center;
      return {
        type: 'Feature' as const,
        properties: { radius_m: 50 + ((k * 37) % 120), color: zoneLevel(WATER_LEVELS[levelFor(z.report)].score).color },
        geometry: {
          type: 'Point' as const,
          coordinates: [lng0 + d * Math.cos(angle) * KM_LNG, lat0 + d * Math.sin(angle) * KM_LAT],
        },
      };
    }),
  ),
};
