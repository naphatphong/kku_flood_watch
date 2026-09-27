import 'server-only';
import type { FeatureCollection } from 'geojson';
import { POST, type Passability, type StatusTag, type Vehicle, type WaterLevel } from '../config';
import type { ReportKind } from '../domain/types';
import { rainScore } from '../domain/rain';
import { watchCircles, type LowSpot } from '../domain/watch';
import lowSpots from '../low-spots.json'; // scripts/elevation-terciles.ts
import { createAnonClient } from '../supabase/anon';
import { isSupabaseConfigured, SUPABASE_URL } from '../supabase/env';
import { demoClusters, demoReports, demoSegments, toPin } from './demo';
import { fetchRain, toRainDTO } from './rain';
import type { BBox, ClusterDTO, RainDTO, ReportPin, ReportsResponse, WatchDTO, ZonesResponse } from './types';

export const REPORT_COLUMNS =
  'id, kind, lng, lat, radius_m, water_level, status_tags, passability, note, photo_path, created_at, still_votes, receded_votes';

export const photoUrl = (path: string | null) =>
  path ? `${SUPABASE_URL}/storage/v1/object/public/report-photos/${path}` : null;

export interface ReportRow {
  id: number;
  kind: ReportKind;
  lng: number;
  lat: number;
  radius_m: number | null;
  water_level: WaterLevel;
  status_tags: StatusTag[];
  passability: Partial<Record<Vehicle, Passability>>;
  note: string | null;
  photo_path: string | null;
  created_at: string;
  still_votes: number;
  receded_votes: number;
}

export const rowToPin = (r: ReportRow): ReportPin => ({
  id: r.id,
  kind: r.kind,
  lng: r.lng,
  lat: r.lat,
  radiusM: r.radius_m,
  waterLevel: r.water_level,
  statusTags: r.status_tags,
  passability: r.passability,
  note: r.note,
  photoUrl: photoUrl(r.photo_path),
  createdAt: r.created_at,
  stillVotes: r.still_votes,
  recededVotes: r.receded_votes,
});

/** Posts count until expiryHours after posting or after the latest "still" vote. */
export const activeCutoff = (now = new Date()) =>
  new Date(now.getTime() - POST.expiryHours * 3_600_000).toISOString();

/** Watch circles for this rain, leaving out low spots already inside a reported circle. */
const watchFor = (score: number, clusters: ClusterDTO[]): WatchDTO[] =>
  watchCircles(lowSpots as LowSpot[], score, clusters.map((c) => ({ center: [c.lng, c.lat], radiusM: c.radiusM }))).map(
    ({ id, name, center, radiusM, elevationM, pct }) => ({ id, name, lng: center[0], lat: center[1], radiusM, elevationM, pct }),
  );

/** Flooded circles (riskiest first), watch circles and the rain that fed them. */
export async function getZones(): Promise<ZonesResponse> {
  const now = new Date();
  if (!isSupabaseConfigured) {
    const rain = await fetchRain(now).then(toRainDTO).catch(() => null);
    const score = rain ? rainScore(rain) : 0;
    const clusters = demoClusters(now, score);
    return { clusters, watch: watchFor(score, clusters), rain, rainScore: score, updatedAt: now.toISOString(), demo: true };
  }

  const db = createAnonClient();
  const [clusters, rainRow] = await Promise.all([
    db.from('flood_clusters').select('*').eq('flooded', true).order('final', { ascending: false }),
    db.from('rainfall').select('*').order('ts', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (clusters.error) throw clusters.error;
  if (rainRow.error) throw rainRow.error;

  const r = rainRow.data;
  const rain: RainDTO | null = r && {
    at: r.ts,
    r1: r.r1,
    r3: r.r3,
    r24: r.r24,
    r72: r.r72,
    rainyDays: r.rainy_days,
    forecast3h: r.forecast_3h,
    hourly: r.hourly,
  };
  const list = clusters.data.map(
    (c): ClusterDTO => ({
      id: c.id,
      name: c.name,
      lng: c.lng,
      lat: c.lat,
      radiusM: c.radius_m,
      reportCount: c.report_count,
      base: c.base,
      report: c.report,
      c: c.c,
      final: c.final,
      lowFactor: c.low_factor,
    }),
  );
  const score = rain ? rainScore(rain) : 0;
  return {
    clusters: list,
    watch: watchFor(score, list),
    rain,
    rainScore: score,
    updatedAt: clusters.data[0]?.updated_at ?? r?.ts ?? now.toISOString(),
    demo: false,
  };
}

/** Approved posts that still count, inside a bbox. */
export async function getReports([west, south, east, north]: BBox): Promise<ReportsResponse> {
  const now = new Date();
  if (!isSupabaseConfigured) {
    return {
      reports: demoReports(now)
        .filter((r) => r.position[0] >= west && r.position[0] <= east && r.position[1] >= south && r.position[1] <= north)
        .map(toPin),
      demo: true,
    };
  }
  const cutoff = activeCutoff(now);
  const { data, error } = await createAnonClient()
    .from('reports')
    .select(REPORT_COLUMNS)
    .eq('status', 'approved')
    .or(`created_at.gt.${cutoff},last_still_vote_at.gt.${cutoff}`)
    .gte('lng', west)
    .lte('lng', east)
    .gte('lat', south)
    .lte('lat', north)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return { reports: data.map(rowToPin), demo: false };
}

/** Road segments with a status inside a bbox (GeoJSON, statuses for every vehicle). */
export async function getSegments([west, south, east, north]: BBox): Promise<FeatureCollection> {
  if (!isSupabaseConfigured) return demoSegments(new Date());
  const { data, error } = await createAnonClient().rpc('map_segments', {
    p_west: west,
    p_south: south,
    p_east: east,
    p_north: north,
  });
  if (error) throw error;
  return data as FeatureCollection;
}
