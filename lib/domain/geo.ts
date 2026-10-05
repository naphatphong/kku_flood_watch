// Small geodesy helpers. Positions are [lng, lat] in degrees (GeoJSON order).
export type LngLat = [number, number];

const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Great-circle distance in meters (haversine). */
export function distanceM([lng1, lat1]: LngLat, [lng2, lat2]: LngLat): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/** Point offset by `eastM` / `northM` meters. Accurate to <0.1% within a few km. */
export function destination([lng, lat]: LngLat, eastM: number, northM: number): LngLat {
  const dLat = northM / EARTH_RADIUS_M;
  const dLng = eastM / (EARTH_RADIUS_M * Math.cos(toRad(lat)));
  return [lng + toDeg(dLng), lat + toDeg(dLat)];
}

/** Arithmetic mean of positions (fine for points a few km apart). */
export function centroid(points: LngLat[]): LngLat {
  const n = points.length;
  return [points.reduce((s, p) => s + p[0], 0) / n, points.reduce((s, p) => s + p[1], 0) / n];
}

/** Length of a polyline in meters. */
export function lineLengthM(line: LngLat[]): number {
  let total = 0;
  for (let i = 1; i < line.length; i++) total += distanceM(line[i - 1], line[i]);
  return total;
}

/** Initial compass bearing from a to b in degrees, 0 = north, clockwise. */
export function bearing([lng1, lat1]: LngLat, [lng2, lat2]: LngLat): number {
  const y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Point `d` meters along a polyline (clamped to its ends). */
export function pointAlong(line: LngLat[], d: number): LngLat {
  for (let i = 1; i < line.length; i++) {
    const step = distanceM(line[i - 1], line[i]);
    if (d <= step || i === line.length - 1) {
      const t = step ? Math.max(0, Math.min(1, d / step)) : 0;
      return [line[i - 1][0] + t * (line[i][0] - line[i - 1][0]), line[i - 1][1] + t * (line[i][1] - line[i - 1][1])];
    }
    d -= step;
  }
  return line[line.length - 1];
}

/** Shortest distance in meters from a point to a polyline (local flat approximation). */
export function distanceToLineM(p: LngLat, line: LngLat[]): number {
  const kx = (EARTH_RADIUS_M * Math.PI * Math.cos(toRad(p[1]))) / 180;
  const ky = (EARTH_RADIUS_M * Math.PI) / 180;
  const xy = ([lng, lat]: LngLat) => [(lng - p[0]) * kx, (lat - p[1]) * ky];
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = xy(line[i - 1]);
    const [bx, by] = xy(line[i]);
    const dx = bx - ax;
    const dy = by - ay;
    const t = dx || dy ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy))) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

/** True when a point lies inside a closed ring (ray casting; lng/lat treated as flat). */
export function insidePolygon([x, y]: LngLat, ring: LngLat[]): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}
