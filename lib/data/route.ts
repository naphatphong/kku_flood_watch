import 'server-only';
import { ROUTING, type RoadStatus } from '../config';
import type { LngLat } from '../domain/geo';
import { pickRoutes, routeEnds, type PathSegment, type Route, type RouteQuery } from '../domain/route';
import { createAnonClient } from '../supabase/anon';
import { trafficTime } from './traffic';

interface SegmentRow {
  id: number;
  name: string | null;
  length_m: number;
  speed_kmh: number;
  status: RoadStatus;
  risky: boolean;
  coords: LngLat[];
}

const toPath = (rows: SegmentRow[]): PathSegment[] =>
  rows.map((r) => ({ id: r.id, name: r.name, lengthM: r.length_m, speedKmh: r.speed_kmh, status: r.status, risky: r.risky, coords: r.coords }));

export interface RouteResponse {
  routes: Route[]; // empty when no path exists at all
  start: LngLat; // where the routes begin and end (snapped to the road network)
  end: LngLat;
  handoff: LngLat | null; // destination beyond the area: continue with Google Maps from `end`
  fromOutside: boolean; // origin beyond the area: routes start at its edge
  noSafeRoute: boolean; // every path crosses a road the user asked to avoid
}

export class RouteError extends Error {}

/** Route cards for a query (PLAN §6): pgRouting candidates → safest / balanced / shortest. */
export async function getRoutes(q: RouteQuery): Promise<RouteResponse> {
  const ends = routeEnds(q.from, q.to);
  if (!ends) throw new RouteError('ต้นทางและปลายทางอยู่นอกพื้นที่ ใช้ Google Maps ได้เลย');

  const { data, error } = await createAnonClient().rpc('route_candidates', {
    p_points: [ends.start, ...q.via, ends.end],
    p: {
      vehicle: q.vehicle,
      avoid_hard: q.avoid === 'hard',
      walk_kmh: ROUTING.walkSpeedKmh,
      hard_factor: ROUTING.costFactor.hard,
      risky_min: ROUTING.riskyClusterMin,
      risky_penalty: ROUTING.riskyClusterPenalty,
      k: ROUTING.alternatives,
    },
  });
  if (error) throw error;

  const points = data.points as { lng: number; lat: number }[];
  const safe = (data.safe as SegmentRow[][]).map(toPath);
  const routes = pickRoutes(safe, data.plain ? toPath(data.plain) : null, q.vehicle);
  // Cards are picked on free-flow time; live traffic then corrects the times shown.
  const times = await Promise.all(routes.map((r) => trafficTime(r.coords, q.vehicle)));
  times.forEach((t, i) => t && Object.assign(routes[i], t));
  return {
    routes,
    start: [points[0].lng, points[0].lat],
    end: [points[points.length - 1].lng, points[points.length - 1].lat],
    handoff: ends.handoff,
    fromOutside: ends.fromOutside,
    noSafeRoute: !safe.length,
  };
}
