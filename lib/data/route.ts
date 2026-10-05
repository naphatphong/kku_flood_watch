import 'server-only';
import { INCIDENTS, ROUTING, TRAFFIC, type IncidentCategory, type RoadStatus } from '../config';
import type { LngLat } from '../domain/geo';
import { isActive } from '../domain/post';
import { incidentsAlong, pickRoutes, routeEnds, type PathSegment, type Route, type RouteIncident, type RouteQuery } from '../domain/route';
import { createAnonClient } from '../supabase/anon';
import { activeCutoff } from './map';
import { getIncidents, trafficTime } from './traffic';

interface SegmentRow {
  id: number;
  name: string | null;
  length_m: number;
  speed_kmh: number;
  foot: boolean; // campus footpath
  traffic: number; // share of free-flow speed, 1 = no data or free
  status: RoadStatus;
  risky: boolean;
  coords: LngLat[];
}

const toPath = (rows: SegmentRow[]): PathSegment[] =>
  rows.map((r) => ({
    id: r.id,
    name: r.name ?? (r.foot ? 'ทางเดิน' : null),
    lengthM: r.length_m,
    speedKmh: r.speed_kmh,
    trafficLevel: r.traffic ?? 1,
    status: r.status,
    risky: r.risky,
    coords: r.coords,
  }));

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
      traffic_min: TRAFFIC.routeMinLevel,
    },
  });
  if (error) throw error;

  const points = data.points as { lng: number; lat: number }[];
  const safe = (data.safe as SegmentRow[][]).map(toPath);
  const routes = pickRoutes(safe, data.plain ? toPath(data.plain) : null, q.vehicle, data.fast ? toPath(data.fast) : null);
  // Cards are picked on free-flow time; live traffic then corrects the times shown.
  const [times, incidents] = await Promise.all([Promise.all(routes.map((r) => trafficTime(r.coords, q.vehicle))), incidentsNow()]);
  times.forEach((t, i) => t && Object.assign(routes[i], t));
  for (const r of routes) r.incidents = incidentsAlong(r.coords, incidents);
  return {
    routes,
    start: [points[0].lng, points[0].lat],
    end: [points[points.length - 1].lng, points[points.length - 1].lat],
    handoff: ends.handoff,
    fromOutside: ends.fromOutside,
    noSafeRoute: !safe.length,
  };
}

/**
 * Incidents worth a warning: user posts (closures are left out, routing already avoids them)
 * and TomTom incidents other than plain jams (the time on the card covers those).
 */
async function incidentsNow(): Promise<RouteIncident[]> {
  const now = new Date();
  const [posts, tomtom] = await Promise.all([
    createAnonClient()
      .from('reports')
      .select('category, lng, lat, created_at, last_still_vote_at, still_votes, receded_votes')
      .eq('status', 'approved')
      .not('category', 'in', '(flood,closure)')
      .or(`created_at.gt.${activeCutoff(now)},last_still_vote_at.gt.${activeCutoff(now)}`),
    getIncidents().catch(() => []),
  ]);
  const own = (posts.data ?? [])
    .filter((p) =>
      isActive(
        {
          category: p.category,
          createdAt: new Date(p.created_at),
          lastStillVoteAt: p.last_still_vote_at && new Date(p.last_still_vote_at),
          votes: { still: p.still_votes, receded: p.receded_votes },
        },
        now,
      ),
    )
    .map((p) => ({ label: INCIDENTS[p.category as IncidentCategory].label, at: [p.lng, p.lat] as LngLat }));
  const theirs = tomtom.filter((i) => i.category !== 6).map((i) => ({ label: `${i.label} (TomTom)`, at: i.at }));
  return [...own, ...theirs];
}
