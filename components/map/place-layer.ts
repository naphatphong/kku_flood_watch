// Highlighted campus places: the selected building, today's classes, saved places.
// From zoom 14 the map's own 3D building turns blue when it has a tile feature of its own (feature
// state; OpenMapTiles ids are the OSM way id × 10 plus a digit). Below that, or when the base map
// lacks the block or merged it with others, our outline is drawn instead. Places without an outline get a pin.
import type { FillExtrusionLayerSpecification, GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import { buildingHeightM, type Building } from '@/lib/domain/buildings';
import { insidePolygon, type LngLat } from '@/lib/domain/geo';
import type { PlaceRef } from '@/lib/domain/user-data';
import { addBuildingNames, baseBlocks, grow, hideNames, MAX_OWN_RINGS, ringsOf } from './building-names';

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
// Per map: what is lit, and the ones we draw ourselves (no base block of their own) with their height.
const state = new WeakMap<MapLibreMap, { list: Highlight[]; own: Map<string, number> }>();

function light(map: MapLibreMap, list: Highlight[]) {
  for (const f of (state.get(map)?.list ?? []).flatMap(baseFeatures)) map.setFeatureState(f, { highlight: false });
  for (const f of list.flatMap(baseFeatures)) map.setFeatureState(f, { highlight: true });
  hideNames(map, list.flatMap((h) => h.buildingId ?? []));
  state.set(map, { list, own: state.get(map)?.own ?? new Map() });
}

/**
 * After tiles load: outlines without a base block of their own (missing, or merged with other
 * buildings) get our own blue block at every zoom, as tall as the grey one under it so none shows.
 */
function checkBase(map: MapLibreMap) {
  const s = state.get(map);
  if (!s || map.getZoom() < BASE_MIN_ZOOM) return;
  const feats = map.querySourceFeatures('openmaptiles', { sourceLayer: 'building' });
  const single = new Set(feats.filter((f) => ringsOf(f.geometry).length <= MAX_OWN_RINGS).map((f) => f.id));
  const own = new Map(
    s.list
      .filter((h) => h.polygon && !baseFeatures(h).some((f) => single.has(f.id)))
      .map((h) => {
        const under = feats.find((f) => ringsOf(f.geometry).some((r) => insidePolygon(h.center, r)));
        return [h.key, Math.max(h.heightM, Number(under?.properties.render_height) || 0) + 0.5] as const;
      }),
  );
  // A merged base block would light up every building in it: only blocks of their own stay lit.
  for (const h of s.list) for (const f of baseFeatures(h)) map.setFeatureState(f, { highlight: !own.has(h.key) });
  if ([...own].join() === [...s.own].join()) return;
  state.set(map, { ...s, own });
  (map.getSource('places') as GeoJSONSource).setData(toGeoJSON(s.list, own));
}

const toGeoJSON = (list: Highlight[], own = new Map<string, number>()): FeatureCollection => ({
  type: 'FeatureCollection',
  features: list.flatMap((h) => [
    ...(h.polygon
      ? [
          {
            type: 'Feature' as const,
            properties: { height: own.get(h.key) ?? h.heightM, own: own.has(h.key) },
            geometry: { type: 'Polygon' as const, coordinates: [own.has(h.key) ? grow(h.polygon) : h.polygon] },
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
