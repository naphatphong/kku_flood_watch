// Downloads named buildings and places on the KKU campus from OpenStreetMap and writes
// public/data/kku-buildings.json for building search, 3D highlight and the timetable.
//
// Run:   NODE_USE_ENV_PROXY=1 npx tsx scripts/import-buildings.ts
// Uses the main OSM API (map calls on a small grid) because Overpass is often unreachable;
// a one-off run of ~40 small requests is within its usage policy.
import { mkdirSync, writeFileSync } from 'node:fs';
import { distanceM, insidePolygon, type LngLat } from '../lib/domain/geo';
import { buildingCode, type Building } from '../lib/domain/buildings';

const API = 'https://api.openstreetmap.org/api/0.6';
const CAMPUS_RELATION = 812288; // มหาวิทยาลัยขอนแก่น (amenity=university)
const MARGIN_M = 150; // keep places just outside the fence (gates, dorms across the road)
const CELL = 0.006; // degrees per map call (the API caps area and node count)
const OUT = 'public/data/kku-buildings.json';
const HEADERS = { 'User-Agent': 'kku-campus-import (github.com/naphatphong/kku_flood_watch)' };

// Places worth finding besides buildings (key=value).
const PLACE_TAGS: Record<string, Building['kind']> = {
  'amenity=university': 'faculty',
  'amenity=college': 'faculty',
  'amenity=library': 'library',
  'amenity=food_court': 'food',
  'amenity=restaurant': 'food',
  'amenity=cafe': 'food',
  'amenity=fast_food': 'food',
  'amenity=hospital': 'health',
  'amenity=clinic': 'health',
  'amenity=pharmacy': 'health',
  'amenity=bank': 'service',
  'amenity=post_office': 'service',
  'amenity=place_of_worship': 'service',
  'amenity=theatre': 'service',
  'amenity=arts_centre': 'service',
  'tourism=museum': 'service',
  'leisure=stadium': 'sport',
  'leisure=sports_centre': 'sport',
  'leisure=swimming_pool': 'sport',
};

interface OsmNode { type: 'node'; id: number; lat: number; lon: number; tags?: Record<string, string> }
interface OsmWay { type: 'way'; id: number; nodes: number[]; tags?: Record<string, string> }
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

const nearRing = (p: LngLat, ring: LngLat[]) => ring.some((v) => distanceM(p, v) <= MARGIN_M);

/** Drops vertices closer than 1.5 m to the previous one and rounds to ~10 cm. */
const simplify = (line: LngLat[]): LngLat[] =>
  line
    .filter((p, i) => i === 0 || i === line.length - 1 || distanceM(p, line[i - 1]) >= 1.5)
    .map(([x, y]) => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6]);

const centroid = (ring: LngLat[]): LngLat => {
  const pts = ring.slice(0, -1).length ? ring.slice(0, -1) : ring;
  return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length].map(
    (v) => Math.round(v * 1e6) / 1e6,
  ) as LngLat;
};

function kindOf(tags: Record<string, string>): Building['kind'] | null {
  for (const [kv, kind] of Object.entries(PLACE_TAGS)) {
    const [k, v] = kv.split('=');
    if (tags[k] === v) return kind;
  }
  if (tags.building === 'dormitory' || /หอพัก|dormitory/i.test(tags.name ?? '')) return 'dorm';
  return tags.building ? 'building' : null;
}

async function main() {
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

  const onCampus = (p: LngLat) => campus.some((r) => insidePolygon(p, r) || nearRing(p, r));
  const places: Building[] = [];
  for (const way of ways.values()) {
    const tags = way.tags ?? {};
    const kind = tags.name ? kindOf(tags) : null;
    if (!kind || way.nodes[0] !== way.nodes[way.nodes.length - 1]) continue; // closed outlines only
    const ring = way.nodes.map((id) => nodes.get(id)).filter(Boolean).map((nd) => [nd!.lon, nd!.lat] as LngLat);
    if (ring.length < 4) continue;
    const center = centroid(ring);
    if (!onCampus(center)) continue;
    places.push(place(`w${way.id}`, tags, kind, center, tags.building ? simplify(ring) : null));
  }
  for (const nd of nodes.values()) {
    const tags = nd.tags ?? {};
    const kind = tags.name ? kindOf(tags) : null;
    const p: LngLat = [nd.lon, nd.lat];
    if (!kind || !onCampus(p)) continue;
    // A named point inside a named building outline is the same place; keep the outline.
    if (places.some((b) => b.polygon && b.name === tags.name)) continue;
    places.push(place(`n${nd.id}`, tags, kind, p, null));
  }
  places.sort((a, b) => a.name.localeCompare(b.name, 'th'));

  mkdirSync('public/data', { recursive: true });
  writeFileSync(OUT, JSON.stringify(places));
  console.log(`${places.length} places (${places.filter((p) => p.polygon).length} with outlines) → ${OUT}`);
}

function place(id: string, tags: Record<string, string>, kind: Building['kind'], center: LngLat, polygon: LngLat[] | null): Building {
  const levels = parseFloat(tags['building:levels'] ?? '');
  return {
    id,
    name: tags.name,
    nameEn: tags['name:en'] ?? null,
    code: buildingCode([tags.ref, tags.short_name, tags.name, tags['name:en']].filter(Boolean).join(' ')),
    kind,
    levels: levels > 0 ? levels : null,
    center,
    polygon,
  };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
