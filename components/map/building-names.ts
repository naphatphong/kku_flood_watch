// Every named campus building's name, small and grey from zoom 15 (owner request, 7 Oct 2026).
// Any building under the mouse turns blue (with its name); a tap on any building selects it, unnamed
// ones included, so every building can be navigated to (the page decides what a tap does).
// Buildings already highlighted (place-layer.ts) hide their grey name: the blue label shows instead.
import type { GeoJSONSource, Map as MapLibreMap, PointLike } from 'maplibre-gl';
import type { FeatureCollection, Geometry, Position } from 'geojson';
import { buildingHeightM, UNNAMED_BUILDING, type Building } from '@/lib/domain/buildings';
import { centroid, destination, distanceM, insidePolygon, type LngLat } from '@/lib/domain/geo';
import { loadBuildings } from '@/lib/hooks/useBuildings';

// The base map merges buildings of equal height into one tile feature (one id for up to hundreds of
// buildings), so its feature state can only light the few buildings that have a feature of their own.
// Everything else is lit by drawing our own blue block from the building's outline.

/** The base map's 3D blocks of a named building: "w123" → ids 1230–1232 (OpenMapTiles adds a digit to the OSM id). */
export const baseBlocks = (buildingId: string | null) =>
  buildingId && /^w\d+$/.test(buildingId)
    ? [0, 1, 2].map((k) => ({ source: 'openmaptiles', sourceLayer: 'building', id: Number(buildingId.slice(1)) * 10 + k }))
    : [];

/** A tile feature with more outlines than this is a merge of several buildings. */
export const MAX_OWN_RINGS = 4;

/** Outer rings of a (multi)polygon, each one building. */
export const ringsOf = (g: Geometry): LngLat[][] =>
  (g.type === 'Polygon' ? [g.coordinates[0]] : g.type === 'MultiPolygon' ? g.coordinates.map((p) => p[0]) : []).map(
    (r: Position[]) => r.map(([x, y]) => [x, y] as LngLat),
  );

/** A ring scaled up 3% around its centre, so our blue block wraps the base map's grey one instead of flickering through it. */
export const grow = (ring: LngLat[]): LngLat[] => {
  const [cx, cy] = centroid(ring);
  return ring.map(([x, y]) => [cx + (x - cx) * 1.03, cy + (y - cy) * 1.03]);
};

const lists = new WeakMap<MapLibreMap, Building[]>();
const TEACHING = new Set<Building['kind']>(['building', 'faculty', 'library']);
const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

const toGeoJSON = (list: Building[]): FeatureCollection => ({
  type: 'FeatureCollection',
  features: list.map((b) => ({
    type: 'Feature',
    properties: { id: b.id, name: b.name.length > 24 ? `${b.name.slice(0, 23)}…` : b.name, rank: TEACHING.has(b.kind) ? 0 : 1 },
    geometry: { type: 'Point', coordinates: b.center },
  })),
});

const unnamed = (ring: LngLat[], height: number): Building => {
  const [x, y] = centroid(ring).map((v) => Math.round(v * 1e6) / 1e6);
  return {
    id: `u${x},${y}`, // its own id: the tile feature id is shared with other buildings
    name: UNNAMED_BUILDING,
    nameEn: null,
    code: null,
    kind: 'building',
    levels: Math.max(1, Math.round(height / 3.5)),
    center: [x, y],
    polygon: ring,
  };
};

/**
 * Of the buildings in one tile feature (all `height` tall), the one the eye sees at ground point `at`:
 * walk from `at` back toward the camera; the view ray is `t / tan(pitch)` high after `t` metres, so
 * the first outline met from the roof-height point inwards is the building the ray hits.
 */
function seenRing(map: MapLibreMap, rings: LngLat[][], at: LngLat, height: number): LngLat[] | null {
  const near = rings.filter((r) => r.some((p) => distanceM(p, at) < 250));
  const pitch = map.getPitch();
  if (pitch < 5) return near.find((r) => insidePolygon(at, r)) ?? null;
  const far = Math.min(height * Math.tan((pitch * Math.PI) / 180), 300);
  const b = (map.getBearing() * Math.PI) / 180;
  for (let i = Math.ceil(far); i >= 0; i--) {
    const t = Math.min(i, far);
    const p = destination(at, -t * Math.sin(b), -t * Math.cos(b));
    const hit = near.find((r) => insidePolygon(p, r));
    if (hit) return hit;
  }
  return null;
}

