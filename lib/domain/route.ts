// Route choice and directions (PLAN §6). The graph search runs in PostGIS/pgRouting
// (route_candidates); this turns its paths into the route cards, turn list and hand-off links.
import { INCIDENT_POST, MAP, ROUTING, VEHICLES, type RoadStatus, type Vehicle } from '../config';
import { bearing, distanceM, distanceToLineM, lineLengthM, pointAlong, type LngLat } from './geo';
import { insideArea } from './report-input';

export type RouteKind = 'safest' | 'balanced' | 'shortest';
export type Avoid = 'blocked' | 'hard'; // avoid only "blocked", or "hard" as well

/** One road segment of a path, oriented in the direction of travel. */
export interface PathSegment {
  id: number;
  name: string | null;
  lengthM: number;
  speedKmh: number;
  status: RoadStatus; // for the chosen vehicle
  risky: boolean; // inside a high-risk flood circle
  coords: LngLat[];
}

export interface RouteStep {
  text: string;
  distanceM: number; // to travel after this maneuver
  at: LngLat;
  index: number; // position in Route.coords
}

export interface FloodSpot {
  status: 'hard' | 'blocked';
  name: string | null;
  at: LngLat;
}

export interface Route {
  kinds: RouteKind[]; // one path can be both the safest and the shortest
  distanceM: number;
  durationS: number; // with live traffic when delayS is set
  delayS: number | null; // traffic delay; null = no traffic data (walking, no key, TomTom down)
  hard: number; // segment counts
  blocked: number;
  risky: number;
  spots: FloodSpot[]; // consecutive hard/blocked segments, for warnings
  incidents: RouteIncident[]; // accidents, obstacles, road works… on the way, in route order
  coords: LngLat[];
  segments: { id: number; status: RoadStatus; start: number; end: number }[]; // ranges in coords
  steps: RouteStep[];
}

export interface RouteIncident {
  label: string;
  at: LngLat;
}

export interface RouteQuery {
  from: LngLat;
  to: LngLat;
  via: LngLat[];
  vehicle: Vehicle;
  avoid: Avoid;
}

// ---- Query --------------------------------------------------------------------

const lngLat = (v: string | null): LngLat | null => {
  const [lng, lat] = (v ?? '').split(',').map(Number);
  return Number.isFinite(lng) && Number.isFinite(lat) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? [lng, lat] : null;
};

/** `?from=lng,lat&to=lng,lat&vehicle=&avoid=blocked|hard&via=lng,lat;lng,lat` */
export function parseRouteQuery(params: URLSearchParams): { ok: true; query: RouteQuery } | { ok: false; error: string } {
  const from = lngLat(params.get('from'));
  const to = lngLat(params.get('to'));
  if (!from || !to) return { ok: false, error: 'ระบุต้นทางและปลายทาง' };
  const vehicle = params.get('vehicle') ?? '';
  if (!VEHICLES.some((v) => v.id === vehicle)) return { ok: false, error: 'เลือกประเภทรถ' };
  const avoid = params.get('avoid') ?? 'blocked';
  if (avoid !== 'blocked' && avoid !== 'hard') return { ok: false, error: 'ระดับการหลบไม่ถูกต้อง' };
  const viaRaw = params.get('via') ? params.get('via')!.split(';') : [];
  const via = viaRaw.map(lngLat);
  if (via.length > ROUTING.maxVia || via.some((p) => !p || !insideArea(p)))
    return { ok: false, error: `จุดแวะต้องอยู่ในพื้นที่ และไม่เกิน ${ROUTING.maxVia} จุด` };
  return { ok: true, query: { from, to, via: via as LngLat[], vehicle: vehicle as Vehicle, avoid } };
}

// ---- Area edge (PLAN §6 "นอกพื้นที่") -------------------------------------------

const EDGE_MARGIN_M = 150; // stay this far inside the boundary, on the road network

/** Where the straight line from `inside` towards `outside` leaves the area. */
export function areaEdge(inside: LngLat, outside: LngLat): LngLat {
  const r = MAP.radiusKm * 1000 - EDGE_MARGIN_M;
  const at = (t: number): LngLat => [inside[0] + t * (outside[0] - inside[0]), inside[1] + t * (outside[1] - inside[1])];
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (distanceM(at(mid), MAP.center) <= r) lo = mid;
    else hi = mid;
  }
  return at(lo);
}

/**
 * Route ends inside the area. A destination outside is replaced by the edge point
 * (then Google Maps takes over); so is an origin outside. Both outside: no route.
 */
export function routeEnds(from: LngLat, to: LngLat) {
  const fromIn = insideArea(from);
  const toIn = insideArea(to);
  if (!fromIn && !toIn) return null;
  return {
    start: fromIn ? from : areaEdge(to, from),
    end: toIn ? to : areaEdge(from, to),
    handoff: toIn ? null : to, // the real destination, beyond the area
    fromOutside: !fromIn,
  };
}

// ---- Paths to routes ------------------------------------------------------------

