import { getReports } from '@/lib/data/map';
import { errorJson, parseBBox, PUBLIC_CACHE, rateLimited } from '@/lib/http';

/** Approved posts that still count, inside `?bbox=` (PLAN §10). */
export async function GET(req: Request) {
  const limited = await rateLimited(req, 'publicApi');
  if (limited) return limited;
  try {
    return Response.json(await getReports(parseBBox(new URL(req.url))), { headers: PUBLIC_CACHE });
  } catch (e) {
    console.error(e);
    return errorJson(500, 'โหลดโพสต์ไม่สำเร็จ');
  }
}
