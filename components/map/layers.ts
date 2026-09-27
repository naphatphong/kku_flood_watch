// MapLibre sources and layer specs. Colors and thresholds come from lib/config.ts.
import type { ExpressionSpecification, LayerSpecification } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import { MAP, ROAD_STATUS, WATER_LEVELS, zoneLevel, type Vehicle } from '@/lib/config';
import type { ClusterDTO, ReportPin } from '@/lib/data/types';

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
      radius_m: r.radiusM ?? 0,
      color: zoneLevel(WATER_LEVELS[r.waterLevel].score).color,
    },
    geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
  })),
});

export const layers = (vehicle: Vehicle): LayerSpecification[] => [
  {
    id: 'clusters',
    type: 'circle',
    source: 'clusters',
    paint: {
      'circle-radius': METERS,
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
    filter: ['==', ['get', 'kind'], 'area'],
    paint: {
      'circle-radius': METERS,
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
    paint: {
      'circle-radius': ['case', SELECTED, 9, 6],
      'circle-color': ['get', 'color'],
      'circle-stroke-color': '#FFFFFF',
      'circle-stroke-width': 2.5,
    },
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

export const CLICKABLE = ['reports-dot', 'clusters'];
