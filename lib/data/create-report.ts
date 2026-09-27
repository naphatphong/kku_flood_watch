import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Viewer } from '../auth';
import { LIMITS, POST, SPAM } from '../config';
import { distanceM, type LngLat } from '../domain/geo';
import { insideArea, type ReportInput } from '../domain/report-input';
import { spamCheck } from '../domain/spam';
import type { ReportStatus } from '../domain/types';
import { createAdminClient } from '../supabase/admin';
import { fetchElevation } from './elevation';
import { processPhoto } from './photo';
import { fetchRain } from './rain';
import { recompute } from './refresh';

export class ReportError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/**
 * Creates a post (PLAN §4, §7): limits → position → spam score → rain snapshot and
 * elevation (training data) → photo → insert → recompute circles and roads.
 */
export async function createReport(viewer: Viewer, input: ReportInput, photo: File | null) {
  if (viewer.banned) throw new ReportError('บัญชีนี้ถูกระงับการโพสต์', 403);
  const db = createAdminClient();
  const now = new Date();

  // Posting rate: one per cooldown, at most postsPerDay per day.
  const since = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
  const [recent, today] = await Promise.all([
    db.from('reports').select('id', { count: 'exact', head: true }).eq('user_id', viewer.id).gt('created_at', since(LIMITS.postCooldownMinutes)),
    db.from('reports').select('id', { count: 'exact', head: true }).eq('user_id', viewer.id).gt('created_at', since(24 * 60)),
  ]);
  if (recent.count) throw new ReportError(`โพสต์ได้ครั้งละ 1 โพสต์ทุก ${LIMITS.postCooldownMinutes} นาที`, 429);
  if ((today.count ?? 0) >= LIMITS.postsPerDay) throw new ReportError(`โพสต์ได้ไม่เกิน ${LIMITS.postsPerDay} โพสต์ต่อวัน`, 429);

  // Road posts sit halfway along the chosen segments, which must join into one line.
  let position: LngLat = input.position;
  let roadLengthM: number | null = null;
  if (input.kind === 'road') {
    const { data: sel, error } = await db.rpc('road_selection', { p_ids: input.segmentIds });
    if (error) throw error;
    if (sel.found !== input.segmentIds.length) throw new ReportError('ไม่พบท่อนถนนที่เลือก');
    if (!sel.connected) throw new ReportError('ท่อนถนนที่เลือกต้องต่อกันเป็นเส้นเดียว');
    if (sel.length_m > POST.roadMaxLengthM) throw new ReportError(`เลือกถนนได้ยาวไม่เกิน ${POST.roadMaxLengthM} ม.`);
    position = [sel.lng, sel.lat];
    roadLengthM = Math.round(sel.length_m);
    if (!insideArea(position)) throw new ReportError('ถนนที่เลือกอยู่นอกพื้นที่');
  }

  const posterDistanceM = input.poster ? Math.round(distanceM(input.poster, position)) : null;
  if (posterDistanceM != null && posterDistanceM > LIMITS.maxPosterDistanceKm * 1000)
    throw new ReportError(`ต้องอยู่ห่างจากจุดที่รายงานไม่เกิน ${LIMITS.maxPosterDistanceKm} กม.`);

  // Rain now (for the spam rule and the training snapshot) and ground elevation.
  const [rainRow, elevationM, stats] = await Promise.all([
    db.from('rainfall').select('r1, r3, r24, r72, rainy_days').order('ts', { ascending: false }).limit(1).maybeSingle(),
    fetchElevation(position),
    db.rpc('poster_stats', { p_user: viewer.id, p_penalty_days: SPAM.repeatOffender.days }),
  ]);
  if (stats.error) throw stats.error;
  const rain =
    rainRow.data ??
    (await fetchRain(now)
      .then((r) => ({ r1: r.r1, r3: r.r3, r24: r.r24, r72: r.r72, rainy_days: r.rainyDays }))
      .catch(() => null));

  const spam = spamCheck(
    {
      accountCreatedAt: new Date(viewer.createdAt),
      posterDistanceM,
      waterLevel: input.waterLevel,
      rain24Mm: rain?.r24 ?? 0,
      radiusM: input.radiusM,
      roadLengthM,
      note: input.note,
      penalties30d: stats.data.penalties,
      approvedCount: stats.data.approved,
      rejectedCount: stats.data.rejected,
    },
    now,
  );

  let photoPath: string | null = null;
  if (photo && photo.size > 0) {
    let jpeg: Buffer;
    try {
      jpeg = await processPhoto(photo);
    } catch {
      throw new ReportError('ใช้รูปนี้ไม่ได้ ลองรูปอื่น (JPG/PNG/HEIC ไม่เกิน 10 MB)');
    }
    photoPath = `${now.toISOString().slice(0, 7)}/${randomUUID()}.jpg`;
    const { error } = await db.storage.from('report-photos').upload(photoPath, jpeg, { contentType: 'image/jpeg' });
    if (error) throw error;
  }

  const { data: row, error } = await db
    .from('reports')
    .insert({
      user_id: viewer.id,
      kind: input.kind,
      geom: `SRID=4326;POINT(${position[0]} ${position[1]})`,
      radius_m: input.radiusM,
      road_length_m: roadLengthM,
      water_level: input.waterLevel,
      status_tags: input.statusTags,
      passability: input.passability,
      note: input.note,
      photo_path: photoPath,
      poster_distance_m: posterDistanceM,
      elevation_m: elevationM,
      rain_snapshot: rain,
      spam_score: spam.score,
      spam_reasons: spam.reasons,
      status: spam.status,
    })
    .select('id')
    .single();
  if (error) throw error;

  if (input.kind === 'road') {
    const { error: linkError } = await db
      .from('report_road_segments')
      .insert(input.segmentIds.map((segment_id) => ({ report_id: row.id, segment_id })));
    if (linkError) throw linkError;
  }

  if (spam.status === 'approved') await recompute(db, now);
  return { id: row.id as number, status: spam.status as ReportStatus };
}
