import { timingSafeEqual } from 'node:crypto';
import { recompute, refreshRain } from '@/lib/data/refresh';
import { errorJson } from '@/lib/http';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/env';

const SECRET = process.env.CRON_SECRET ?? '';

function authorized(req: Request) {
  const given = Buffer.from(req.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${SECRET}`);
  return SECRET.length >= 16 && given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Called every 15 minutes by pg_cron (supabase/migrations/..._platform.sql):
 * fetch rain, then recompute flood circles, road statuses and the hourly snapshot.
 */
export async function POST(req: Request) {
  if (!isSupabaseConfigured) return errorJson(503, 'Supabase is not configured');
  if (!authorized(req)) return errorJson(401, 'unauthorized');
  const db = createAdminClient();
  try {
    const rain = await refreshRain(db).catch((e) => {
      console.error('rain fetch failed, recomputing with the last stored rain', e);
      return null;
    });
    const result = await recompute(db);
    return Response.json({ ok: true, rain: rain && { r3: rain.r3, r24: rain.r24, rainyDays: rain.rainyDays }, ...result });
  } catch (e) {
    console.error(e);
    return errorJson(500, 'refresh failed');
  }
}
