// Samples ground elevation on a grid over the coverage area and prints the
// tercile thresholds used for the low-lying factor (PLAN §5, SCORE.elevationTercilesM).
//
// Run once (or when the area changes):  npx tsx scripts/elevation-terciles.ts
// Source: Open-Meteo Elevation API (Copernicus DEM GLO-90), free, no key.
import { MAP } from '../lib/config';
import { destination, distanceM } from '../lib/domain/geo';

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
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
