// Place search for the navigation page (browser only). Photon: OpenStreetMap data, no key.
import { MAP, ROUTING } from './config';
import { destination, type LngLat } from './domain/geo';

export interface Place {
  label: string;
  detail: string;
  position: LngLat;
}

interface PhotonFeature {
  geometry: { coordinates: LngLat };
  properties: Record<string, string | undefined>;
}

const r = ROUTING.placeSearchKm * 1000;
const BBOX = [...destination(MAP.center, -r, -r), ...destination(MAP.center, r, r)].map((x) => x.toFixed(4)).join(',');

/** Places matching `q`, nearest to the campus first. */
export async function searchPlaces(q: string, signal?: AbortSignal): Promise<Place[]> {
  const url = new URL(ROUTING.geocoderUrl);
  url.search = new URLSearchParams({ q, lat: String(MAP.center[1]), lon: String(MAP.center[0]), limit: '7', bbox: BBOX }).toString();
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`geocoder ${res.status}`);
  const { features } = (await res.json()) as { features: PhotonFeature[] };
  const places = features.map(({ geometry, properties: p }) => ({
    label: p.name || [p.housenumber, p.street].filter(Boolean).join(' ') || 'ไม่มีชื่อ',
    detail: [p.name ? p.street : null, p.district ?? p.locality, p.city].filter(Boolean).join(' · '),
    position: geometry.coordinates,
  }));
  // OSM often has a building and a point for the same place.
  return places.filter((p, i) => places.findIndex((q) => q.label === p.label && q.detail === p.detail) === i);
}
