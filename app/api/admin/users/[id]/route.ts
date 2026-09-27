import { getViewer } from '@/lib/auth';
import { AdminError, setUserBan } from '@/lib/data/admin';
import { errorJson } from '@/lib/http';

/** Ban or unban a user (PLAN §10). Body: {action: ban|unban, note?}. Admins only. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return errorJson(403, 'สำหรับแอดมินเท่านั้น');
  const id = (await params).id;
  const { action, note } = await req.json().catch(() => ({}));
  if (!/^[0-9a-f-]{36}$/i.test(id) || (action !== 'ban' && action !== 'unban')) return errorJson(400, 'ข้อมูลไม่ถูกต้อง');
  try {
    await setUserBan(viewer, id, action === 'ban', typeof note === 'string' && note.trim() ? note.trim().slice(0, 500) : null);
    return Response.json({ ok: true, banned: action === 'ban' });
  } catch (e) {
    if (e instanceof AdminError) return errorJson(e.status, e.message);
    console.error(e);
    return errorJson(500, 'ทำรายการไม่สำเร็จ');
  }
}
