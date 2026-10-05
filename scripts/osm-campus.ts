// Everything OpenStreetMap has on the KKU campus, from the main OSM API (map calls on a small
// grid; Overpass is often unreachable). ~40 small requests per run, within the API usage policy.
// Run scripts with NODE_USE_ENV_PROXY=1 when behind a proxy.
import { distanceM, insidePolygon, type LngLat } from '../lib/domain/geo';

const API = 'https://api.openstreetmap.org/api/0.6';
const CAMPUS_RELATION = 812288; // มหาวิทยาลัยขอนแก่น (amenity=university)
const MARGIN_M = 150; // keep things just outside the fence (gates, dorms across the road)
const CELL = 0.006; // degrees per map call (the API caps area and node count)
const HEADERS = { 'User-Agent': 'kku-campus-import (github.com/naphatphong/kku_flood_watch)' };

export interface OsmNode { type: 'node'; id: number; lat: number; lon: number; tags?: Record<string, string> }
export interface OsmWay { type: 'way'; id: number; nodes: number[]; tags?: Record<string, string> }
interface OsmRelation { type: 'relation'; id: number; members: { type: string; ref: number; role: string }[]; tags?: Record<string, string> }
type Osm = OsmNode | OsmWay | OsmRelation;

async function get(path: string): Promise<Osm[]> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${API}${path}`, { headers: HEADERS });
    if (res.ok) return (await res.json()).elements;
    if (attempt >= 4) throw new Error(`OSM ${res.status} ${path}: ${(await res.text()).slice(0, 200)}`);
    await new Promise((r) => setTimeout(r, attempt * 3000));
  }
}

/** Outer rings of a multipolygon: chain member ways end to end. */
function rings(rel: OsmRelation, ways: Map<number, OsmWay>, nodes: Map<number, LngLat>): LngLat[][] {
  const parts = rel.members.filter((m) => m.type === 'way' && m.role === 'outer').map((m) => [...ways.get(m.ref)!.nodes]);
  const out: LngLat[][] = [];
  while (parts.length) {
    const ring = parts.shift()!;
    for (let grew = true; grew && ring[0] !== ring[ring.length - 1]; ) {
      grew = false;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        const end = ring[ring.length - 1];
        if (p[0] === end) ring.push(...p.slice(1));
        else if (p[p.length - 1] === end) ring.push(...[...p].reverse().slice(1));
        else continue;
        parts.splice(i, 1);
        grew = true;
        break;
      }
    }
    out.push(ring.map((id) => nodes.get(id)!));
  }
  return out;
}

/** Nodes and ways around the campus, and a test for "on campus" (inside the fence or near it). */
export async function campusOsm() {
  const campusEls = await get(`/relation/${CAMPUS_RELATION}/full.json`);
  const cNodes = new Map(campusEls.filter((e): e is OsmNode => e.type === 'node').map((n) => [n.id, [n.lon, n.lat] as LngLat]));
  const cWays = new Map(campusEls.filter((e): e is OsmWay => e.type === 'way').map((w) => [w.id, w]));
  const campus = rings(campusEls.find((e): e is OsmRelation => e.type === 'relation')!, cWays, cNodes);
  const lons = [...cNodes.values()].map((p) => p[0]);
  const lats = [...cNodes.values()].map((p) => p[1]);
  const pad = 0.002;
  const [w, s, e, n] = [Math.min(...lons) - pad, Math.min(...lats) - pad, Math.max(...lons) + pad, Math.max(...lats) + pad];

  const nodes = new Map<number, OsmNode>();
  const ways = new Map<number, OsmWay>();
  const cells: [number, number][] = [];
  for (let x = w; x < e; x += CELL) for (let y = s; y < n; y += CELL) cells.push([x, y]);
  for (const [i, [x, y]] of cells.entries()) {
    const bbox = [x, y, Math.min(x + CELL, e), Math.min(y + CELL, n)].map((v) => v.toFixed(6)).join(',');
    for (const el of await get(`/map.json?bbox=${bbox}`)) {
      if (el.type === 'node') nodes.set(el.id, el);
      else if (el.type === 'way') ways.set(el.id, el);
    }
    process.stdout.write(`\r  OSM ${i + 1}/${cells.length}`);
  }
  console.log();

  const onCampus = (p: LngLat) => campus.some((r) => insidePolygon(p, r) || r.some((v) => distanceM(p, v) <= MARGIN_M));
  return { nodes, ways, onCampus };
}
