import 'server-only';
import { SITE, TRAFFIC, type Vehicle } from '../config';
import type { LngLat } from '../domain/geo';
import { parseIncidents, type IncidentDTO } from '../domain/traffic';
import { AREA_BBOX } from '../http';

// The Referer lets a key locked to our domain (TomTom "Referer check") work from the server too.
const HEADERS = { Referer: SITE.url };
const FIELDS = '{incidents{type,geometry{type,coordinates},properties{id,iconCategory,events{description},from,to,delay,roadNumbers}}}';

/** Current incidents in the area (TomTom Incident Details), cached for every visitor. */
export async function getIncidents(): Promise<IncidentDTO[]> {
  if (!TRAFFIC.key) return [];
  const params = new URLSearchParams({
    key: TRAFFIC.key,
    bbox: AREA_BBOX.join(','),
    fields: FIELDS,
    language: 'th-TH',
    timeValidityFilter: 'present',
  });
  const res = await fetch(`https://api.tomtom.com/traffic/services/5/incidentDetails?${params}`, {
    headers: HEADERS,
    next: { revalidate: TRAFFIC.incidentsCacheMinutes * 60 },
  });
  if (!res.ok) throw new Error(`TomTom incidents ${res.status}`);
  return parseIncidents(await res.json());
}

const TRAVEL_MODE: Record<Vehicle, string | null> = { motorcycle: 'motorcycle', car: 'car', pickup: 'car', walk: null };
const latLng = ([lng, lat]: LngLat) => `${lat},${lng}`;

/**
 * Travel time with live traffic along our own path: TomTom rebuilds the route from its
 * points. Null when walking, without a key, or when TomTom fails (cards keep our estimate).
 */
export async function trafficTime(coords: LngLat[], vehicle: Vehicle): Promise<{ durationS: number; delayS: number } | null> {
  const mode = TRAVEL_MODE[vehicle];
  if (!TRAFFIC.key || !mode || coords.length < 2) return null;
  const params = new URLSearchParams({ key: TRAFFIC.key, travelMode: mode, traffic: 'true', routeRepresentation: 'summaryOnly' });
  try {
    const res = await fetch(
      `https://api.tomtom.com/routing/1/calculateRoute/${latLng(coords[0])}:${latLng(coords[coords.length - 1])}/json?${params}`,
      {
        method: 'POST',
        headers: { ...HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ supportingPoints: coords.map(([longitude, latitude]) => ({ latitude, longitude })) }),
        signal: AbortSignal.timeout(3000),
        cache: 'no-store',
      },
    );
    if (!res.ok) throw new Error(`TomTom route ${res.status}: ${await res.text()}`);
    const { summary } = (await res.json()).routes[0];
    return { durationS: summary.travelTimeInSeconds, delayS: summary.trafficDelayInSeconds };
  } catch (e) {
    console.error(e);
    return null;
  }
}