const speedMps = (s: PathSegment, vehicle: Vehicle) => (vehicle === 'walk' ? ROUTING.walkSpeedKmh : s.speedKmh) / 3.6;

/** Distance, time, flood exposure and geometry of one path. */
export function summarize(path: PathSegment[], vehicle: Vehicle): Omit<Route, 'kinds'> {
  const coords: LngLat[] = [];
  const segments: Route['segments'] = [];
  for (const s of path) {
    const start = Math.max(0, coords.length - 1);
    coords.push(...(coords.length ? s.coords.slice(1) : s.coords));
    segments.push({ id: s.id, status: s.status, start, end: coords.length - 1 });
  }

  const spots: FloodSpot[] = [];
  path.forEach((s, i) => {
    if (s.status !== 'hard' && s.status !== 'blocked') return;
    const prev = path[i - 1];
    if (prev?.status === s.status) return; // same spot continues
    spots.push({ status: s.status, name: s.name, at: s.coords[Math.floor(s.coords.length / 2)] });
  });

  return {
    distanceM: Math.round(path.reduce((sum, s) => sum + s.lengthM, 0)),
    durationS: Math.round(path.reduce((sum, s) => sum + s.lengthM / speedMps(s, vehicle), 0)),
    delayS: null,
    hard: path.filter((s) => s.status === 'hard').length,
    blocked: path.filter((s) => s.status === 'blocked').length,
    risky: path.filter((s) => s.risky).length,
    spots,
    incidents: [],
    coords,
    segments,
    steps: buildSteps(path),
  };
}

/**
 * Route cards: the safest path (flood cost), the fastest of the other k paths as "balanced",
 * and the plain shortest path. A card is kept only if it saves minSavingPct of the time of
 * every card before it; a shortest path that doesn't just labels the card it matches.
 */
export function pickRoutes(safe: PathSegment[][], plain: PathSegment[] | null, vehicle: Vehicle): Route[] {
  const routes: Route[] = [];
  const faster = (r: Omit<Route, 'kinds'>) =>
    routes.every((x) => r.durationS <= x.durationS * (1 - ROUTING.minSavingPct / 100));

  if (safe.length) {
    routes.push({ kinds: ['safest'], ...summarize(safe[0], vehicle) });
    const balanced = safe
      .slice(1)
      .map((p) => summarize(p, vehicle))
      .filter(faster)
      .sort((a, b) => a.durationS - b.durationS)[0];
    if (balanced) routes.push({ kinds: ['balanced'], ...balanced });
  }
  if (plain?.length) {
    const shortest = summarize(plain, vehicle);
    if (faster(shortest)) routes.push({ kinds: ['shortest'], ...shortest });
    else routes.reduce((a, b) => (b.durationS < a.durationS ? b : a)).kinds.push('shortest');
  }
  return routes;
}

/** Incidents within routeWarnM of the route line, in the order the route passes them. */
export const incidentsAlong = (coords: LngLat[], incidents: RouteIncident[]): RouteIncident[] =>
  incidents
    .filter((i) => distanceToLineM(i.at, coords) <= INCIDENT_POST.routeWarnM)
    .map((i) => ({ i, index: nearestIndex(coords, i.at).index }))
    .sort((a, b) => a.index - b.index)
    .map(({ i }) => i);

// ---- Turn list ------------------------------------------------------------------

const LOOK_M = 20; // measure turn angles over this distance either side of the joint

/** Bearing of the last or first LOOK_M meters of a line. */
function endBearing(line: LngLat[], atEnd: boolean): number {
  const pts = atEnd ? [...line].reverse() : line;
  const far = pointAlong(pts, Math.min(LOOK_M, lineLengthM(pts)));
  return atEnd ? bearing(far, pts[0]) : bearing(pts[0], far);
}

/** Signed turn in degrees, -180..180; positive = right. */
const turnAngle = (inLine: LngLat[], outLine: LngLat[]) =>
  ((endBearing(outLine, false) - endBearing(inLine, true) + 540) % 360) - 180;

function maneuver(angle: number): string {
  const a = Math.abs(angle);
  const side = angle > 0 ? 'ขวา' : 'ซ้าย';
  if (a < 25) return 'ตรงไป';
  if (a < 60) return `เบี่ยง${side}`;
  if (a < 150) return `เลี้ยว${side}`;
  return 'กลับรถ';
}

const MIN_LEG_M = 30; // shorter unnamed pieces (junction jogs, slip roads) get no step of their own

/** "105" (an OSM ref) reads as "ถนนหมายเลข 105". */
const roadName = (name: string | null) => (name === null ? 'ถนนไม่มีชื่อ' : /^\d/.test(name) ? `ถนนหมายเลข ${name}` : name);

/**
 * Text directions: a new step where the road name changes or an unnamed road turns
 * sharply. Named roads keep their name through bends; short or straight unnamed pieces
 * fold into the road before them.
 */
