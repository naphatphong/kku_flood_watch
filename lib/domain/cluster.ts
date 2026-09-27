import { CLUSTER, SCORE } from '../config';
import { centroid, distanceM, type LngLat } from './geo';
import { postScore, postWeight } from './post';
import type { Cluster, Report } from './types';

const round = (x: number, digits = 1) => Math.round(x * 10 ** digits) / 10 ** digits;

/**
 * DBSCAN with minPts = 1: items chained within `epsM` share a group.
 * ponytail: O(n²) neighbour scan, fine for a few hundred points; move to PostGIS ST_ClusterDBSCAN beyond that.
 */
export function groupNear<T>(items: T[], position: (t: T) => LngLat, epsM: number): T[][] {
  const groups: T[][] = [];
  const seen = new Set<T>();
  for (const start of items) {
    if (seen.has(start)) continue;
    const group = [start];
    seen.add(start);
    for (let k = 0; k < group.length; k++) {
      for (const t of items) {
        if (!seen.has(t) && distanceM(position(group[k]), position(t)) <= epsM) {
          seen.add(t);
          group.push(t);
        }
      }
    }
    groups.push(group);
  }
  return groups;
}

export const groupReports = (reports: Report[]) => groupNear(reports, (r) => r.position, CLUSTER.epsM);

/** Low-lying factor from the mean ground elevation of the posts, against the area terciles. */
export function lowFactor(elevationsM: (number | null)[]): number {
  const known = elevationsM.filter((e): e is number => e != null);
  if (!known.length) return SCORE.lowFactor.normal;
  const mean = known.reduce((s, e) => s + e, 0) / known.length;
  const [t1, t2] = SCORE.elevationTercilesM;
  return mean <= t1 ? SCORE.lowFactor.low : mean <= t2 ? SCORE.lowFactor.normal : SCORE.lowFactor.high;
}

/** Risk of one group (PLAN §5): final = (1 - c) * base + c * report. */
export function scoreCluster(group: Report[], rainScore: number, now: Date): Cluster {
  const weights = group.map((r) => postWeight(r, now));
  const weightSum = weights.reduce((s, w) => s + w, 0);
  const report = weightSum ? group.reduce((s, r, i) => s + weights[i] * postScore(r), 0) / weightSum : 0;
  const c = Math.min(SCORE.confidence.max, SCORE.confidence.perWeight * weightSum);
  const low = lowFactor(group.map((r) => r.elevationM));
  const base = Math.min(100, rainScore * low * 100);
  const center = centroid(group.map((r) => r.position));
  const radiusM = Math.max(CLUSTER.minRadiusM, ...group.map((r) => distanceM(center, r.position) + (r.radiusM ?? 0)));

  return {
    id: `c${Math.min(...group.map((r) => r.id))}`,
    center,
    radiusM: Math.round(radiusM),
    reportIds: group.map((r) => r.id),
    lowFactor: low,
    base: round(base),
    report: round(report),
    c: round(c, 2),
    final: round((1 - c) * base + c * report),
    weightSum: round(weightSum, 3),
  };
}

/** All clusters of active approved reports, riskiest first. */
export function buildClusters(activeReports: Report[], rainScore: number, now: Date): Cluster[] {
  return groupReports(activeReports)
    .map((g) => scoreCluster(g, rainScore, now))
    .sort((a, b) => b.final - a.final);
}

export const isFlooded = (c: Pick<Cluster, 'report'>) => c.report >= CLUSTER.minReportToShow;
