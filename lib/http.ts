import 'server-only';
import { LIMITS, MAP } from './config';
import { destination } from './domain/geo';
import type { BBox } from './data/types';
import { createAdminClient } from './supabase/admin';
import { isSupabaseConfigured } from './supabase/env';

export const clientIp = (req: Request) =>
  req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';

export const errorJson = (status: number, error: string, headers?: HeadersInit) =>
  Response.json({ error }, { status, headers });

/** Short CDN cache for public map reads; realtime tells clients when to refetch. */
export const PUBLIC_CACHE = { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=30' };

/** Per-IP fixed-window limit (PLAN §7). Returns a 429 response when over the limit. */
export async function rateLimited(req: Request, bucket: keyof Pick<typeof LIMITS, 'publicApi' | 'routeApi'>) {
  if (!isSupabaseConfigured) return null;
  const { windowSeconds, maxRequests } = LIMITS[bucket];
  try {
    const { data: allowed, error } = await createAdminClient().rpc('rate_limit_hit', {
      p_key: `${bucket}:${clientIp(req)}`,
      p_window_seconds: windowSeconds,
      p_max: maxRequests,
    });
    if (error) throw error;
    return allowed ? null : errorJson(429, 'เรียกใช้บ่อยเกินไป ลองใหม่อีกครั้งในอีกสักครู่', { 'Retry-After': String(windowSeconds) });
  } catch (e) {
    console.error('rate limit check failed', e); // fail open for reads
    return null;
  }
}

/** Area bbox (the 5 km circle's bounding square). */
export const AREA_BBOX: BBox = (() => {
  const r = MAP.radiusKm * 1000;
  const [west, south] = destination(MAP.center, -r, -r);
  const [east, north] = destination(MAP.center, r, r);
  return [west, south, east, north];
})();

/** `?bbox=west,south,east,north`, clamped to the area; defaults to the whole area. */
export function parseBBox(url: URL): BBox {
  const parts = url.searchParams.get('bbox')?.split(',').map(Number);
  if (!parts || parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return AREA_BBOX;
  const [w, s, e, n] = parts;
  return [Math.max(w, AREA_BBOX[0]), Math.max(s, AREA_BBOX[1]), Math.min(e, AREA_BBOX[2]), Math.min(n, AREA_BBOX[3])];
}
