// TomTom traffic responses → what the maps and route cards show.
import { TRAFFIC } from '../config';
import type { LngLat } from './geo';

export interface IncidentDTO {
  id: string;
  category: number; // TomTom iconCategory
  label: string; // Thai category name
  text: string; // TomTom's own description (Thai when available)
  road: string | null; // "from → to" or road numbers
  delayS: number | null;
  at: LngLat; // start of the incident
}

interface TomTomIncident {
  geometry: { type: 'Point' | 'LineString'; coordinates: LngLat | LngLat[] };
  properties: {
    id: string;
    iconCategory: number;
    events?: { description: string }[];
    from?: string | null;
    to?: string | null;
    delay?: number | null;
    roadNumbers?: string[];
  };
}

/** Incident Details API (v5) body → incidents, one per TomTom incident. */
export function parseIncidents(body: { incidents?: TomTomIncident[] }): IncidentDTO[] {
  return (body.incidents ?? []).map(({ geometry, properties: p }) => {
    const label = TRAFFIC.incidentLabels[p.iconCategory] ?? TRAFFIC.incidentLabels[0];
    const place = p.from && p.to && p.from !== p.to ? `${p.from} → ${p.to}` : (p.from ?? p.to ?? null);
    return {
      id: p.id,
      category: p.iconCategory,
      label,
      text: [...new Set((p.events ?? []).map((e) => e.description))].join(' · ') || label,
      road: place ?? (p.roadNumbers?.length ? p.roadNumbers.join(', ') : null),
      delayS: p.delay ?? null,
      at: geometry.type === 'Point' ? (geometry.coordinates as LngLat) : (geometry.coordinates as LngLat[])[0],
    };
  });
}

/** Slippy-map tiles (x, y) at zoom z that cover a bbox. */
export function tileRange([west, south, east, north]: [number, number, number, number], z: number): [number, number][] {
  const n = 2 ** z;
  const x = (lng: number) => Math.floor(((lng + 180) / 360) * n);
  const y = (lat: number) => Math.floor(((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * n);
  const tiles: [number, number][] = [];
  for (let tx = x(west); tx <= x(east); tx++) for (let ty = y(north); ty <= y(south); ty++) tiles.push([tx, ty]);
  return tiles;
}
