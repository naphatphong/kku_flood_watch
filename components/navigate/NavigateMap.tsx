'use client';

import { createMap } from '@/components/map/create-map';
import maplibregl, { LngLatBounds, type GeoJSONSource, type MapMouseEvent, type MapTouchEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Feature, FeatureCollection } from 'geojson';
import { addRealism, ViewControl } from '@/components/map/realism';
import { addTraffic } from '@/components/map/traffic';
import { useEffect, useMemo, useRef } from 'react';
import { MAP, ROAD_STATUS, type Vehicle } from '@/lib/config';
import type { ClusterDTO, WatchDTO } from '@/lib/data/types';
import { destination, distanceM, type LngLat } from '@/lib/domain/geo';
import { insertVia, nearestIndex, type Route } from '@/lib/domain/route';
import { clustersToGeoJSON, layers as contextLayers, roadColor, watchToGeoJSON } from '@/components/map/layers';

const isDesktop = () => window.matchMedia('(min-width: 768px)').matches;
const panelPadding = () =>
  isDesktop() ? { left: 420, right: 70, top: 70, bottom: 70 } : { left: 40, right: 40, top: 90, bottom: window.innerHeight * 0.5 };
const AREA_BOUNDS = (() => {
  const r = MAP.radiusKm * 1000 * 0.6;
  return [destination(MAP.center, -r, -r), destination(MAP.center, r, r)] as [LngLat, LngLat];
})();
const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };
const line = (coords: LngLat[], properties: Record<string, unknown> = {}): Feature => ({
  type: 'Feature',
  properties,
  geometry: { type: 'LineString', coordinates: coords },
});
const collection = (features: Feature[]): FeatureCollection => ({ type: 'FeatureCollection', features });

function dotElement(className: string) {
  const el = document.createElement('div');
  el.className = className;
  return el;
}

/**
 * Map for /navigate: flood circles and road colors for context, the route choices, the start
 * and end points, and via points. Drag the selected route to add a via point; drag a via
 * point to move it. Tapping an alternative selects it; other taps go to `onMapTap`.
 */
