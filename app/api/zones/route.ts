import { getZones } from '@/lib/data/map';
import { errorJson, PUBLIC_CACHE, rateLimited } from '@/lib/http';

/** Flooded circles with their % breakdown, plus the rain behind it (PLAN §10). */
export async function GET(req: Request) {
  const limited = await rateLimited(req, 'publicApi');
  if (limited) return limited;
  try {
    return Response.json(await getZones(), { headers: PUBLIC_CACHE });
  } catch (e) {
    console.error(e);
    return errorJson(500, 'โหลดข้อมูลโซนไม่สำเร็จ');
  }
}
