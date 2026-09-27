// MapLibre sources and layer specs. Colors and thresholds come from lib/config.ts.
import type { ExpressionSpecification, LayerSpecification } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import { MAP, ROAD_STATUS, zoneLevel, type Vehicle } from '@/lib/config';
import type { ClusterDTO, ReportPin, WatchDTO } from '@/lib/data/types';
import { destination } from '@/lib/domain/geo';
import { postLabel } from '@/lib/domain/post';

// Radii are meters; convert to pixels per zoom (Web Mercator at the area's latitude).
const MPP0 = 156543.03 * Math.cos((MAP.center[1] * Math.PI) / 180);
const METERS: ExpressionSpecification = [
  'interpolate', ['exponential', 2], ['zoom'],
  0, ['/', ['get', 'radius_m'], MPP0],
  22, ['/', ['get', 'radius_m'], MPP0 / 2 ** 22],
];
const SELECTED = ['boolean', ['feature-state', 'selected'], false] as ExpressionSpecification;

export const roadColor = (v: Vehicle) =>
  ['match', ['get', v], ...Object.entries(ROAD_STATUS).flatMap(([k, s]) => [k, s.color]), ROAD_STATUS.unknown.color] as unknown as ExpressionSpecification;

export const clustersToGeoJSON = (clusters: ClusterDTO[]): FeatureCollection => ({
  type: 'FeatureCollection',
  features: clusters.map((c) => ({
    type: 'Feature',
    id: c.id,
    properties: {
      id: c.id,
      radius_m: c.radiusM,
      final: Math.round(c.final),
      count: c.reportCount,
      color: zoneLevel(c.final).color,
    },
    geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
  })),
});

export const reportsToGeoJSON = (reports: ReportPin[]): FeatureCollection => ({
  type: 'FeatureCollection',
  features: reports.map((r) => ({
    type: 'Feature',
    id: r.id,
    properties: {
      id: r.id,
      kind: r.kind,
      category: r.category,
      radius_m: r.radiusM ?? 0,
      color: postLabel(r).color,
    },
    geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
  })),
});

/** Watch circles as polygons, so their outline can be dashed (a forecast, not a report). */
export const watchToGeoJSON = (watch: WatchDTO[]): FeatureCollection => ({
  type: 'FeatureCollection',
  features: watch.map((w) => ({
    type: 'Feature',
    id: w.id,
    properties: { id: w.id, color: zoneLevel(w.pct).color, label: `เฝ้าระวัง ${w.pct}%` },
    geometry: {
      type: 'Polygon',
      coordinates: [
        Array.from({ length: 65 }, (_, i) =>
          destination([w.lng, w.lat], w.radiusM * Math.sin((i / 32) * Math.PI), w.radiusM * Math.cos((i / 32) * Math.PI)),
        ),
      ],
    },
  })),
});

export const layers = (vehicle: Vehicle): LayerSpecification[] => [
  {
    id: 'watch-fill',
    type: 'fill',
    source: 'watch',
    paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['case', SELECTED, 0.18, 0.07] },
  },
  {
    id: 'watch-line',
    type: 'line',
    source: 'watch',
    paint: { 'line-color': ['get', 'color'], 'line-width': ['case', SELECTED, 2.5, 1.5], 'line-dasharray': [2, 2] },
  },
  {
    id: 'clusters',
    type: 'circle',
    source: 'clusters',
    paint: {
      'circle-radius': METERS,
      'circle-pitch-alignment': 'map', // flat on the ground when the map is tilted
      'circle-color': ['get', 'color'],
      'circle-opacity': ['case', SELECTED, 0.3, 0.16],
      'circle-stroke-color': ['get', 'color'],
      'circle-stroke-opacity': 0.75,
      'circle-stroke-width': ['case', SELECTED, 3, 1.5],
    },
  },
  {
    id: 'roads-casing',
    type: 'line',
    source: 'segments',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#FFFFFF', 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 4, 17, 13] },
  },
  {
    id: 'roads',
    type: 'line',
    source: 'segments',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': roadColor(vehicle), 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 2, 17, 8] },
  },
  {
    id: 'reports-area',
    type: 'circle',
    source: 'reports',
    filter: ['all', ['==', ['get', 'kind'], 'area'], ['==', ['get', 'category'], 'flood']],
    paint: {
      'circle-radius': METERS,
      'circle-pitch-alignment': 'map',
      'circle-color': ['get', 'color'],
      'circle-opacity': 0.12,
      'circle-stroke-color': ['get', 'color'],
      'circle-stroke-opacity': 0.5,
      'circle-stroke-width': 1,
    },
  },
  {
    id: 'reports-dot',
    type: 'circle',
    source: 'reports',
    filter: ['==', ['get', 'category'], 'flood'],
    paint: {
      'circle-radius': ['case', SELECTED, 9, 6],
      'circle-color': ['get', 'color'],
      'circle-stroke-color': '#FFFFFF',
      'circle-stroke-width': 2.5,
    },
  },
  {
    // Road incident posts (images from incident-icons.ts).
    id: 'incidents',
    type: 'symbol',
    source: 'reports',
    filter: ['!=', ['get', 'category'], 'flood'],
    layout: {
      'icon-image': ['concat', 'incident-', ['get', 'category']],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  },
  {
    id: 'watch-label',
    type: 'symbol',
    source: 'watch',
    layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Regular'], 'text-size': 12 },
    paint: { 'text-color': '#6E6E73', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.4 },
  },
  {
    id: 'clusters-label',
    type: 'symbol',
    source: 'clusters',
    layout: {
      'text-field': [
        'format',
        ['concat', ['to-string', ['get', 'final']], '%'], { 'font-scale': 1.2 },
        '\n', {},
        ['concat', ['to-string', ['get', 'count']], ' จุด'], { 'font-scale': 0.8 },
      ],
      'text-font': ['Noto Sans Bold'],
      'text-size': 14,
      'symbol-sort-key': ['-', ['get', 'final']], // riskiest label wins collisions
    },
    paint: { 'text-color': '#1D1D1F', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.6 },
  },
];

export const CLICKABLE = ['reports-dot', 'incidents', 'clusters', 'watch-fill'];
