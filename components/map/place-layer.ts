// Highlighted campus places: the selected building, today's classes, saved places.
// From zoom 14 the map's own 3D building turns blue (feature state; OpenMapTiles ids are the
// OSM way id × 10 plus a digit). Below that, or when the base map lacks the block, our outline is
// drawn instead. Places without an outline get a pin.
import type { FillExtrusionLayerSpecification, GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import { buildingHeightM, type Building } from '@/lib/domain/buildings';
import type { LngLat } from '@/lib/domain/geo';
import type { PlaceRef } from '@/lib/domain/user-data';
import { addBuildingNames, baseBlocks, hideNames } from './building-names';

export interface Highlight {
  key: string;
  buildingId: string | null; // campus building ("w123"), to light up its 3D block
  name: string;
  label: string | null; // e.g. "1" for the first class of the day
  center: LngLat;
  polygon: LngLat[] | null;
  heightM: number;
}

const COLOR = '#0A84FF';
const BASE_MIN_ZOOM = 14; // buildings-3d in realism.ts

const baseFeatures = (h: Highlight) => baseBlocks(h.buildingId);
// Per map: what is lit, and which of those the base map has no 3D block for (we draw those).
const state = new WeakMap<MapLibreMap, { list: Highlight[]; own: Set<string> }>();

function light(map: MapLibreMap, list: Highlight[]) {
  for (const f of (state.get(map)?.list ?? []).flatMap(baseFeatures)) map.setFeatureState(f, { highlight: false });
  for (const f of list.flatMap(baseFeatures)) map.setFeatureState(f, { highlight: true });
  hideNames(map, list.flatMap((h) => h.buildingId ?? []));
  state.set(map, { list, own: state.get(map)?.own ?? new Set() });
}

/** After tiles load: outlines whose base block isn't in the tiles get our own blue block at every zoom. */
function checkBase(map: MapLibreMap) {
  const s = state.get(map);
  if (!s || map.getZoom() < BASE_MIN_ZOOM) return;
  const ids = new Set(map.querySourceFeatures('openmaptiles', { sourceLayer: 'building' }).map((f) => f.id));
  const own = new Set(s.list.filter((h) => h.polygon && !baseFeatures(h).some((f) => ids.has(f.id))).map((h) => h.key));
  if ([...own].join() === [...s.own].join()) return;
  state.set(map, { ...s, own });
  (map.getSource('places') as GeoJSONSource).setData(toGeoJSON(s.list, own));
}

const toGeoJSON = (list: Highlight[], own = new Set<string>()): FeatureCollection => ({
  type: 'FeatureCollection',
  features: list.flatMap((h) => [
    ...(h.polygon
      ? [
          {
            type: 'Feature' as const,
            properties: { height: h.heightM, own: own.has(h.key) },
            geometry: { type: 'Polygon' as const, coordinates: [h.polygon] },
          },
        ]
      : []),
    {
      type: 'Feature' as const,
      properties: { text: h.label ? `${h.label} · ${h.name}` : h.name, pin: !h.polygon },
      geometry: { type: 'Point' as const, coordinates: h.center },
    },
  ]),
});

/** Adds building names and the highlight layers on top. Call on the map's `load`, after the other layers. */
export function addPlaceLayers(map: MapLibreMap, list: Highlight[]) {
  addBuildingNames(map);
  map.addSource('places', { type: 'geojson', data: toGeoJSON(list) });
  const paint: FillExtrusionLayerSpecification['paint'] = { 'fill-extrusion-color': COLOR, 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-opacity': 0.88 };
  map.addLayer({ id: 'places-3d', type: 'fill-extrusion', source: 'places', filter: ['==', ['geometry-type'], 'Polygon'], maxzoom: BASE_MIN_ZOOM, paint });
  map.addLayer({
    id: 'places-3d-own',
    type: 'fill-extrusion',
    source: 'places',
    filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['get', 'own']],
    minzoom: BASE_MIN_ZOOM,
    paint,
  });
  map.addLayer({
    id: 'places-pin',
    type: 'circle',
    source: 'places',
    filter: ['all', ['==', ['geometry-type'], 'Point'], ['get', 'pin']],
    paint: { 'circle-radius': 7, 'circle-color': COLOR, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 2.5 },
  });
  map.addLayer({
    id: 'places-label',
    type: 'symbol',
    source: 'places',
    filter: ['==', ['geometry-type'], 'Point'],
    layout: {
      'text-field': ['get', 'text'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 13,
      'text-anchor': 'bottom',
      'text-offset': [0, -0.9],
      'text-max-width': 12,
      'text-allow-overlap': true,
    },
    paint: { 'text-color': '#0A5FC2', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.8 },
  });
  light(map, list);
  map.on('idle', () => checkBase(map));
}

export function setPlaces(map: MapLibreMap, list: Highlight[]) {
  light(map, list);
  (map.getSource('places') as GeoJSONSource | undefined)?.setData(toGeoJSON(list, state.get(map)?.own));
  checkBase(map);
}

/** Highlight for a building: its code (or a short name) as the label text. */
export const buildingHighlight = (b: Building, label: string | null = null): Highlight => ({
  key: b.id,
  buildingId: b.id,
  name: b.code ?? (b.name.length > 28 ? `${b.name.slice(0, 27)}…` : b.name),
  label,
  center: b.center,
  polygon: b.polygon,
  heightM: buildingHeightM(b),
});

/** Highlight for a saved place or a class's place: the building's outline when we know it. */
export function placeHighlight(p: PlaceRef, buildings: Building[], label: string | null = null, key = p.id ?? p.name): Highlight {
  const b = p.id ? buildings.find((x) => x.id === p.id) : undefined;
  return b
    ? { ...buildingHighlight(b, label), key }
    : { key, buildingId: null, name: p.name, label, center: p.center, polygon: null, heightM: 0 };
}
