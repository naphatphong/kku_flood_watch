import { getViewer } from '@/lib/auth';
import { CodeError, getBuildingCodes, placeBuildingCode } from '@/lib/data/building-codes';
import { errorJson, PUBLIC_CACHE, rateLimited } from '@/lib/http';
import { isSupabaseConfigured } from '@/lib/supabase/env';

/** Building codes visitors have placed: {"CP09": {id, name, center}}. Empty when unavailable. */
export async function GET(req: Request) {
  if (!isSupabaseConfigured) return Response.json({});
  const limited = await rateLimited(req, 'publicApi');
  if (limited) return limited;
  try {
    return Response.json(await getBuildingCodes(), { headers: PUBLIC_CACHE });
  } catch (e) {
    console.error(e); // the import still works, unknown codes are just picked by hand
    return Response.json({});
  }
}

/** Place an unknown building code for everyone (signed-in users). Body: {code, buildingId} or {code, center}. */
export async function POST(req: Request) {
  if (!isSupabaseConfigured) return errorJson(503, 'ยังไม่ได้เชื่อมฐานข้อมูล');
  const viewer = await getViewer();
  if (!viewer) return errorJson(401, 'เข้าสู่ระบบเพื่อบันทึกตึกให้ทุกคน');
  if (viewer.banned) return errorJson(403, 'บัญชีนี้ถูกระงับ');
  const limited = await rateLimited(req, 'userActions', viewer.id);
  if (limited) return limited;
  try {
    return Response.json(await placeBuildingCode(viewer, await req.json().catch(() => ({}))));
  } catch (e) {
    if (e instanceof CodeError) return errorJson(e.status, e.message);
    console.error(e);
    return errorJson(500, 'บันทึกรหัสตึกไม่สำเร็จ');
  }
}
