import { MAP, SITE } from '../config';
import { summarizeRain } from '../domain/rain';
import type { RainSummary } from '../domain/types';
import type { RainDTO } from './types';

/** Hourly rain at the area center from Open-Meteo (free, no key), summarized for scoring. */
export async function fetchRain(now = new Date()): Promise<RainSummary> {
  const [lng, lat] = MAP.center;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&hourly=precipitation&past_days=7&forecast_days=2&timezone=${encodeURIComponent(SITE.timeZone)}`;
  const res = await fetch(url, { next: { revalidate: 600 } });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const data = await res.json();
  return summarizeRain(
    { times: data.hourly.time, precipitation: data.hourly.precipitation, utcOffsetSeconds: data.utc_offset_seconds },
    now,
  );
}

export const toRainDTO = (r: RainSummary): RainDTO => ({ ...r, at: r.at.toISOString() });
