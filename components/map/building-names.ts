// Every named campus building's name, small and grey from zoom 15 (owner request, 7 Oct 2026).
// Any building under the mouse turns blue (with its name); a tap on any building selects it, unnamed
// ones included, so every building can be navigated to (the page decides what a tap does).
// Buildings already highlighted (place-layer.ts) hide their grey name: the blue label shows instead.
import type { GeoJSONSource, Map as MapLibreMap, PointLike } from 'maplibre-gl';
import type { FeatureCollection, Position } from 'geojson';
import { UNNAMED_BUILDING, type Building } from '@/lib/domain/buildings';
import { insidePolygon, type LngLat } from '@/lib/domain/geo';
import { loadBuildings } from '@/lib/hooks/useBuildings';

/**
 * The base map's 3D blocks of a building: "w123" → ids 1230–1232 (OpenMapTiles adds a digit to the
 * OSM id); "b4567" (an unnamed block tapped on the map) → exactly block 4567.
 */
export const baseBlocks = (buildingId: string | null) => {
  const block = (id: number) => ({ source: 'openmaptiles', sourceLayer: 'building', id });
  if (buildingId && /^b\d+$/.test(buildingId)) return [block(Number(buildingId.slice(1)))];
  return buildingId && /^w\d+$/.test(buildingId) ? [0, 1, 2].map((k) => block(Number(buildingId.slice(1)) * 10 + k)) : [];
};

const lists = new WeakMap<MapLibreMap, Building[]>();
const TEACHING = new Set<Building['kind']>(['building', 'faculty', 'library']);

const toGeoJSON = (list: Building[]): FeatureCollection => ({
  type: 'FeatureCollection',
  features: list.map((b) => ({
    type: 'Feature',
    properties: { id: b.id, name: b.name.length > 24 ? `${b.name.slice(0, 23)}…` : b.name, rank: TEACHING.has(b.kind) ? 0 : 1 },
    geometry: { type: 'Point', coordinates: b.center },
  })),
});

/**
 * The building at a screen point. Named buildings win, best match first: the 3D block drawn there
 * (what the eye sees in a tilted view), a named outline around that block (OSM relations and
 * building parts have other block ids), then a named outline under the point on the ground (as
 * before 3D picking). Only then does an unnamed block count, as an unnamed building from its tile shape.
 */
export function buildingAt(map: MapLibreMap, point: PointLike, at: LngLat): Building | null {
  const list = lists.get(map) ?? [];
  const around = (p: LngLat) => list.find((b) => b.polygon && insidePolygon(p, b.polygon));
  const [block] = map.getLayer('buildings-3d') ? map.queryRenderedFeatures(point, { layers: ['buildings-3d'] }) : [];
  if (!block) return around(at) ?? null;
  const g = block.geometry;
  const ring = (g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates[0][0] : null) as
    | Position[]
    | null;
  // ponytail: shape from the tile under the point, so a block cut by a tile edge gets a slightly off centre.
  const pts = (ring ?? []).slice(0, -1).map(([x, y]) => [x, y] as LngLat);
  const center: LngLat | null = pts.length
    ? [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length]
    : null;
  const id = `w${Math.floor(Number(block.id) / 10)}`;
  const named = list.find((b) => b.id === id) ?? (center && around(center)) ?? around(at);
  if (named) return named;
  if (!center) return null;
  const height = Number(block.properties.render_height);
  return {
    id: `b${block.id}`, // this block only (neighbours can share the OSM-derived id)
    name: UNNAMED_BUILDING,
    nameEn: null,
    code: null,
    kind: 'building',
    levels: height > 0 ? Math.max(1, Math.round(height / 3.5)) : null,
    center: [Math.round(center[0] * 1e6) / 1e6, Math.round(center[1] * 1e6) / 1e6],
    polygon: pts,
  };
}

/** Adds the name layer and hover highlight. Call before the highlight layers so blue labels stay on top. */
export function addBuildingNames(map: MapLibreMap) {
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
  const hover = (id: string | null, on: boolean) => {
    if (!id) return;
    map.setFeatureState({ source: 'building-names', id }, { hover: on });
    for (const f of baseBlocks(id)) map.setFeatureState(f, { hover: on });
  };
  map.on('mousemove', (e) => {
    const id = buildingAt(map, e.point, [e.lngLat.lng, e.lngLat.lat])?.id ?? null;
    if (id === hovered) return;
    hover(hovered, false);
    hover(id, true);
    hovered = id;
    map.getCanvas().style.cursor = id ? 'pointer' : '';
  });
}

/** Hides the grey names of buildings that already have a blue label. */
export const hideNames = (map: MapLibreMap, buildingIds: string[]) =>
  map.setFilter('building-names', buildingIds.length ? ['!', ['in', ['get', 'id'], ['literal', buildingIds]]] : null);
