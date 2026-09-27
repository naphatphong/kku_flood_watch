import { errorJson, rateLimited } from '@/lib/http';
import { createAnonClient } from '@/lib/supabase/anon';
import { isSupabaseConfigured } from '@/lib/supabase/env';

const RADIUS_M = 120;

/** Road segments near `?lng=&lat=` for the road-post picker, nearest first. */
export async function GET(req: Request) {
  if (!isSupabaseConfigured) return Response.json({ type: 'FeatureCollection', features: [] });
  const limited = await rateLimited(req, 'publicApi');
  if (limited) return limited;
  const url = new URL(req.url);
  const lng = Number(url.searchParams.get('lng'));
  const lat = Number(url.searchParams.get('lat'));
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return errorJson(400, 'ต้องระบุ lng และ lat');
  const { data, error } = await createAnonClient().rpc('segments_near', { p_lng: lng, p_lat: lat, p_radius_m: RADIUS_M });
  if (error) {
    console.error(error);
    return errorJson(500, 'โหลดถนนไม่สำเร็จ');
  }
  return Response.json(data);
}
