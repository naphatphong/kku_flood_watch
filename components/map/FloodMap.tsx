'use client';

import { createMap, isDesktop, panelPadding } from './create-map';
import maplibregl, { type GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { FeatureCollection } from 'geojson';
import { addRealism, ViewControl } from './realism';
import { addIncidentIcons } from './incident-icons';
import { addPlaceLayers, setPlaces, type Highlight } from './place-layer';
import { addTraffic } from './traffic';
import { useEffect, useMemo, useRef } from 'react';
import { MAP, type Vehicle } from '@/lib/config';
import { destination, type LngLat } from '@/lib/domain/geo';
import type { ClusterDTO, ReportPin, WatchDTO } from '@/lib/data/types';
import { CLICKABLE, clustersToGeoJSON, layers, reportsToGeoJSON, roadColor, watchToGeoJSON } from './layers';

export type Selection =
  | { type: 'cluster'; id: string }
  | { type: 'watch'; id: string }
  | { type: 'report'; id: number }
  | { type: 'building'; id: string }
  | null;
const SOURCE = { cluster: 'clusters', watch: 'watch', report: 'reports' } as const;
const featureOf = (s: Selection) => (s && s.type !== 'building' ? { source: SOURCE[s.type], id: s.id } : null);


const AREA_BOUNDS = (() => {
  const r = MAP.radiusKm * 1000 * 0.6;
  return [destination(MAP.center, -r, -r), destination(MAP.center, r, r)] as [[number, number], [number, number]];
})();

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

export default function FloodMap({
  clusters,
  watch,
  reports,
  segments,
  vehicle,
  highlights,
  selection,
  onSelect,
  onMapClick,
}: {
  clusters: ClusterDTO[];
  watch: WatchDTO[];
  reports: ReportPin[];
  segments: FeatureCollection | null;
  vehicle: Vehicle;
  highlights: Highlight[]; // campus places to show in blue (selected building, today's classes)
  selection: Selection;
  onSelect: (s: Selection) => void;
  onMapClick: (p: LngLat) => void; // a tap on nothing clickable (the page may find a building there)
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const ready = useRef(false);
  const latest = useRef({ vehicle, onSelect, onMapClick, highlights });
  latest.current = { vehicle, onSelect, onMapClick, highlights };

  const clusterData = useMemo(() => clustersToGeoJSON(clusters), [clusters]);
  const reportData = useMemo(() => reportsToGeoJSON(reports), [reports]);
  const watchData = useMemo(() => watchToGeoJSON(watch), [watch]);
  const data = useRef({ clusterData, reportData, watchData, segments, clusters, reports, watch });
  data.current = { clusterData, reportData, watchData, segments, clusters, reports, watch };

  // Create the map once.
  useEffect(() => {
    const m = createMap({
      container: el.current!,
      style: MAP.style,
      bounds: AREA_BOUNDS,
      fitBoundsOptions: { padding: panelPadding() },
      attributionControl: false,
    });
    if (!m) return; // no WebGL: createMap left a note in the container
    m.addControl(new maplibregl.AttributionControl({ compact: true }), isDesktop() ? 'bottom-right' : 'top-left');
    m.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    m.addControl(new maplibregl.GeolocateControl({ trackUserLocation: true }), 'top-right');
    m.addControl(new ViewControl({ traffic: true }), 'top-right');

    m.on('load', () => {
      // Compact attribution starts expanded; keep it folded behind its (i) button.
      el.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
      addRealism(m);
      addTraffic(m);
      m.addSource('clusters', { type: 'geojson', data: data.current.clusterData, promoteId: 'id' });
      m.addSource('reports', { type: 'geojson', data: data.current.reportData, promoteId: 'id' });
      m.addSource('watch', { type: 'geojson', data: data.current.watchData, promoteId: 'id' });
      m.addSource('segments', { type: 'geojson', data: data.current.segments ?? EMPTY });
      addIncidentIcons(m);
      layers(latest.current.vehicle).forEach((l) => m.addLayer(l));
      addPlaceLayers(m, latest.current.highlights);
      ready.current = true;

      m.on('click', (e) => {
        const [hit] = m.queryRenderedFeatures(e.point, { layers: CLICKABLE });
        if (!hit) return latest.current.onMapClick([e.lngLat.lng, e.lngLat.lat]);
        const id = hit.properties.id;
        latest.current.onSelect(
          hit.layer.id === 'clusters'
            ? { type: 'cluster', id }
            : hit.layer.id === 'watch-fill'
              ? { type: 'watch', id }
              : { type: 'report', id: Number(id) },
        );
      });
      for (const id of CLICKABLE) {
        m.on('mouseenter', id, () => (m.getCanvas().style.cursor = 'pointer'));
        m.on('mouseleave', id, () => (m.getCanvas().style.cursor = ''));
      }
    });

    map.current = m;
    return () => {
      ready.current = false;
      m.remove();
    };
  }, []);

  // Push data updates into the sources.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current) return;
    (m.getSource('clusters') as GeoJSONSource).setData(clusterData);
    (m.getSource('reports') as GeoJSONSource).setData(reportData);
    (m.getSource('watch') as GeoJSONSource).setData(watchData);
    (m.getSource('segments') as GeoJSONSource).setData(segments ?? EMPTY);
  }, [clusterData, reportData, watchData, segments]);

  useEffect(() => {
    if (ready.current) map.current?.setPaintProperty('roads', 'line-color', roadColor(vehicle));
  }, [vehicle]);

  useEffect(() => {
    if (ready.current && map.current) setPlaces(map.current, highlights);
  }, [highlights]);

  // Highlight and frame the selection.
  const prev = useRef<Selection>(null);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current) return;
    const before = featureOf(prev.current);
    if (before) m.setFeatureState(before, { selected: false });
    prev.current = selection;
    if (!selection) return;
    if (selection.type === 'building') {
      // Show the building in 3D.
      const h = latest.current.highlights.find((x) => x.key === selection.id);
      if (h) m.flyTo({ center: h.center, zoom: 17.3, pitch: 55, bearing: -20, padding: panelPadding() });
      return;
    }
    m.setFeatureState(featureOf(selection)!, { selected: true });

    const target =
      selection.type === 'report'
        ? data.current.reports.find((r) => r.id === selection.id)
        : data.current[selection.type === 'cluster' ? 'clusters' : 'watch'].find((c) => c.id === selection.id);
    if (!target) return;
    const r = Math.max(150, 'radiusM' in target && target.radiusM ? target.radiusM : 0) * 1.4;
    const center: [number, number] = [target.lng, target.lat];
    m.fitBounds([destination(center, -r, -r), destination(center, r, r)], { padding: panelPadding(), maxZoom: 16.5 });
  }, [selection]);

  // maplibre-gl.css forces `position: relative` on the map element, so position a wrapper instead.
  return (
    <div className="absolute inset-0">
      <div ref={el} className="h-full w-full" />
    </div>
  );
}
