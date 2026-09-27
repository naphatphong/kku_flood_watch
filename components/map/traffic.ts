// Live traffic on the interactive maps (TomTom): slow roads colored by speed, closures dashed,
// and incident pins with details. Only when a key is set; the traffic button switches it.
import maplibregl, { type ExpressionSpecification, type Map as MapLibreMap } from 'maplibre-gl';
import { TRAFFIC } from '@/lib/config';
import type { IncidentDTO } from '@/lib/domain/traffic';
import { duration } from '@/lib/format';
import { glyphSvg, iconColor, tomtomIcon } from './incident-icons';

const STORE = 'kfw-traffic';
export const trafficStored = () => {
  try {
    return localStorage.getItem(STORE) !== 'off';
  } catch {
    return true;
  }
};

// Per map: incident pins and the legend, shown and hidden with the flow layers.
const extras = new WeakMap<MapLibreMap, { pins: maplibregl.Marker[]; legend: HTMLElement }>();
const LAYERS = ['traffic', 'traffic-closed'];

/** Show or hide everything traffic on `map` and remember the choice. */
export function setTraffic(map: MapLibreMap, on: boolean) {
  for (const id of LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
  const x = extras.get(map);
  x?.pins.forEach((p) => (p.getElement().style.display = on ? '' : 'none'));
  if (x) x.legend.style.display = on ? '' : 'none';
  try {
    localStorage.setItem(STORE, on ? 'on' : 'off');
  } catch {
    // private mode: the choice just isn't remembered
  }
}

// Directional lines (one per side of the road) sit on the driving side; Thailand drives on the left.
const side = (px: number): ExpressionSpecification => [
  'case',
  ['==', ['get', 'traffic_road_coverage'], 'one_side'],
  ['case', ['to-boolean', ['get', 'left_hand_traffic']], -px, px],
  0,
];
const WIDTH: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 11, 1.5, 17, 5];
const OFFSET: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 11, side(1), 17, side(4)];
const slowest = TRAFFIC.levels[TRAFFIC.levels.length - 1].below;

function details(i: IncidentDTO) {
  // TomTom text is external: set it as text, never as HTML.
  const el = document.createElement('div');
  el.className = 'flex flex-col gap-0.5 text-[13px] leading-snug text-[#1D1D1F]';
  const line = (text: string, className: string) => {
    const p = document.createElement('p');
    p.className = className;
    p.textContent = text;
    el.appendChild(p);
  };
  line(i.label, 'text-[15px] font-semibold');
  if (i.text !== i.label) line(i.text, '');
  if (i.road) line(i.road, 'text-[#6E6E73]');
  if (i.delayS && i.delayS >= 60) line(`ช้ากว่าปกติ ${duration(i.delayS)}`, 'font-semibold text-[#C93400]');
  return el;
}

function pin(i: IncidentDTO) {
  const kind = tomtomIcon(i.category);
  const el = document.createElement('button');
  el.type = 'button';
  el.setAttribute('aria-label', i.label);
  el.className = 'grid size-7 place-items-center rounded-full border-2 border-white shadow-md';
  el.style.background = iconColor(kind);
  el.innerHTML = glyphSvg(kind);
  return new maplibregl.Marker({ element: el })
    .setLngLat(i.at)
    .setPopup(new maplibregl.Popup({ offset: 16, closeButton: false, maxWidth: '260px' }).setDOMContent(details(i)));
}

// Desktop only: on phones the sheet would cover it; the home panel's road legend lists the traffic colors.
function legend() {
  const el = document.createElement('div');
  el.className = 'maplibregl-ctrl hidden flex-col gap-1 md:flex rounded-xl bg-white/90 px-2.5 py-2 text-[11px] text-[#3A3A3C] shadow-md backdrop-blur';
  const row = (label: string, style: string) =>
    `<span class="flex items-center gap-1.5"><span class="h-[4px] w-4 rounded-full" style="${style}"></span>${label}</span>`;
  el.innerHTML =
    '<span class="font-semibold text-[#1D1D1F]">จราจร</span>' +
    [...TRAFFIC.levels].reverse().map((l) => row(l.label, `background:${l.color}`)).join('') +
    row(TRAFFIC.closed.label, `background:repeating-linear-gradient(90deg,${TRAFFIC.closed.color} 0 4px,transparent 4px 7px)`);
  return el;
}

/** Adds the traffic layers, legend and incident pins. Call on the map's `load`, after addRealism. */
export function addTraffic(map: MapLibreMap) {
  if (!TRAFFIC.flowTiles) return;
  const firstLabel = map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
  // maxzoom 16: closer views reuse (overzoom) those tiles instead of requesting more.
  map.addSource('traffic', { type: 'vector', tiles: [TRAFFIC.flowTiles], maxzoom: 16, attribution: '© TomTom' });
  const color = ['step', ['get', 'traffic_level'], ...TRAFFIC.levels.flatMap((l, i) => (i ? [TRAFFIC.levels[i - 1].below, l.color] : [l.color]))];
  map.addLayer(
    {
      id: 'traffic',
      type: 'line',
      source: 'traffic',
      'source-layer': 'Traffic flow',
      minzoom: 11,
      filter: ['all', ['!', ['to-boolean', ['get', 'road_closure']]], ['<', ['to-number', ['get', 'traffic_level'], 1], slowest]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': color as ExpressionSpecification, 'line-width': WIDTH, 'line-offset': OFFSET },
    },
    firstLabel,
  );
  map.addLayer(
    {
      id: 'traffic-closed',
      type: 'line',
      source: 'traffic',
      'source-layer': 'Traffic flow',
      minzoom: 11,
      filter: ['to-boolean', ['get', 'road_closure']],
      paint: { 'line-color': TRAFFIC.closed.color, 'line-width': WIDTH, 'line-dasharray': [1.5, 1] },
    },
    firstLabel,
  );

  const x = { pins: [] as maplibregl.Marker[], legend: legend() };
  extras.set(map, x);
  map.addControl({ onAdd: () => x.legend, onRemove: () => x.legend.remove() }, 'top-right');
  setTraffic(map, trafficStored());

  // ponytail: incidents load once per page view; poll here if people keep the map open for hours.
  fetch('/api/traffic')
    .then((r) => (r.ok ? r.json() : { incidents: [] }))
    .then(({ incidents }: { incidents: IncidentDTO[] }) => {
      if (!map.getContainer().isConnected) return; // the page moved on
      x.pins = incidents.map((i) => pin(i).addTo(map));
      setTraffic(map, trafficStored());
    })
    .catch(() => {}); // no pins; the flow layer still shows
}
