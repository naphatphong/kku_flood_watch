import { WATCH } from '../config';
import { lowFactor } from './cluster';
import { distanceM, type LngLat } from './geo';

/** A patch of low ground (from scripts/elevation-terciles.ts). */
export interface LowSpot {
  id: string;
  name: string | null;
  center: LngLat;
  radiusM: number;
  elevationM: number;
}

/**
 * Watch circles: low spots where the rain alone gives base >= WATCH.minPct (PLAN §5:
 * base = rain × low-lying factor of the spot's elevation), minus spots already inside a
 * circle built from posts. Riskiest first.
 */
export function watchCircles(spots: LowSpot[], rainScore: number, reported: { center: LngLat; radiusM: number }[] = []) {
  return spots
    .map((s) => ({ ...s, pct: Math.round(Math.min(100, rainScore * lowFactor([s.elevationM]) * 100)) }))
    .filter((s) => s.pct >= WATCH.minPct && !reported.some((c) => distanceM(s.center, c.center) < c.radiusM))
    .sort((a, b) => b.pct - a.pct);
}
