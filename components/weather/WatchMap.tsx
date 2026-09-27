'use client';

import { createMap } from '@/components/map/create-map';
import maplibregl, { type GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import { layers, watchToGeoJSON } from '@/components/map/layers';
import { MAP } from '@/lib/config';
import type { WatchDTO } from '@/lib/data/types';
import { destination } from '@/lib/domain/geo';

const r = MAP.radiusKm * 1000 * 0.75;
const BOUNDS = [destination(MAP.center, -r, -r), destination(MAP.center, r, r)] as [[number, number], [number, number]];

/** The area with one day's watch circles. */
export default function WatchMap({ watch }: { watch: WatchDTO[] }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const latest = useRef(watch);
  latest.current = watch;

  useEffect(() => {
    const m = createMap({ container: el.current!, style: MAP.style, bounds: BOUNDS, attributionControl: { compact: true } });
    if (!m) return; // no WebGL: createMap left a note in the container
    m.on('load', () => {
      el.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
      m.addSource('watch', { type: 'geojson', data: watchToGeoJSON(latest.current), promoteId: 'id' });
      layers('motorcycle')
        .filter((l) => l.id.startsWith('watch'))
        .forEach((l) => m.addLayer(l));
      map.current = m;
    });
    return () => {
      map.current = null;
      m.remove();
    };
  }, []);

  useEffect(() => {
    (map.current?.getSource('watch') as GeoJSONSource | undefined)?.setData(watchToGeoJSON(watch));
  }, [watch]);

  return (
    // maplibre-gl.css forces `position: relative` on the map element: size it with h-full inside a sized box.
    <div className="h-64 overflow-hidden rounded-xl">
      <div ref={el} className="h-full w-full" />
    </div>
  );
}