export function buildSteps(path: PathSegment[]): RouteStep[] {
  if (!path.length) return [];
  type Leg = { name: string | null; coords: LngLat[]; lengthM: number; index: number };
  const legs: Leg[] = [];
  const extend = (leg: Leg, coords: LngLat[], lengthM: number) => {
    leg.coords.push(...coords.slice(1));
    leg.lengthM += lengthM;
  };
  let index = 0;
  path.forEach((s, i) => {
    const leg = legs[legs.length - 1];
    if (leg && s.name === leg.name && (s.name !== null || Math.abs(turnAngle(path[i - 1].coords, s.coords)) < 45))
      extend(leg, s.coords, s.lengthM);
    else legs.push({ name: s.name, coords: [...s.coords], lengthM: s.lengthM, index });
    index += s.coords.length - 1;
  });

  // `tail` is what the next turn is measured from; a folded jog doesn't change it.
  const merged: (Leg & { tail: LngLat[] })[] = [];
  for (const leg of legs) {
    const prev = merged[merged.length - 1];
    if (prev && leg.name === null && leg.lengthM < MIN_LEG_M) {
      if (prev.tail === prev.coords) prev.tail = [...prev.coords];
      extend(prev, leg.coords, leg.lengthM);
    } else if (
      prev &&
      ((leg.name !== null && leg.name === prev.name) || (leg.name === null && Math.abs(turnAngle(prev.tail, leg.coords)) < 25))
    ) {
      extend(prev, leg.coords, leg.lengthM);
      prev.tail = prev.coords;
    } else merged.push({ ...leg, tail: leg.coords });
  }

  const steps: RouteStep[] = merged.map((leg, i) => {
    const road = roadName(leg.name);
    if (i === 0) return { text: `ออกเดินทางตาม${road}`, distanceM: leg.lengthM, at: leg.coords[0], index: 0 };
    const verb = maneuver(turnAngle(merged[i - 1].tail, leg.coords));
    const text = verb === 'กลับรถ' ? `กลับรถ แล้วไปตาม${road}` : verb === 'ตรงไป' ? `ตรงไปตาม${road}` : `${verb}เข้า${road}`;
    return { text, distanceM: leg.lengthM, at: leg.coords[0], index: leg.index };
  });
  const last = merged[merged.length - 1];
  steps.push({ text: 'ถึงปลายทาง', distanceM: 0, at: last.coords[last.coords.length - 1], index });
  return steps.map((s) => ({ ...s, distanceM: Math.round(s.distanceM) }));
}

// ---- While driving ------------------------------------------------------------

/** Index of the route vertex nearest to `p` (progress along the route) and how far away it is. */
export function nearestIndex(coords: LngLat[], p: LngLat): { index: number; distanceM: number } {
  let best = { index: 0, distanceM: Infinity };
  coords.forEach((c, index) => {
    const d = distanceM(c, p);
    if (d < best.distanceM) best = { index, distanceM: d };
  });
  return best;
}

/** Via points in route order after adding `p`, grabbed at coord `grabIndex` of the route. */
export function insertVia(vias: LngLat[], coords: LngLat[], p: LngLat, grabIndex: number): LngLat[] {
  const keyed = vias.map((v) => ({ v, key: nearestIndex(coords, v).index }));
  keyed.push({ v: p, key: grabIndex });
  return keyed.sort((a, b) => a.key - b.key).map((x) => x.v);
}

/** True when a segment still ahead (from coord `index`) is now blocked but wasn't when routed. */
export function blockedAhead(route: Route, index: number, statusById: Map<number, RoadStatus>): boolean {
  return route.segments.some((s) => s.end > index && s.status !== 'blocked' && statusById.get(s.id) === 'blocked');
}

// ---- Google Maps hand-off -------------------------------------------------------

const latLng = ([lng, lat]: LngLat) => `${lat.toFixed(6)},${lng.toFixed(6)}`;

/**
 * Google Maps directions that follow our route through a few waypoints on it, then on to
 * `destination` (which may be beyond the area). No origin = the phone's current location.
 * Without a route (`coords` shorter than 2 points) it is a plain link to the destination.
 * ponytail: evenly spaced waypoints can miss a short detour; pick them at the detours if that shows up.
 */
export function googleMapsUrl(coords: LngLat[], destination: LngLat, vehicle: Vehicle, origin: LngLat | null = null) {
  const params = new URLSearchParams({
    api: '1',
    destination: latLng(destination),
    travelmode: vehicle === 'walk' ? 'walking' : 'driving',
  });
  if (origin) params.set('origin', latLng(origin));
  if (coords.length > 1) {
    const total = lineLengthM(coords);
    const end = coords[coords.length - 1];
    const handoff = distanceM(end, destination) > 100; // route stops at the area edge
    const n = ROUTING.mapsWaypoints - (handoff ? 1 : 0);
    const waypoints = Array.from({ length: n }, (_, i) => pointAlong(coords, (total * (i + 1)) / (n + 1)));
    if (handoff) waypoints.push(end);
    params.set('waypoints', waypoints.map(latLng).join('|'));
  }
  return `https://www.google.com/maps/dir/?${params}`;
}
