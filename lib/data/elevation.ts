import type { LngLat } from '../domain/geo';

/** Ground elevation (m) from Open-Meteo (Copernicus DEM 90 m); null if the service is slow or down. */
export async function fetchElevation([lng, lat]: LngLat): Promise<number | null> {
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const { elevation } = (await res.json()) as { elevation: number[] };
    return Number.isFinite(elevation?.[0]) ? elevation[0] : null;
  } catch {
    return null;
  }
}
