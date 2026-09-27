import { getSegments } from '@/lib/data/map';
import { errorJson, parseBBox, PUBLIC_CACHE, rateLimited } from '@/lib/http';

/** Road status per vehicle inside `?bbox=` as GeoJSON (PLAN §10). */
export async function GET(req: Request) {
  const limited = await rateLimited(req, 'publicApi');
  if (limited) return limited;
  try {
    return Response.json(await getSegments(parseBBox(new URL(req.url))), { headers: PUBLIC_CACHE });
  } catch (e) {
    console.error(e);
    return errorJson(500, 'โหลดสถานะถนนไม่สำเร็จ');
  }
}
