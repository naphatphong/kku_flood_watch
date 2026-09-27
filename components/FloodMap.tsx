'use client';

import maplibregl, { type ExpressionSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import { MAP, ROAD_STATUS, type Vehicle } from '@/lib/config';
import { reportsGeoJSON, roadsGeoJSON, zones, zonesGeoJSON } from '@/lib/mock';

const roadColor = (v: Vehicle) =>
  ['match', ['get', v], ...Object.entries(ROAD_STATUS).flatMap(([k, s]) => [k, s.color]), ROAD_STATUS.unknown.color] as unknown as ExpressionSpecification;

// Zone and report radii are in meters; convert to pixels per zoom level (Web Mercator).
const MPP0 = 156543.03 * Math.cos((MAP.center[1] * Math.PI) / 180);
const RADIUS_PX: ExpressionSpecification = [
  'interpolate', ['exponential', 2], ['zoom'],
  0, ['/', ['get', 'radius_m'], MPP0],
  22, ['/', ['get', 'radius_m'], MPP0 / 2 ** 22],
];

const SELECTED = ['boolean', ['feature-state', 'selected'], false] as ExpressionSpecification;

const isDesktop = () => window.matchMedia('(min-width: 768px)').matches;
// Keep fitted content clear of the panel: sidebar on the left (desktop) or bottom sheet (mobile).
const panelPadding = () =>
  isDesktop() ? { left: 420, right: 60, top: 60, bottom: 60 } : { left: 30, right: 30, top: 30, bottom: window.innerHeight * 0.55 };

const ALL_BOUNDS: [number, number, number, number] = [
  Math.min(...zones.map((z) => z.bbox[0])), Math.min(...zones.map((z) => z.bbox[1])),
  Math.max(...zones.map((z) => z.bbox[2])), Math.max(...zones.map((z) => z.bbox[3])),
];

export default function FloodMap({
  vehicle,
  selected,
  onSelect,
}: {
  vehicle: Vehicle;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const vehicleRef = useRef(vehicle);
  vehicleRef.current = vehicle;
  const prevSelected = useRef<string | null>(null);

  useEffect(() => {
    const m = new maplibregl.Map({
      container: el.current!,
      style: MAP.style,
      center: MAP.center,
      zoom: MAP.zoom,
      attributionControl: false,
    });
    m.addControl(new maplibregl.AttributionControl({ compact: true }), isDesktop() ? 'bottom-right' : 'top-left');
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    m.addControl(new maplibregl.GeolocateControl({ trackUserLocation: true }), 'top-right');

    m.on('load', () => {
      m.fitBounds(ALL_BOUNDS, { padding: panelPadding(), duration: 0 });
      m.addSource('zones', { type: 'geojson', data: zonesGeoJSON, promoteId: 'id' });
      m.addLayer({
        id: 'zones',
        type: 'circle',
        source: 'zones',
        paint: {
          'circle-radius': RADIUS_PX,
          'circle-color': ['get', 'color'],
          'circle-opacity': ['case', SELECTED, 0.3, 0.16],
          'circle-stroke-color': ['get', 'color'],
          'circle-stroke-opacity': 0.7,
          'circle-stroke-width': ['case', SELECTED, 3, 1.5],
        },
      });

      m.addSource('roads', { type: 'geojson', data: roadsGeoJSON });
      const roadLayout = { 'line-cap': 'round', 'line-join': 'round' } as const;
      m.addLayer({
        id: 'roads-casing',
        type: 'line',
        source: 'roads',
        layout: roadLayout,
        paint: { 'line-color': '#FFFFFF', 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 4, 17, 13] },
      });
      m.addLayer({
        id: 'roads',
        type: 'line',
        source: 'roads',
        layout: roadLayout,
        paint: { 'line-color': roadColor(vehicleRef.current), 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 2, 17, 8] },
      });

      m.addSource('reports', { type: 'geojson', data: reportsGeoJSON });
      m.addLayer({
        id: 'reports-area',
        type: 'circle',
        source: 'reports',
        paint: {
          'circle-radius': RADIUS_PX,
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.18,
          'circle-stroke-color': ['get', 'color'],
          'circle-stroke-width': 1.5,
        },
      });
      m.addLayer({
        id: 'reports-dot',
        type: 'circle',
        source: 'reports',
        paint: { 'circle-radius': 6, 'circle-color': ['get', 'color'], 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 2.5 },
      });

      m.addLayer({
        id: 'zones-label',
        type: 'symbol',
        source: 'zones',
        layout: {
          'text-field': [
            'format',
            ['concat', ['to-string', ['get', 'final']], '%'], { 'font-scale': 1.25 },
            '\n', {},
            ['concat', ['to-string', ['get', 'points']], ' จุด'], { 'font-scale': 0.85 },
          ],
          'text-font': ['Noto Sans Bold'],
          'text-size': 14,
        },
        paint: { 'text-color': '#3A3A3C', 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.5 },
      });

      m.on('click', 'zones', (e) => {
        const id = e.features?.[0]?.id;
        if (id != null) onSelect(String(id));
      });
      m.on('mouseenter', 'zones', () => (m.getCanvas().style.cursor = 'pointer'));
      m.on('mouseleave', 'zones', () => (m.getCanvas().style.cursor = ''));
    });

    map.current = m;
    return () => m.remove();
  }, [onSelect]);

  useEffect(() => {
    if (map.current?.getLayer('roads')) map.current.setPaintProperty('roads', 'line-color', roadColor(vehicle));
  }, [vehicle]);

  useEffect(() => {
    const m = map.current;
    if (!m?.getSource('zones')) return;
    if (prevSelected.current) m.setFeatureState({ source: 'zones', id: prevSelected.current }, { selected: false });
    prevSelected.current = selected;
    if (!selected) return;
    m.setFeatureState({ source: 'zones', id: selected }, { selected: true });
    const [w, s, e, n] = zones.find((z) => z.id === selected)!.bbox;
    m.fitBounds([w, s, e, n], { padding: panelPadding(), maxZoom: 15 });
  }, [selected]);

  // maplibre-gl.css forces `position: relative` on the map element, so position a wrapper instead.
  return (
    <div className="absolute inset-0">
      <div ref={el} className="h-full w-full" />
    </div>
  );
}
