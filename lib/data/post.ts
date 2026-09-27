import 'server-only';
import type { Viewer } from '../auth';
import type { LngLat } from '../domain/geo';
import { isActive } from '../domain/post';
import type { ReportStatus } from '../domain/types';
import { createClient } from '../supabase/server';
import { isSupabaseConfigured } from '../supabase/env';
import { demoReports, toPin } from './demo';
import { REPORT_COLUMNS, rowToPin, type ReportRow } from './map';
import type { ReportPin } from './types';

export interface PostDetail extends ReportPin {
  status: ReportStatus;
  isOwn: boolean;
  active: boolean;
  roadLengthM: number | null;
  roadLines: LngLat[][]; // road posts: the chosen segments
  placeName: string | null;
  myVote: 'still' | 'receded' | null;
  myFlag: boolean;
}

/** One post as the visitor may see it (RLS: approved, own, or admin), or null. */
export async function getPost(id: number, viewer: Viewer | null): Promise<PostDetail | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const now = new Date();

  if (!isSupabaseConfigured) {
    const r = demoReports(now).find((x) => x.id === id);
    return r
      ? { ...toPin(r), status: 'approved', isOwn: false, active: isActive(r, now), roadLengthM: null, roadLines: [], placeName: null, myVote: null, myFlag: false }
      : null;
  }

  const db = await createClient();
  const { data: row } = await db
    .from('reports')
    .select(`${REPORT_COLUMNS}, status, user_id, road_length_m`)
    .eq('id', id)
    .maybeSingle<ReportRow & { status: ReportStatus; user_id: string; road_length_m: number | null }>();
  if (!row) return null;

  const [place, road, vote, flag] = await Promise.all([
    db.rpc('nearest_road_name', { p_lng: row.lng, p_lat: row.lat }),
    row.kind === 'road'
      ? db.from('report_road_segments').select('road_segments(geom)').eq('report_id', id).returns<{ road_segments: { geom: { coordinates: LngLat[] } } }[]>()
      : null,
    viewer ? db.from('votes').select('vote').eq('report_id', id).eq('user_id', viewer.id).maybeSingle() : null,
    viewer ? db.from('post_flags').select('reason').eq('report_id', id).eq('user_id', viewer.id).maybeSingle() : null,
  ]);
  return {
    ...rowToPin(row),
    status: row.status,
    isOwn: row.user_id === viewer?.id,
    active: isActive(
      {
        category: row.category,
        createdAt: new Date(row.created_at),
        lastStillVoteAt: row.last_still_vote_at ? new Date(row.last_still_vote_at) : null,
        votes: { still: row.still_votes, receded: row.receded_votes },
      },
      now,
    ),
    roadLengthM: row.road_length_m,
    roadLines: road?.data?.map((x) => x.road_segments.geom.coordinates) ?? [],
    placeName: (place.data as string | null) ?? null,
    myVote: (vote?.data?.vote as PostDetail['myVote']) ?? null,
    myFlag: Boolean(flag?.data),
  };
}
