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