/**
 * The building at a screen point and how tall to draw it. Without a 3D block there (low zoom or
 * open ground), the named outline under the point. On a block: a named building whose own tile
 * feature it is, else the one outline the eye sees in that feature, named when one of our outlines
 * holds its centre, unnamed otherwise.
 */
function pick(map: MapLibreMap, point: PointLike, at: LngLat): { building: Building; heightM: number } | null {
  const list = lists.get(map) ?? [];
  const around = (p: LngLat) => list.find((b) => b.polygon && insidePolygon(p, b.polygon));
  const ground = around(at);
  const fallback = ground ? { building: ground, heightM: buildingHeightM(ground) } : null;
  const [block] = map.getLayer('buildings-3d') ? map.queryRenderedFeatures(point, { layers: ['buildings-3d'] }) : [];
  if (!block) return fallback;
  const height = Number(block.properties.render_height) || 6;
  const rings = ringsOf(block.geometry);
  const own = rings.length <= MAX_OWN_RINGS && list.find((b) => b.id === `w${Math.floor(Number(block.id) / 10)}`);
  if (own) return { building: own, heightM: Math.max(buildingHeightM(own), height) };
  const ring = seenRing(map, rings, at, height);
  if (!ring) return fallback;
  const named = around(centroid(ring));
  return named
    ? { building: named, heightM: Math.max(buildingHeightM(named), height) }
    : { building: unnamed(ring, height), heightM: height };
}

/** The building at a screen point (see `pick`), unnamed ones included. */
export const buildingAt = (map: MapLibreMap, point: PointLike, at: LngLat): Building | null =>
  pick(map, point, at)?.building ?? null;

/** Adds the name layer and hover highlight. Call before the highlight layers so blue labels stay on top. */
export function addBuildingNames(map: MapLibreMap) {
  map.addSource('hover-3d', { type: 'geojson', data: EMPTY });
  map.addLayer({
    id: 'hover-3d',
    type: 'fill-extrusion',
    source: 'hover-3d',
    paint: { 'fill-extrusion-color': '#0A84FF', 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-opacity': 0.88 },
  });
  map.addSource('building-names', { type: 'geojson', data: toGeoJSON([]), promoteId: 'id' });
  map.addLayer({
    id: 'building-names',
    type: 'symbol',
    source: 'building-names',
    minzoom: 15,
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Regular'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 15, 10, 18, 12],
      'text-max-width': 8,
      'symbol-sort-key': ['get', 'rank'],
    },
    paint: {
      'text-color': ['case', ['boolean', ['feature-state', 'hover'], false], '#0A5FC2', '#86868B'],
      'text-halo-color': '#FFFFFF',
      'text-halo-width': 1.2,
    },
  });
  loadBuildings().then((list) => {
    lists.set(map, list);
    try {
      (map.getSource('building-names') as GeoJSONSource).setData(toGeoJSON(list));
    } catch {
      // the map was closed while the list loaded
    }
  });

  let hovered: string | null = null;
  map.on('mousemove', (e) => {
    const hit = pick(map, e.point, [e.lngLat.lng, e.lngLat.lat]);
    const id = hit?.building.id ?? null;
    if (id === hovered) return;
    if (hovered) map.setFeatureState({ source: 'building-names', id: hovered }, { hover: false });
    if (id) map.setFeatureState({ source: 'building-names', id }, { hover: true });
    hovered = id;
    const ring = hit?.building.polygon;
    (map.getSource('hover-3d') as GeoJSONSource).setData(
      ring
        ? {
            type: 'Feature',
            properties: { height: hit.heightM + 0.5 },
            geometry: { type: 'Polygon', coordinates: [grow(ring)] },
          }
        : EMPTY,
    );
    map.getCanvas().style.cursor = id ? 'pointer' : '';
  });
}

/** Hides the grey names of buildings that already have a blue label. */
export const hideNames = (map: MapLibreMap, buildingIds: string[]) =>
  map.setFilter('building-names', buildingIds.length ? ['!', ['in', ['get', 'id'], ['literal', buildingIds]]] : null);
