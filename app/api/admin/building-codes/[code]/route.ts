import { getViewer } from '@/lib/auth';
import { deleteBuildingCode } from '@/lib/data/building-codes';
import { errorJson } from '@/lib/http';

/** Delete a wrongly placed building code (body {action: delete}); the next visitor places it again. Admins only. */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return errorJson(403, 'สำหรับแอดมินเท่านั้น');
  const code = (await params).code;
  const { action } = await req.json().catch(() => ({}));
  if (!/^[A-Z]{2,3}\d{2}$/.test(code) || action !== 'delete') return errorJson(400, 'ข้อมูลไม่ถูกต้อง');
  try {
    await deleteBuildingCode(code);
    return Response.json({ ok: true });
  } catch (e) {
    console.error(e);
    return errorJson(500, 'ลบไม่สำเร็จ');
  }
}
