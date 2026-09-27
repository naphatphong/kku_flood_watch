import { getViewer } from '@/lib/auth';
import { recompute } from '@/lib/data/refresh';
import { errorJson, rateLimited } from '@/lib/http';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

type Ctx = { params: Promise<{ id: string }> };

async function guard(req: Request, ctx: Ctx) {
  if (!isSupabaseConfigured) return { error: errorJson(503, 'ยังไม่ได้เชื่อมฐานข้อมูล') };
  const viewer = await getViewer();
  if (!viewer) return { error: errorJson(401, 'เข้าสู่ระบบก่อนโหวต') };
  if (viewer.banned) return { error: errorJson(403, 'บัญชีนี้ถูกระงับ') };
  const limited = await rateLimited(req, 'userActions', viewer.id);
  if (limited) return { error: limited };
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return { error: errorJson(400, 'ไม่พบโพสต์') };
  return { viewer, id };
}

/** Vote "still flooded" or "receded" (one per user per post, changeable). Body: {vote}. */
export async function POST(req: Request, ctx: Ctx) {
  const g = await guard(req, ctx);
  if ('error' in g) return g.error;
  const { vote } = await req.json().catch(() => ({}));
  if (vote !== 'still' && vote !== 'receded') return errorJson(400, 'โหวตไม่ถูกต้อง');

  const db = await createClient();
  const { data: post } = await db.from('reports').select('status').eq('id', g.id).maybeSingle();
  if (post?.status !== 'approved') return errorJson(404, 'ไม่พบโพสต์');
  const { error } = await db
    .from('votes')
    .upsert({ report_id: g.id, user_id: g.viewer.id, vote, created_at: new Date().toISOString() });
  if (error) return errorJson(400, 'โหวตไม่สำเร็จ');
  await recompute(createAdminClient());
  return Response.json({ ok: true, vote });
}

/** Remove my vote. */
export async function DELETE(req: Request, ctx: Ctx) {
  const g = await guard(req, ctx);
  if ('error' in g) return g.error;
  const { error } = await (await createClient()).from('votes').delete().eq('report_id', g.id).eq('user_id', g.viewer.id);
  if (error) return errorJson(400, 'ยกเลิกโหวตไม่สำเร็จ');
  await recompute(createAdminClient());
  return Response.json({ ok: true, vote: null });
}