export default function NavigateMap({
  clusters,
  watch,
  segments,
  vehicle,
  routes,
  selected,
  origin,
  target,
  vias,
  tracking,
  onMapTap,
  onSelectRoute,
  onViasChange,
  onPosition,
}: {
  clusters: ClusterDTO[];
  watch: WatchDTO[];
  segments: FeatureCollection | null;
  vehicle: Vehicle;
  routes: Route[];
  selected: number;
  origin: LngLat | null;
  target: LngLat | null;
  vias: LngLat[];
  tracking: boolean; // follow the phone's position (turn-by-turn mode)
  onMapTap: (p: LngLat) => void;
  onSelectRoute: (i: number) => void;
  onViasChange: (vias: LngLat[]) => void;
  onPosition: (p: LngLat) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const geolocate = useRef<maplibregl.GeolocateControl | null>(null);
  const ready = useRef(false);
  const isTracking = useRef(false);
  const markers = useRef<{ origin?: maplibregl.Marker; target?: maplibregl.Marker; vias: maplibregl.Marker[] }>({ vias: [] });

  const route = routes[selected] as Route | undefined;
  const data = useMemo(
    () => ({
      clusters: clustersToGeoJSON(clusters),
      watch: watchToGeoJSON(watch),
      segments: segments ?? EMPTY,
      routes: collection(routes.map((r, i) => line(r.coords, { i, selected: i === selected }))),
      parts: collection(
        (route?.segments ?? [])
          .filter((s) => s.status === 'hard' || s.status === 'blocked')
          .map((s) => line(route!.coords.slice(s.start, s.end + 1), { color: ROAD_STATUS[s.status].color })),
      ),
      connectors: collection(
        route
          ? [
              [origin, route.coords[0]],
              [route.coords[route.coords.length - 1], target],
            ]
              .filter((pair): pair is [LngLat, LngLat] => !!pair[0] && !!pair[1] && distanceM(pair[0], pair[1]) > 15)
              .map((pair) => line(pair))
          : [],
      ),
    }),
    [clusters, watch, segments, routes, selected, route, origin, target],
  );
  const latest = useRef({ data, route, vias, onMapTap, onSelectRoute, onViasChange, onPosition });
  latest.current = { data, route, vias, onMapTap, onSelectRoute, onViasChange, onPosition };

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
    const geo = new maplibregl.GeolocateControl({
      trackUserLocation: true,
      positionOptions: { enableHighAccuracy: true },
      fitBoundsOptions: { maxZoom: 17 },
    });
    geo.on('geolocate', (e: GeolocationPosition) => latest.current.onPosition([e.coords.longitude, e.coords.latitude]));
    geo.on('trackuserlocationstart', () => (isTracking.current = true));
    geo.on('trackuserlocationend', () => (isTracking.current = false));
    m.addControl(geo, 'top-right');
    m.addControl(new ViewControl({ traffic: true }), 'top-right');
    geolocate.current = geo;

    m.on('load', () => {
      el.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
      addRealism(m);
      addTraffic(m);
      const d = latest.current.data;
      m.addSource('clusters', { type: 'geojson', data: d.clusters, promoteId: 'id' });
      m.addSource('watch', { type: 'geojson', data: d.watch, promoteId: 'id' });
      m.addSource('segments', { type: 'geojson', data: d.segments });
      m.addSource('routes', { type: 'geojson', data: d.routes });
      m.addSource('parts', { type: 'geojson', data: d.parts });
      m.addSource('connectors', { type: 'geojson', data: d.connectors });
      for (const l of contextLayers(vehicle)) if (!('source' in l && l.source === 'reports')) m.addLayer(l);

      const alt = ['!', ['get', 'selected']] as maplibregl.ExpressionSpecification;
      const sel = ['get', 'selected'] as maplibregl.ExpressionSpecification;
      m.addLayer({
        id: 'connectors',
        type: 'line',
        source: 'connectors',
        paint: { 'line-color': '#6E6E73', 'line-width': 2.5, 'line-dasharray': [1, 2] },
      });
      m.addLayer({
        id: 'routes-alt',
        type: 'line',
        source: 'routes',
        filter: alt,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#7FA9DD', 'line-width': 6, 'line-opacity': 0.9 },
      });
      m.addLayer({
        id: 'route-casing',
        type: 'line',
        source: 'routes',
        filter: sel,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#FFFFFF', 'line-width': 11 },
      });
      m.addLayer({
        id: 'route',
        type: 'line',
        source: 'routes',
        filter: sel,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#0071E3', 'line-width': 7 },
      });
      m.addLayer({
        id: 'route-parts',
        type: 'line',
        source: 'parts',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': 7 },
      });
      // Wide invisible lines make the routes easy to tap and grab.
      m.addLayer({ id: 'routes-alt-hit', type: 'line', source: 'routes', filter: alt, paint: { 'line-width': 22, 'line-opacity': 0 } });
      m.addLayer({ id: 'route-hit', type: 'line', source: 'routes', filter: sel, paint: { 'line-width': 22, 'line-opacity': 0 } });
      ready.current = true;

      m.on('click', (e) => {
        const [hit] = m.queryRenderedFeatures(e.point, { layers: ['routes-alt-hit'] });
        if (hit) latest.current.onSelectRoute(Number(hit.properties.i));
        else latest.current.onMapTap([e.lngLat.lng, e.lngLat.lat]);
      });
      for (const id of ['routes-alt-hit', 'route-hit']) {
        m.on('mouseenter', id, () => (m.getCanvas().style.cursor = id === 'route-hit' ? 'grab' : 'pointer'));
        m.on('mouseleave', id, () => (m.getCanvas().style.cursor = ''));
      }

      // Drag the selected route to add a via point there.
      const grab = (e: MapMouseEvent | MapTouchEvent) => {
        const r = latest.current.route;
        if (!r || ('points' in e && e.points.length !== 1)) return;
        e.preventDefault(); // this gesture moves the point, not the map
        const grabIndex = nearestIndex(r.coords, [e.lngLat.lng, e.lngLat.lat]).index;
        const ghost = new maplibregl.Marker({ element: dotElement('via-dot') }).setLngLat(e.lngLat).addTo(m);
        let last: LngLat | null = null;
        const move = (ev: MapMouseEvent | MapTouchEvent) => {
          last = [ev.lngLat.lng, ev.lngLat.lat];
          ghost.setLngLat(ev.lngLat);
        };
        const drop = () => {
          m.off('mousemove', move).off('touchmove', move).off('mouseup', drop).off('touchend', drop);
          ghost.remove();
          if (last) latest.current.onViasChange(insertVia(latest.current.vias, r.coords, last, grabIndex));
        };
        m.on('mousemove', move);
        m.on('touchmove', move);
        m.on('mouseup', drop);
        m.on('touchend', drop);
      };
      m.on('mousedown', 'route-hit', grab);
      m.on('touchstart', 'route-hit', grab);
    });

    map.current = m;
    return () => {
      ready.current = false;
      m.remove();
    };
  }, []); // created once; the effects below push prop changes

  // Data into sources.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current) return;
    for (const [id, fc] of Object.entries(data)) (m.getSource(id) as GeoJSONSource | undefined)?.setData(fc);
  }, [data]);

  useEffect(() => {
    if (ready.current) map.current?.setPaintProperty('roads', 'line-color', roadColor(vehicle));
  }, [vehicle]);

  // Frame each new result (not the far hand-off destination). Not on GPS fixes: while
  // navigating, the locate control moves the camera.
  const originRef = useRef(origin);
  originRef.current = origin;
  useEffect(() => {
    const m = map.current;
    if (!m || !routes.length) return;
    const b = new LngLatBounds();
    routes.forEach((r) => r.coords.forEach((c) => b.extend(c)));
    if (originRef.current) b.extend(originRef.current);
    m.fitBounds(b, { padding: panelPadding(), maxZoom: 16.5, duration: 600 });
  }, [routes]);

  // Show a newly chosen destination right away (routes reframe when they arrive).
  useEffect(() => {
    const m = map.current;
    if (!m || !target) return;
    const b = new LngLatBounds(target, target);
    if (originRef.current) b.extend(originRef.current);
    m.fitBounds(b, { padding: panelPadding(), maxZoom: 16, duration: 600 });
  }, [target]);

  // Start/end markers.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const place = (key: 'origin' | 'target', p: LngLat | null, make: () => maplibregl.Marker) => {
      if (!p) return void markers.current[key]?.remove();
      markers.current[key] ??= make();
      markers.current[key]!.setLngLat(p).addTo(m);
    };
    place('origin', origin, () => new maplibregl.Marker({ element: dotElement('origin-dot') }));
    place('target', target, () => new maplibregl.Marker({ color: '#FF3B30' }));
  }, [origin, target]);

  // Via markers, draggable.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    markers.current.vias.forEach((mk) => mk.remove());
    markers.current.vias = vias.map((v, i) => {
      const mk = new maplibregl.Marker({ element: dotElement('via-dot'), draggable: true }).setLngLat(v).addTo(m);
      mk.on('dragend', () => {
        const { lng, lat } = mk.getLngLat();
        latest.current.onViasChange(latest.current.vias.map((x, j) => (j === i ? [lng, lat] : x)));
      });
      return mk;
    });
  }, [vias]);

  // Turn-by-turn: follow the phone.
  useEffect(() => {
    if (tracking && !isTracking.current) geolocate.current?.trigger();
  }, [tracking]);

  return (
    <div className="absolute inset-0">
      <div ref={el} className="h-full w-full" />
    </div>
  );
}
