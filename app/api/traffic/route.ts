import { TRAFFIC } from '@/lib/config';
import { getIncidents } from '@/lib/data/traffic';
import { errorJson, rateLimited } from '@/lib/http';

/** Current traffic incidents in the area (TomTom). Empty when no key is set. */
export async function GET(req: Request) {
  const limited = await rateLimited(req, 'publicApi');
  if (limited) return limited;
  try {
    const maxAge = TRAFFIC.incidentsCacheMinutes * 60;
    return Response.json(
      { incidents: await getIncidents() },
      { headers: { 'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=60` } },
    );
  } catch (e) {
    console.error(e);
    return errorJson(502, 'โหลดข้อมูลจราจรไม่สำเร็จ');
  }
}
