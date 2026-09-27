import { getViewer } from '@/lib/auth';
import { AdminError, moderateReport, type ReportAction } from '@/lib/data/admin';
import { errorJson } from '@/lib/http';

const ACTIONS: ReportAction[] = ['approve', 'reject', 'delete', 'restore'];

/** Moderate a post (PLAN §10). Body: {action: approve|reject|delete|restore, note?}. Admins only. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return errorJson(403, 'สำหรับแอดมินเท่านั้น');
  const id = Number((await params).id);
  const { action, note } = await req.json().catch(() => ({}));
  if (!Number.isInteger(id) || !ACTIONS.includes(action)) return errorJson(400, 'ข้อมูลไม่ถูกต้อง');
  try {
    const status = await moderateReport(viewer, id, action, typeof note === 'string' && note.trim() ? note.trim().slice(0, 500) : null);
    return Response.json({ ok: true, status });
  } catch (e) {
    if (e instanceof AdminError) return errorJson(e.status, e.message);
    console.error(e);
    return errorJson(500, 'ทำรายการไม่สำเร็จ');
  }
}
