// Satellite imagery and 3D buildings for the interactive maps, plus the map buttons that
// switch them (and traffic). Both sit under the base labels and under our own layers.
import type { IControl, Map as MapLibreMap } from 'maplibre-gl';
import { MAP, TRAFFIC } from '@/lib/config';
import { setTraffic } from './traffic';

const STORE = 'kfw-basemap';
const load = () => {
  try {
    return localStorage.getItem(STORE) === 'satellite';
  } catch {
    return false;
  }
};
const save = (satellite: boolean) => {
  try {
    localStorage.setItem(STORE, satellite ? 'satellite' : 'map');
  } catch {
    // private mode: the choice just isn't remembered
  }
};

/** Adds satellite (hidden unless chosen before) and 3D buildings. Call on the map's `load`. */
export function addRealism(map: MapLibreMap) {
  const firstLabel = map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
  if (MAP.satellite) {
    map.addSource('satellite', { type: 'raster', url: MAP.satellite, tileSize: 256 });
    map.addLayer(
      { id: 'satellite', type: 'raster', source: 'satellite', layout: { visibility: load() ? 'visible' : 'none' } },
      firstLabel,
    );
  }
  map.addLayer(
    {
      id: 'buildings-3d',
      type: 'fill-extrusion',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 14,
      filter: ['!=', ['get', 'hide_3d'], true],
      paint: {
        // Highlighted campus buildings with a tile feature of their own (place-layer.ts) turn blue.
        'fill-extrusion-color': ['case', ['boolean', ['feature-state', 'highlight'], false], '#0A84FF', '#E4E1DA'],
        'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 15, ['coalesce', ['get', 'render_height'], 6]],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0.85,
      },
    },
    firstLabel,
  );
}

const ICON = {
  satellite:
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/></svg>',
  map: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/></svg>',
  traffic:
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2.5" width="8" height="19" rx="4"/><circle cx="12" cy="7" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="17" r="1.3"/></svg>',
};

/** Map buttons: map ⇄ satellite (when configured), traffic on/off (maps with addTraffic) and 2D ⇄ 3D tilt. */
export class ViewControl implements IControl {
  private el?: HTMLDivElement;
  constructor(private opts: { traffic?: boolean } = {}) {}

  onAdd(map: MapLibreMap) {
    const el = document.createElement('div');
    el.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    const button = (label: string) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.title = label;
      b.setAttribute('aria-label', label);
      el.appendChild(b);
      return b;
    };

    if (MAP.satellite) {
      const sat = button('สลับภาพดาวเทียม');
      const paint = () => {
        const on = map.getLayer('satellite') && map.getLayoutProperty('satellite', 'visibility') === 'visible';
        sat.innerHTML = on ? ICON.map : ICON.satellite;
        sat.title = on ? 'กลับเป็นแผนที่' : 'ภาพถ่ายดาวเทียม';
        sat.setAttribute('aria-label', sat.title);
      };
      sat.onclick = () => {
        if (!map.getLayer('satellite')) return;
        const on = map.getLayoutProperty('satellite', 'visibility') !== 'visible';
        map.setLayoutProperty('satellite', 'visibility', on ? 'visible' : 'none');
        save(on);
        paint();
      };
      map.once('idle', paint);
      paint();
    }

    if (this.opts.traffic && TRAFFIC.flowTiles) {
      const traffic = button('สภาพจราจร');
      traffic.innerHTML = ICON.traffic;
      const on = () => !!map.getLayer('traffic') && map.getLayoutProperty('traffic', 'visibility') !== 'none';
      const sync = () => traffic.setAttribute('aria-pressed', String(on()));
      traffic.onclick = () => {
        if (!map.getLayer('traffic')) return;
        setTraffic(map, !on());
        sync();
      };
      map.once('idle', sync);
    }

    const tilt = button('มุมมอง 3 มิติ');
    tilt.innerHTML = '<span style="font:700 13px system-ui">3D</span>';
    const sync = () => tilt.setAttribute('aria-pressed', String(map.getPitch() > 10));
    tilt.onclick = () => {
      const flat = map.getPitch() > 10;
      map.easeTo({ pitch: flat ? 0 : MAP.pitch3d, bearing: flat ? 0 : -20, zoom: flat ? map.getZoom() : Math.max(map.getZoom(), 15.5) });
    };
    map.on('pitchend', sync);
    sync();

    this.el = el;
    return el;
  }

  onRemove() {
    this.el?.remove();
  }
}
