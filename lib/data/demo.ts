// Demo data, used only until Supabase is connected (see SETUP.md). The page shows a
// "demo" badge. Sample posts sit on real roads; clusters and road colors come from the
// same domain logic as production, so the demo behaves like the real thing.
import type { FeatureCollection } from 'geojson';
import { MAP, VEHICLES, type Passability, type StatusTag, type Vehicle, type WaterLevel } from '../config';
import { buildClusters, isFlooded } from '../domain/cluster';
import { destination, distanceM, distanceToLineM, type LngLat } from '../domain/geo';
import { isActive } from '../domain/post';
import { segmentStatuses } from '../domain/segments';
import type { Report } from '../domain/types';
import roads from '../mock-roads.json'; // main roads near KKU, © OpenStreetMap contributors (ODbL)
import type { ClusterDTO, ReportPin } from './types';

type Sample = [dxM: number, dyM: number, minutesAgo: number, level: WaterLevel, tags: StatusTag[], still?: number];

const SAMPLES: Sample[] = [
  [1380, -1800, 15, 'knee', ['rising'], 3],
  [1420, -1700, 40, 'knee', []],
  [1300, -1900, 70, 'ankle', ['drain_overflow']],
  [1450, -1860, 25, 'waist', ['raining'], 1],
  [200, -2320, 30, 'ankle', []],
  [300, -2360, 50, 'puddle', ['raining']],
  [120, -2280, 90, 'knee', []],
  [1950, -1580, 20, 'puddle', []],
  [2050, -1600, 45, 'ankle', ['rising']],
  [2175, 1408, 60, 'dry', ['receding']],
  [1100, 150, 10, 'knee', ['raining']],
  [1150, -150, 35, 'ankle', []],
];

const PASSABILITY: Record<WaterLevel, Partial<Record<Vehicle, Passability>>> = {
  dry: { motorcycle: 'ok', car: 'ok', pickup: 'ok', walk: 'ok' },
  puddle: { motorcycle: 'ok', car: 'ok', pickup: 'ok', walk: 'ok' },
  ankle: { motorcycle: 'hard', car: 'ok', pickup: 'ok', walk: 'hard' },
  knee: { motorcycle: 'blocked', car: 'hard', pickup: 'ok', walk: 'blocked' },
  waist: { motorcycle: 'blocked', car: 'blocked', pickup: 'hard', walk: 'blocked' },
};

const lines = roads.map((r) => ({ name: r.n || null, line: r.c as LngLat[] }));

/** Nearest vertex on a demo road, so sample posts sit on real streets. */
function snapToRoad(p: LngLat): LngLat {
  let best = p;
  let bestD = Infinity;
  for (const { line } of lines)
    for (const v of line) {
      const d = distanceM(p, v);
      if (d < bestD) [best, bestD] = [v, d];
    }
  return best;
}

export function demoReports(now: Date): Report[] {
  return SAMPLES.map(([dx, dy, minutes, level, tags, still = 0], i) => ({
    id: i + 1,
    kind: 'area',
    position: snapToRoad(destination(MAP.center, dx, dy)),
    radiusM: 60 + ((i * 37) % 120),
    waterLevel: level,
    statusTags: tags,
    passability: PASSABILITY[level],
    createdAt: new Date(now.getTime() - minutes * 60_000),
    lastStillVoteAt: still ? new Date(now.getTime() - 5 * 60_000) : null,
    votes: { still, receded: 0 },
    elevationM: null,
  }));
}

export const toPin = (r: Report): ReportPin => ({
  id: r.id,
  kind: r.kind,
  lng: r.position[0],
  lat: r.position[1],
  radiusM: r.radiusM,
  waterLevel: r.waterLevel,
  statusTags: r.statusTags,
  passability: r.passability,
  note: null,
  photoUrl: null,
  createdAt: r.createdAt.toISOString(),
  stillVotes: r.votes.still,
  recededVotes: r.votes.receded,
});

export function demoClusters(now: Date, rainScore: number): ClusterDTO[] {
  const active = demoReports(now).filter((r) => isActive(r, now));
  return buildClusters(active, rainScore, now)
    .filter(isFlooded)
    .map((c) => ({
      id: c.id,
      name: lines.reduce((a, b) => (distanceToLineM(c.center, b.line) < distanceToLineM(c.center, a.line) ? b : a)).name,
      lng: c.center[0],
      lat: c.center[1],
      radiusM: c.radiusM,
      reportCount: c.reportIds.length,
      base: c.base,
      report: c.report,
      c: c.c,
      final: c.final,
      lowFactor: c.lowFactor,
    }));
}

/** Demo road colors: each demo road touched by a post's circle takes that post's passability. */
export function demoSegments(now: Date): FeatureCollection {
  const reports = demoReports(now).filter((r) => isActive(r, now));
  const touched = new Map(
    reports.map((r) => [r.id, lines.flatMap((l, i) => (distanceToLineM(r.position, l.line) <= (r.radiusM ?? 0) ? [i] : []))]),
  );
  const statuses = segmentStatuses(reports, touched, now);
  return {
    type: 'FeatureCollection',
    features: [...statuses].map(([i, s]) => ({
      type: 'Feature',
      properties: { id: i, name: lines[i].name, ...Object.fromEntries(VEHICLES.map((v) => [v.id, s[v.id]])) },
      geometry: { type: 'LineString', coordinates: lines[i].line },
    })),
  };
}
