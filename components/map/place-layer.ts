// Highlighted campus places: the selected building, today's classes, saved places.
// From zoom 14 the map's own 3D building turns blue (feature state; OpenMapTiles ids are the
// OSM way id × 10 plus a digit). Below that our outline is drawn instead. Places without one get a pin.
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import type { LngLat } from '@/lib/domain/geo';

export interface Highlight {
  key: string;
  name: string;
  label: string | null; // e.g. "1" for the first class of the day
  center: LngLat;
  polygon: LngLat[] | null;
  heightM: number;
}

const COLOR = '#0A84FF';
const BASE_MIN_ZOOM = 14; // buildings-3d in realism.ts

/** The base map's building features for a highlight: "w123" → ids 1230–1232 (the last digit varies in OpenMapTiles). */
const baseFeatures = (h: Highlight) =>
  h.polygon && /^w\d+$/.test(h.key)
    ? [0, 1, 2].map((k) => ({ source: 'openmaptiles', sourceLayer: 'building', id: Number(h.key.slice(1)) * 10 + k }))
    : [];
const lit = new WeakMap<MapLibreMap, Highlight[]>();

function light(map: MapLibreMap, list: Highlight[]) {
  for (const f of (lit.get(map) ?? []).flatMap(baseFeatures)) map.setFeatureState(f, { highlight: false });
  for (const f of list.flatMap(baseFeatures)) map.setFeatureState(f, { highlight: true });
  lit.set(map, list);
}

const toGeoJSON = (list: Highlight[]): FeatureCollection => ({
  type: 'FeatureCollection',
  features: list.flatMap((h) => [
    ...(h.polygon
      ? [{ type: 'Feature' as const, properties: { height: h.heightM }, geometry: { type: 'Polygon' as const, coordinates: [h.polygon] } }]
      : []),
    {
      type: 'Feature' as const,
      properties: { text: h.label ? `${h.label} · ${h.name}` : h.name, pin: !h.polygon },
      geometry: { type: 'Point' as const, coordinates: h.center },
    },
  ]),
});

/** Adds the highlight layers on top. Call on the map's `load`, after the other layers. */
export function addPlaceLayers(map: MapLibreMap, list: Highlight[]) {
  map.addSource('places', { type: 'geojson', data: toGeoJSON(list) });
  map.addLayer({
    id: 'places-3d',
    type: 'fill-extrusion',
    source: 'places',
    filter: ['==', ['geometry-type'], 'Polygon'],
    maxzoom: BASE_MIN_ZOOM,
    paint: { 'fill-extrusion-color': COLOR, 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-opacity': 0.88 },
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
}

export function setPlaces(map: MapLibreMap, list: Highlight[]) {
  (map.getSource('places') as GeoJSONSource | undefined)?.setData(toGeoJSON(list));
  light(map, list);
}
