import { getRoutes, RouteError } from '@/lib/data/route';
import { parseRouteQuery } from '@/lib/domain/route';
import { errorJson, rateLimited } from '@/lib/http';
import { isSupabaseConfigured } from '@/lib/supabase/env';

/** Flood-avoiding routes (PLAN §6, §10): `?from=&to=&vehicle=&avoid=&via=`. Public, rate limited. */
export async function GET(req: Request) {
  if (!isSupabaseConfigured) return errorJson(503, 'ระบบนำทางจะใช้ได้เมื่อเชื่อมฐานข้อมูลแล้ว');
  const limited = await rateLimited(req, 'routeApi');
  if (limited) return limited;
  const parsed = parseRouteQuery(new URL(req.url).searchParams);
  if (!parsed.ok) return errorJson(400, parsed.error);
  try {
    // Statuses change with every post and vote: never cache.
    return Response.json(await getRoutes(parsed.query), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof RouteError) return errorJson(400, e.message);
    console.error(e);
    return errorJson(500, 'หาเส้นทางไม่สำเร็จ ลองใหม่อีกครั้ง');
  }
}
