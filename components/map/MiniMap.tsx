'use client';

import maplibregl, { LngLatBounds } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import { MAP } from '@/lib/config';
import { destination, type LngLat } from '@/lib/domain/geo';

/** Static map of one post: its point with the radius circle (area) or the chosen road (road). */
export default function MiniMap({
  lng,
  lat,
  radiusM,
  lines = [],
  color,
}: {
  lng: number;
  lat: number;
  radiusM: number | null;
  lines?: LngLat[][];
  color: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const r = lines.length ? 60 : Math.max(120, radiusM ?? 0) * 1.6;
    const bounds = new LngLatBounds(destination([lng, lat], -r, -r), destination([lng, lat], r, r));
    lines.flat().forEach((p) => bounds.extend(p));
    const m = new maplibregl.Map({
      container: el.current!,
      style: MAP.style,
      bounds,
      fitBoundsOptions: { padding: 24 },
      interactive: false,
      attributionControl: { compact: true },
    });
    m.on('load', () => {
      // Compact attribution starts expanded; a static map never collapses it, so start closed.
      el.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
      m.addSource('road', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: lines } },
      });
      m.addLayer({
        id: 'road',
        type: 'line',
        source: 'road',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': color, 'line-width': 7, 'line-opacity': 0.85 },
      });
      m.addSource('p', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [lng, lat] } },
      });
      const mpp = 156543.03 * Math.cos((lat * Math.PI) / 180);
      if (radiusM)
        m.addLayer({
          id: 'r',
          type: 'circle',
          source: 'p',
          paint: {
            'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 0, radiusM / mpp, 22, (radiusM / mpp) * 2 ** 22],
            'circle-color': color,
            'circle-opacity': 0.16,
            'circle-stroke-color': color,
            'circle-stroke-width': 1.5,
          },
        });
      if (!lines.length)
        m.addLayer({
          id: 'dot',
          type: 'circle',
          source: 'p',
          paint: { 'circle-radius': 8, 'circle-color': color, 'circle-stroke-color': '#fff', 'circle-stroke-width': 3 },
        });
    });
    return () => m.remove();
  }, [lng, lat, radiusM, lines, color]);
  return <div ref={el} className="h-full w-full" />;
}
