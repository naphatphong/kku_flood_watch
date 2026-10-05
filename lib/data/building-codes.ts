import 'server-only';
import buildingList from '@/public/data/kku-buildings.json';
import type { Viewer } from '../auth';
import type { Building } from '../domain/buildings';
import type { LngLat } from '../domain/geo';
import { codeKey, type CodeMap } from '../domain/reg-import';
import { insideArea } from '../domain/report-input';
import { createAdminClient } from '../supabase/admin';
import { createAnonClient } from '../supabase/anon';
import { createClient } from '../supabase/server';

const BUILDINGS = buildingList as Building[];

export class CodeError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

interface CodeRow {
  code: string;
  building_id: string | null;
  name: string;
  lng: number;
  lat: number;
  created_at: string;
}

const toMap = (rows: Pick<CodeRow, 'code' | 'building_id' | 'name' | 'lng' | 'lat'>[]): CodeMap =>
  Object.fromEntries(rows.map((r) => [r.code, { id: r.building_id, name: r.name, center: [r.lng, r.lat] as LngLat }]));

/** Every building code visitors have placed, for the timetable import. */
export async function getBuildingCodes(): Promise<CodeMap> {
  const { data, error } = await createAnonClient().from('building_codes').select('code, building_id, name, lng, lat');
  if (error) throw error;
  return toMap(data);
}

/**
 * Saves where a registrar building code is, for everyone. The first answer stays (admins delete
 * wrong ones); returns the saved place, which may be an earlier visitor's.
 * Body: {code, buildingId} for a building in our list, or {code, center} for a point on the map.
 */
export async function placeBuildingCode(viewer: Viewer, body: { code?: unknown; buildingId?: unknown; center?: unknown }) {
  const code = typeof body.code === 'string' ? codeKey(body.code) : null;
  if (!code) throw new CodeError(400, 'รหัสตึกไม่ถูกต้อง');
  let place: { building_id: string | null; name: string; lng: number; lat: number };
  if (typeof body.buildingId === 'string') {
    const b = BUILDINGS.find((x) => x.id === body.buildingId);
    if (!b) throw new CodeError(400, 'ไม่พบตึกนี้');
    place = { building_id: b.id, name: b.name, lng: b.center[0], lat: b.center[1] };
  } else {
    const c = body.center;
    if (!Array.isArray(c) || c.length !== 2 || !c.every(Number.isFinite) || !insideArea(c as LngLat))
      throw new CodeError(400, 'จุดนี้อยู่นอกพื้นที่');
    place = { building_id: null, name: `อาคาร ${code}`, lng: c[0], lat: c[1] };
  }
  const db = createAdminClient();
  const { error } = await db
    .from('building_codes')
    .upsert({ code, ...place, created_by: viewer.id }, { onConflict: 'code', ignoreDuplicates: true });
  if (error) throw error;
  const { data, error: readError } = await db.from('building_codes').select('code, building_id, name, lng, lat').eq('code', code);
  if (readError) throw readError;
  return toMap(data)[code];
}

// ---- Admin (RLS: admins may delete) ------------------------------------------------

export const listBuildingCodes = async () => {
  const { data, error } = await (await createClient())
    .from('building_codes')
    .select('code, building_id, name, lng, lat, created_at')
    .order('code');
  if (error) throw error;
  return data as CodeRow[];
};

export async function deleteBuildingCode(code: string) {
  const { error } = await (await createClient()).from('building_codes').delete().eq('code', code);
  if (error) throw error;
}
