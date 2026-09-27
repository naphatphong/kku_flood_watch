import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from './env';

const SECRET_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

/** Service-role client: bypasses RLS. Server code only, after its own permission checks. */
export function createAdminClient() {
  if (!SECRET_KEY) throw new Error('SUPABASE_SECRET_KEY is not set');
  return createClient(SUPABASE_URL, SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}
