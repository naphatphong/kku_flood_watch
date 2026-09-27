import { getViewer } from '@/lib/auth';
import { createReport, ReportError } from '@/lib/data/create-report';
import { getReports } from '@/lib/data/map';
import { parseReportForm } from '@/lib/domain/report-input';
import { errorJson, parseBBox, PUBLIC_CACHE, rateLimited } from '@/lib/http';
import { isSupabaseConfigured } from '@/lib/supabase/env';

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

/** Create a post (multipart form, signed-in users only). */
export async function POST(req: Request) {
  if (!isSupabaseConfigured) return errorJson(503, 'ยังไม่ได้เชื่อมฐานข้อมูล โพสต์ยังไม่ได้');
  const viewer = await getViewer();
  if (!viewer) return errorJson(401, 'เข้าสู่ระบบก่อนโพสต์');

  const form = await req.formData().catch(() => null);
  if (!form) return errorJson(400, 'ข้อมูลไม่ถูกต้อง');
  const parsed = parseReportForm(form);
  if (!parsed.ok) return errorJson(400, parsed.error);

  try {
    const photo = form.get('photo');
    return Response.json(await createReport(viewer, parsed.input, photo instanceof File ? photo : null), { status: 201 });
  } catch (e) {
    if (e instanceof ReportError) return errorJson(e.status, e.message);
    console.error(e);
    return errorJson(500, 'บันทึกโพสต์ไม่สำเร็จ ลองใหม่อีกครั้ง');
  }
}
