import 'server-only';
import type { Viewer } from '../auth';
import type { Category, FlagReason, WaterLevel } from '../config';
import type { SpamReason } from '../domain/spam';
import type { ReportKind, ReportStatus } from '../domain/types';
import { createAdminClient } from '../supabase/admin';
import { createClient } from '../supabase/server';
import { photoUrl } from './map';
import { recompute } from './refresh';

// ---- Reads (as the signed-in admin: RLS lets admins see every row) --------------

export interface AdminPost {
  id: number;
  kind: ReportKind;
  category: Category;
  status: ReportStatus;
  waterLevel: WaterLevel | null;
  note: string | null;
  photoUrl: string | null;
  createdAt: string;
  spamScore: number;
  spamReasons: SpamReason[];
  posterDistanceM: number | null;
  flagCount: number;
  flags: Partial<Record<FlagReason, number>>;
  user: { id: string; name: string; banned: boolean };
}

export interface AdminUser {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: 'user' | 'admin';
  banned: boolean;
  createdAt: string;
  counts: Partial<Record<ReportStatus, number>>;
}

export interface AdminLog {
  id: number;
  action: string;
  targetType: 'report' | 'user';
  targetId: string;
  note: string | null;
  createdAt: string;
  admin: string;
}

const POST_COLUMNS =
  'id, kind, category, status, water_level, note, photo_path, created_at, spam_score, spam_reasons, poster_distance_m, flag_count, user_id, profiles!reports_user_id_fkey(display_name, banned)';

interface PostRow {
  id: number;
  kind: ReportKind;
  category: Category;
  status: ReportStatus;
  water_level: WaterLevel | null;
  note: string | null;
  photo_path: string | null;
  created_at: string;
  spam_score: number;
  spam_reasons: SpamReason[];
  poster_distance_m: number | null;
  flag_count: number;
  user_id: string;
  profiles: { display_name: string | null; banned: boolean } | null;
}

const must = <T>({ data, error }: { data: T | null; error: unknown }): T => {
  if (error) throw error;
  return data as T;
};

async function withFlags(rows: PostRow[]): Promise<AdminPost[]> {
  const flagged = rows.filter((r) => r.flag_count > 0).map((r) => r.id);
  const flags = flagged.length
    ? must(await (await createClient()).from('post_flags').select('report_id, reason').in('report_id', flagged))
    : [];
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    category: r.category,
    status: r.status,
    waterLevel: r.water_level,
    note: r.note,
    photoUrl: photoUrl(r.photo_path),
    createdAt: r.created_at,
    spamScore: r.spam_score,
    spamReasons: r.spam_reasons,
    posterDistanceM: r.poster_distance_m,
    flagCount: r.flag_count,
    flags: (flags as { report_id: number; reason: FlagReason }[])
      .filter((f) => f.report_id === r.id)
      .reduce<AdminPost['flags']>((acc, f) => ({ ...acc, [f.reason]: (acc[f.reason] ?? 0) + 1 }), {}),
    user: { id: r.user_id, name: r.profiles?.display_name || 'ผู้ใช้', banned: r.profiles?.banned ?? false },
  }));
}

const since = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

/** Waiting for review (oldest first), and recent automatic rejections to double-check. */
export async function getReviewQueue() {
  const db = await createClient();
  const [pending, rejected] = await Promise.all([
    db.from('reports').select(POST_COLUMNS).eq('status', 'pending').order('created_at').limit(100).returns<PostRow[]>(),
    db
      .from('reports')
      .select(POST_COLUMNS)
      .eq('status', 'rejected')
      .gt('created_at', since(7))
      .order('created_at', { ascending: false })
      .limit(50)
      .returns<PostRow[]>(),
  ]);
  return { pending: await withFlags(must(pending)), rejected: await withFlags(must(rejected)) };
}

/** Hidden by flags, and approved posts with some flags. */
export async function getFlaggedQueue() {
  const db = await createClient();
  const rows = must(
    await db
      .from('reports')
      .select(POST_COLUMNS)
      .or('status.eq.hidden,and(status.eq.approved,flag_count.gt.0)')
      .order('flag_count', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100)
      .returns<PostRow[]>(),
  );
  return withFlags(rows);
}

