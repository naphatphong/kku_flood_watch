'use client';

import { createMap } from '@/components/map/create-map';
import maplibregl, { type GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { FeatureCollection } from 'geojson';
import { addRealism, ViewControl } from '@/components/map/realism';
import { useEffect, useRef } from 'react';
import { MAP } from '@/lib/config';
import type { LngLat } from '@/lib/domain/geo';
import type { ChainSegment } from '@/lib/domain/road-chain';
import type { ReportKind } from '@/lib/domain/types';

const MPP0 = 156543.03 * Math.cos((MAP.center[1] * Math.PI) / 180);
const isDesktop = () => window.matchMedia('(min-width: 768px)').matches;
// Keep the pin in the part of the map not covered by the form panel.
const panelPadding = () =>
  isDesktop() ? { left: 400, right: 40, top: 40, bottom: 40 } : { left: 20, right: 20, top: 60, bottom: window.innerHeight * 0.48 };
const lines = (segs: ChainSegment[]): FeatureCollection => ({
  type: 'FeatureCollection',
  features: segs.map((s) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: s.coords } })),
});
const point = (p: LngLat | null, radiusM: number): FeatureCollection => ({
  type: 'FeatureCollection',
  features: p ? [{ type: 'Feature', properties: { radius_m: radiusM }, geometry: { type: 'Point', coordinates: p } }] : [],
});

/** Map for placing a post: draggable pin with its radius (area) or tap-to-pick road segments (road). */
export default function PickerMap({
  kind,
  pin,
  radiusM,
  chain,
  candidates,
  flyTo,
  onPin,
  onRoadTap,
}: {
  kind: ReportKind;
  pin: LngLat | null;
  radiusM: number;
  chain: ChainSegment[];
  candidates: ChainSegment[];
  flyTo: LngLat | null; // recenters when this changes (e.g. GPS fix)
  onPin: (p: LngLat) => void;
  onRoadTap: (p: LngLat) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);
  const ready = useRef(false);
  const latest = useRef({ kind, pin, radiusM, chain, candidates, onPin, onRoadTap });
  latest.current = { kind, pin, radiusM, chain, candidates, onPin, onRoadTap };

  useEffect(() => {
    const m = createMap({ container: el.current!, style: MAP.style, center: MAP.center, zoom: 15, attributionControl: false });
    if (!m) return; // no WebGL: createMap left a note in the container
    m.addControl(new maplibregl.AttributionControl({ compact: true }), isDesktop() ? 'bottom-right' : 'top-left');
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    m.addControl(new ViewControl(), 'top-right');
    const pinMarker = new maplibregl.Marker({ color: '#0071E3', draggable: true });
    pinMarker.on('dragend', () => {
      const { lng, lat } = pinMarker.getLngLat();
      latest.current.onPin([lng, lat]);
    });
    marker.current = pinMarker;

    m.on('load', () => {
      el.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
      addRealism(m);
      const { pin: p, radiusM: r, chain: c, candidates: cand } = latest.current;
      m.addSource('pin', { type: 'geojson', data: point(p, r) });
      m.addSource('candidates', { type: 'geojson', data: lines(cand) });
      m.addSource('chain', { type: 'geojson', data: lines(c) });
      m.addLayer({
        id: 'pin-radius',
        type: 'circle',
        source: 'pin',
        paint: {
          'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 0, ['/', ['get', 'radius_m'], MPP0], 22, ['/', ['get', 'radius_m'], MPP0 / 2 ** 22]],
          'circle-pitch-alignment': 'map',
          'circle-color': '#0071E3',
          'circle-opacity': 0.14,
          'circle-stroke-color': '#0071E3',
          'circle-stroke-width': 1.5,
        },
      });
      m.addLayer({
        id: 'candidates',
        type: 'line',
        source: 'candidates',
        layout: { 'line-cap': 'round' },
        paint: { 'line-color': '#0071E3', 'line-opacity': 0.35, 'line-width': 5 },
      });
      m.addLayer({
        id: 'chain',
        type: 'line',
        source: 'chain',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#0071E3', 'line-width': 8 },
      });
      ready.current = true;
      m.on('click', (e) => {
        const p: LngLat = [e.lngLat.lng, e.lngLat.lat];
        if (latest.current.kind === 'area') latest.current.onPin(p);
        else latest.current.onRoadTap(p);
      });
    });

    map.current = m;
    return () => {
      ready.current = false;
      m.remove();
    };
  }, []);

  useEffect(() => {
    if (flyTo) map.current?.flyTo({ center: flyTo, zoom: 16.5, padding: panelPadding() });
  }, [flyTo]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (kind === 'area' && pin) marker.current?.setLngLat(pin).addTo(m);
    else marker.current?.remove();
    if (!ready.current) return;
    (m.getSource('pin') as GeoJSONSource).setData(point(kind === 'area' ? pin : null, radiusM));
    (m.getSource('chain') as GeoJSONSource).setData(lines(kind === 'road' ? chain : []));
    (m.getSource('candidates') as GeoJSONSource).setData(lines(kind === 'road' ? candidates : []));
  }, [kind, pin, radiusM, chain, candidates]);

  return (
    <div className="absolute inset-0">
      <div ref={el} className="h-full w-full" />
    </div>
  );
}
