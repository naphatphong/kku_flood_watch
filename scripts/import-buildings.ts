// Downloads named buildings and places on the KKU campus from OpenStreetMap and writes
// public/data/kku-buildings.json for building search, 3D highlight and the timetable.
//
// Run:   NODE_USE_ENV_PROXY=1 npx tsx scripts/import-buildings.ts   (data source: scripts/osm-campus.ts)
import { mkdirSync, writeFileSync } from 'node:fs';
import { distanceM, type LngLat } from '../lib/domain/geo';
import { buildingCode, type Building } from '../lib/domain/buildings';
import { campusOsm } from './osm-campus';

const OUT = 'public/data/kku-buildings.json';

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
  const { nodes, ways, onCampus } = await campusOsm();
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
