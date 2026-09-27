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
