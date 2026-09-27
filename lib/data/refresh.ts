import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Category, Passability, StatusTag, Vehicle, WaterLevel } from '../config';
import { buildClusters, isFlooded } from '../domain/cluster';
import { isActive } from '../domain/post';
import { rainScore } from '../domain/rain';
import { segmentStatuses } from '../domain/segments';
import type { Report, ReportKind } from '../domain/types';
import { activeCutoff } from './map';
import { fetchRain } from './rain';

interface ActiveRow {
  id: number;
  kind: ReportKind;
  category: Category;
  lng: number;
  lat: number;
  radius_m: number | null;
  water_level: WaterLevel | null;
  status_tags: StatusTag[];
  passability: Partial<Record<Vehicle, Passability>>;
  created_at: string;
  last_still_vote_at: string | null;
  still_votes: number;
  receded_votes: number;
  elevation_m: number | null;
}

const toReport = (r: ActiveRow): Report => ({
  id: r.id,
  kind: r.kind,
  category: r.category,
  position: [r.lng, r.lat],
  radiusM: r.radius_m,
  waterLevel: r.water_level,
  statusTags: r.status_tags,
  passability: r.passability,
  createdAt: new Date(r.created_at),
  lastStillVoteAt: r.last_still_vote_at ? new Date(r.last_still_vote_at) : null,
  votes: { still: r.still_votes, receded: r.receded_votes },
  elevationM: r.elevation_m,
});

const must = <T>({ data, error }: { data: T; error: unknown }) => {
  if (error) throw error;
  return data;
};

/** Fetches rain from Open-Meteo and stores it (every 15 min via pg_cron). */
export async function refreshRain(db: SupabaseClient) {
  const r = await fetchRain();
  must(
    await db.from('rainfall').upsert({
      ts: r.at.toISOString(),
      r1: r.r1,
      r3: r.r3,
      r24: r.r24,
      r72: r.r72,
      rainy_days: r.rainyDays,
      forecast_3h: r.forecast3h,
      hourly: r.hourly,
    }),
  );
  return r;
}

/**
 * Recomputes flood circles and road statuses from active approved posts (PLAN §5, §4)
 * and stores the hourly training snapshot. Runs after every post, vote and refresh.
 */
export async function recompute(db: SupabaseClient, now = new Date()) {
  const rain = must(await db.from('rainfall').select('r3, r24, rainy_days').order('ts', { ascending: false }).limit(1).maybeSingle());
  const score = rain ? rainScore({ r3: rain.r3, r24: rain.r24, rainyDays: rain.rainy_days }) : 0;

  const cutoff = activeCutoff(now);
  const rows = (must(
    await db
      .from('reports')
      .select('id, kind, category, lng, lat, radius_m, water_level, status_tags, passability, created_at, last_still_vote_at, still_votes, receded_votes, elevation_m')
      .eq('status', 'approved')
      .or(`created_at.gt.${cutoff},last_still_vote_at.gt.${cutoff}`),
  ) ?? []) as ActiveRow[];
  const reports = rows.map(toReport).filter((r) => isActive(r, now));

  // Flood circles (flood posts only), named after the nearest road.
  const clusters = buildClusters(reports.filter((r) => r.category === 'flood'), score, now);
  const names = await Promise.all(
    clusters.map(async (c) =>
      isFlooded(c) ? must(await db.rpc('nearest_road_name', { p_lng: c.center[0], p_lat: c.center[1] })) : null,
    ),
  );
  must(
    await db.rpc('replace_flood_clusters', {
      p_clusters: clusters.map((c, i) => ({
        id: c.id,
        name: names[i],
        lng: c.center[0],
        lat: c.center[1],
        radius_m: c.radiusM,
        report_ids: c.reportIds,
        low_factor: c.lowFactor,
        base: c.base,
        report: c.report,
        c: c.c,
        final: c.final,
        weight_sum: c.weightSum,
        flooded: isFlooded(c),
      })),
    }),
  );

  // Road status: road posts cover their chosen segments, area posts the segments in their circle.
  // Incident posts count too: closures carry "blocked", the others no passability.
  const roadIds = reports.filter((r) => r.kind === 'road').map((r) => r.id);
  const area = reports.filter((r) => r.kind === 'area');
  const [roadLinks, areaLinks] = await Promise.all([
    roadIds.length
      ? db.from('report_road_segments').select('report_id, segment_id').in('report_id', roadIds).then(must)
      : [],
    area.length
      ? db
          .rpc('segments_in_circles', {
            p_reports: area.map((r) => ({ id: r.id, lng: r.position[0], lat: r.position[1], radius_m: r.radiusM })),
          })
          .then(must)
      : [],
  ]);
  const segmentsOf = new Map<number, number[]>();
  for (const { report_id, segment_id } of [...(roadLinks as { report_id: number; segment_id: number }[]), ...(areaLinks as { report_id: number; segment_id: number }[])])
    segmentsOf.set(report_id, [...(segmentsOf.get(report_id) ?? []), segment_id]);

  const statuses = segmentStatuses(reports, segmentsOf, now);
  must(
    await db.rpc('replace_segment_status', {
      p_rows: [...statuses].flatMap(([segment_id, byVehicle]) =>
        Object.entries(byVehicle)
          .filter(([, status]) => status !== 'unknown')
          .map(([vehicle, status]) => ({ segment_id, vehicle, status })),
      ),
    }),
  );
  must(await db.rpc('snapshot_clusters_hourly', { p_rain_score: score }));

  return { reports: reports.length, clusters: clusters.length, flooded: clusters.filter(isFlooded).length, segments: statuses.size };
}
