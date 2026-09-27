// Samples ground elevation on a grid over the coverage area, prints the tercile thresholds
// for the low-lying factor (PLAN §5, SCORE.elevationTercilesM) and writes the low spots used
// for watch circles (WATCH in lib/config.ts) to lib/low-spots.json.
//
// Run once (or when the area or WATCH changes):  npx tsx scripts/elevation-terciles.ts
// Source: Open-Meteo Elevation API (Copernicus DEM GLO-90), free, no key. Names: supabase/seed/roads.sql.
import { readFileSync, writeFileSync } from 'node:fs';
import { MAP, WATCH } from '../lib/config';
import { groupNear } from '../lib/domain/cluster';
import { centroid, destination, distanceM, distanceToLineM, type LngLat } from '../lib/domain/geo';
import type { LowSpot } from '../lib/domain/watch';

const GRID_M = 250;
const BATCH = 100; // API limit per request
const PAUSE_MS = 12_000; // free tier counts each coordinate; stay under ~600 per minute
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const [lng0, lat0] = MAP.center;
  const radiusM = MAP.radiusKm * 1000;
  const points: [number, number][] = [];
  for (let y = -radiusM; y <= radiusM; y += GRID_M) {
    for (let x = -radiusM; x <= radiusM; x += GRID_M) {
      const p = destination([lng0, lat0], x, y);
      if (distanceM(p, [lng0, lat0]) <= radiusM) points.push(p);
    }
  }

  const elevations: number[] = [];
  for (let i = 0; i < points.length; i += BATCH) {
    const batch = points.slice(i, i + BATCH);
    const url =
      'https://api.open-meteo.com/v1/elevation' +
      `?latitude=${batch.map((p) => p[1].toFixed(5)).join(',')}` +
      `&longitude=${batch.map((p) => p[0].toFixed(5)).join(',')}`;
    if (i > 0) await sleep(PAUSE_MS);
    let res = await fetch(url);
    if (res.status === 429) {
      await sleep(61_000);
      res = await fetch(url);
    }
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}: ${await res.text()}`);
    const { elevation } = (await res.json()) as { elevation: number[] };
    elevations.push(...elevation);
  }

  const sorted = elevations.filter(Number.isFinite).sort((a, b) => a - b);
  const q = (p: number) => sorted[Math.floor(p * (sorted.length - 1))];
  const terciles = [q(1 / 3), q(2 / 3)].map((v) => Math.round(v * 10) / 10);
  console.log(`${sorted.length} points, min ${sorted[0]} m, max ${sorted.at(-1)} m`);
  console.log(`elevationTercilesM: [${terciles.join(', ')}]`);

  // Low spots: pockets well below the ground around them, where rain water collects.
  const grid = points.map((p, i) => ({ p, e: elevations[i] })).filter((x) => Number.isFinite(x.e));
  const pockets = grid.filter((x) => {
    const around = grid.filter((y) => y !== x && distanceM(x.p, y.p) <= WATCH.neighbourM);
    return around.length && around.reduce((s, y) => s + y.e, 0) / around.length - x.e >= WATCH.pocketDepthM;
  });
  const spots: LowSpot[] = [];
  for (const group of groupNear(pockets, (x) => x.p, WATCH.epsM).filter((g) => g.length >= WATCH.minPoints)) {
    const center = centroid(group.map((x) => x.p));
    spots.push({
      id: `w${spots.length + 1}`,
      name: await placeName(center),
      center: center.map((v) => Math.round(v * 1e5) / 1e5) as LngLat,
      radiusM: Math.round(Math.max(...group.map((x) => distanceM(center, x.p))) + GRID_M / 2),
      elevationM: Math.round((group.reduce((s, x) => s + x.e, 0) / group.length) * 10) / 10,
    });
  }
  writeFileSync('lib/low-spots.json', JSON.stringify(spots, null, 1) + '\n');
  console.log(`${pockets.length} pocket points → ${spots.length} low spots → lib/low-spots.json`);
}

// Named roads from the OSM seed, to label spots like the post circles ("near <road>").
const namedRoads = [...readFileSync('supabase/seed/roads.sql', 'utf8').matchAll(/^\(\d+,\d+,'((?:[^']|'')+)',.*LINESTRING\(([^)]*)\)'\)/gm)].map(
  ([, name, wkt]) => ({ name: name.replace(/''/g, "'"), line: wkt.split(',').map((xy) => xy.split(' ').map(Number) as LngLat) }),
);

/** Nearest named road within 800 m of a spot, or null. */
async function placeName(p: LngLat): Promise<string | null> {
  let best: { name: string; d: number } | null = null;
  for (const r of namedRoads) {
    const d = distanceToLineM(p, r.line);
    if (d <= 800 && (!best || d < best.d)) best = { name: r.name, d };
  }
  return best?.name ?? null;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
