import { getViewer } from '@/lib/auth';
import { FLAG_REASONS, POST as POST_LIMITS } from '@/lib/config';
import { recompute } from '@/lib/data/refresh';
import { errorJson, rateLimited } from '@/lib/http';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

/** Report a post (PLAN §7). Enough distinct users hide it until an admin reviews it. Body: {reason}. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured) return errorJson(503, 'ยังไม่ได้เชื่อมฐานข้อมูล');
  const viewer = await getViewer();
  if (!viewer) return errorJson(401, 'เข้าสู่ระบบก่อนรีพอร์ต');
  if (viewer.banned) return errorJson(403, 'บัญชีนี้ถูกระงับ');
  const limited = await rateLimited(req, 'userActions', viewer.id);
  if (limited) return limited;

  const id = Number((await params).id);
  const { reason } = await req.json().catch(() => ({}));
  if (!Number.isInteger(id) || !Object.hasOwn(FLAG_REASONS, reason)) return errorJson(400, 'ข้อมูลไม่ถูกต้อง');

  const { error } = await (await createClient()).from('post_flags').insert({ report_id: id, user_id: viewer.id, reason });
  if (error) return errorJson(error.code === '23505' ? 409 : 400, error.code === '23505' ? 'คุณรีพอร์ตโพสต์นี้แล้ว' : 'รีพอร์ตไม่สำเร็จ');

  const admin = createAdminClient();
  const { data: post } = await admin.from('reports').select('status, flag_count').eq('id', id).single();
  if (post && post.status === 'approved' && post.flag_count >= POST_LIMITS.flagsToHide) {
    await admin.from('reports').update({ status: 'hidden' }).eq('id', id);
    await recompute(admin);
  }
  return Response.json({ ok: true });
}
