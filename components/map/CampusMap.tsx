'use client';

import maplibregl, { LngLatBounds } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import { MAP } from '@/lib/config';
import type { LngLat } from '@/lib/domain/geo';
import { createMap, isDesktop, panelPadding } from './create-map';
import { buildingAt } from './building-names';
import { addPlaceLayers, setPlaces, type Highlight } from './place-layer';
import { addRealism, ViewControl } from './realism';

/** Campus map with highlighted places only (timetable): fits them in a tilted 3D view. */
export default function CampusMap({
  highlights,
  fitKey,
  onMapClick,
}: {
  highlights: Highlight[];
  fitKey: unknown; // refit when this changes (another day) or the number of places does
  onMapClick?: (p: LngLat, buildingId: string | null) => void; // with the named building seen there
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const ready = useRef(false);
  const fitted = useRef<unknown>(null); // fitKey the view was last fitted for
  const latest = useRef({ highlights, onMapClick, fitKey });
  latest.current = { highlights, onMapClick, fitKey };

  useEffect(() => {
    const m = createMap({ container: el.current!, style: MAP.style, center: MAP.center, zoom: 15, pitch: 45, attributionControl: false });
    if (!m) return; // no WebGL: createMap left a note in the container
    m.addControl(new maplibregl.AttributionControl({ compact: true }), isDesktop() ? 'bottom-right' : 'top-left');
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    m.addControl(new maplibregl.GeolocateControl({ trackUserLocation: true }), 'top-right');
    m.addControl(new ViewControl(), 'top-right');
    m.on('load', () => {
      el.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
      addRealism(m);
      addPlaceLayers(m, latest.current.highlights);
      ready.current = true;
      if (latest.current.highlights.length) {
        fitted.current = `${latest.current.fitKey}:${latest.current.highlights.length}`;
        fit(m, latest.current.highlights);
      }
    });
    m.on('click', (e) => {
      const at: LngLat = [e.lngLat.lng, e.lngLat.lat];
      latest.current.onMapClick?.(at, buildingAt(m, e.point, at)?.id ?? null);
    });
    map.current = m;
    return () => {
      ready.current = false;
      m.remove();
    };
  }, []);

  // Refit on a new day, and when places first arrive (the building list loads after the map).
  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current) return;
    setPlaces(m, highlights);
    const key = `${fitKey}:${highlights.length}`;
    if (highlights.length && fitted.current !== key) {
      fitted.current = key;
      fit(m, highlights);
    }
  }, [highlights, fitKey]);

  return (
    <div className="absolute inset-0">
      <div ref={el} className="h-full w-full" />
    </div>
  );
}

function fit(m: maplibregl.Map, list: Highlight[]) {
  if (!list.length) return;
  const b = new LngLatBounds(list[0].center, list[0].center);
  for (const h of list) b.extend(h.center);
  m.fitBounds(b, { padding: panelPadding(), maxZoom: 17, pitch: 50, bearing: -15 });
}