/** Newest users (or matching `q`), with their post counts by status. */
export async function getUsers(q: string | null): Promise<AdminUser[]> {
  const db = await createClient();
  let query = db.from('profiles').select('id, display_name, avatar_url, role, banned, created_at');
  if (q) query = query.ilike('display_name', `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
  const profiles = must(await query.order('created_at', { ascending: false }).limit(100));
  const ids = profiles.map((p) => p.id);
  const posts = ids.length ? must(await db.from('reports').select('user_id, status').in('user_id', ids).limit(10_000)) : [];
  return profiles.map((p) => ({
    id: p.id,
    name: p.display_name || 'ผู้ใช้',
    avatarUrl: p.avatar_url,
    role: p.role,
    banned: p.banned,
    createdAt: p.created_at,
    counts: posts
      .filter((x) => x.user_id === p.id)
      .reduce<AdminUser['counts']>((acc, x) => ({ ...acc, [x.status]: (acc[x.status as ReportStatus] ?? 0) + 1 }), {}),
  }));
}

/** One user and their full post history. */
export async function getUserHistory(id: string) {
  const db = await createClient();
  const [users, rows] = await Promise.all([
    db.from('profiles').select('id, display_name, avatar_url, role, banned, created_at').eq('id', id).limit(1),
    db.from('reports').select(POST_COLUMNS).eq('user_id', id).order('created_at', { ascending: false }).limit(200).returns<PostRow[]>(),
  ]);
  const p = must(users)[0];
  if (!p) return null;
  const posts = await withFlags(must(rows));
  const counts = posts.reduce<AdminUser['counts']>((acc, x) => ({ ...acc, [x.status]: (acc[x.status] ?? 0) + 1 }), {});
  const user: AdminUser = { id: p.id, name: p.display_name || 'ผู้ใช้', avatarUrl: p.avatar_url, role: p.role, banned: p.banned, createdAt: p.created_at, counts };
  return { user, posts };
}

export async function getLogs(): Promise<AdminLog[]> {
  const rows = must(
    await (await createClient())
      .from('admin_logs')
      .select('id, action, target_type, target_id, note, created_at, profiles(display_name)')
      .order('created_at', { ascending: false })
      .limit(100)
      .returns<
        { id: number; action: string; target_type: 'report' | 'user'; target_id: string; note: string | null; created_at: string; profiles: { display_name: string | null } | null }[]
      >(),
  );
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    targetType: r.target_type,
    targetId: r.target_id,
    note: r.note,
    createdAt: r.created_at,
    admin: r.profiles?.display_name || 'แอดมิน',
  }));
}

/** Tab badges. */
export async function getQueueCounts() {
  const db = await createClient();
  const [pending, flagged] = await Promise.all([
    db.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'hidden'),
  ]);
  return { pending: pending.count ?? 0, hidden: flagged.count ?? 0 };
}

// ---- Actions (service role, after the caller is checked to be an admin) ---------

export class AdminError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export type ReportAction = 'approve' | 'reject' | 'delete' | 'restore';

// Which statuses each action may move a post from, and where to.
const TRANSITIONS: Record<ReportAction, { from: ReportStatus[]; to: ReportStatus }> = {
  approve: { from: ['pending', 'rejected'], to: 'approved' },
  reject: { from: ['pending', 'approved', 'hidden'], to: 'rejected' },
  delete: { from: ['pending', 'approved', 'rejected', 'hidden'], to: 'deleted' }, // soft delete
  restore: { from: ['hidden', 'deleted'], to: 'approved' },
};

/** Actions offered for a post in this status, most likely first. */
export const allowedActions = (status: ReportStatus) =>
  (['approve', 'restore', 'reject', 'delete'] as ReportAction[]).filter((a) => TRANSITIONS[a].from.includes(status));

/** Approve / reject / delete / restore a post (PLAN §7), logged in admin_logs. */
export async function moderateReport(admin: Viewer, id: number, action: ReportAction, note: string | null) {
  const t = TRANSITIONS[action];
  const db = createAdminClient();
  const { data: post, error } = await db.from('reports').select('status').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!post) throw new AdminError('ไม่พบโพสต์', 404);
  if (!t.from.includes(post.status)) throw new AdminError('สถานะโพสต์เปลี่ยนไปแล้ว รีเฟรชหน้าแล้วลองใหม่', 409);

  // A restored post starts over: old flags would hide it again on the next one.
  if (action === 'restore') must(await db.from('post_flags').delete().eq('report_id', id));
  must(await db.from('reports').update({ status: t.to }).eq('id', id).eq('status', post.status));
  must(await db.from('admin_logs').insert({ admin_id: admin.id, action, target_type: 'report', target_id: String(id), note }));
  await recompute(db);
  return t.to;
}

/** Ban or unban a user (PLAN §7). Admins can't ban themselves or other admins. */
export async function setUserBan(admin: Viewer, userId: string, ban: boolean, note: string | null) {
  if (userId === admin.id) throw new AdminError('แบนบัญชีตัวเองไม่ได้');
  const db = createAdminClient();
  const { data: user, error } = await db.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (error) throw error;
  if (!user) throw new AdminError('ไม่พบผู้ใช้', 404);
  if (user.role === 'admin') throw new AdminError('แบนแอดมินไม่ได้');
  must(await db.from('profiles').update({ banned: ban }).eq('id', userId));
  must(await db.from('admin_logs').insert({ admin_id: admin.id, action: ban ? 'ban' : 'unban', target_type: 'user', target_id: userId, note }));
}
