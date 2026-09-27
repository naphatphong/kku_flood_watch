import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from './env';

/** Anonymous client for public reads on the server (RLS: approved data only). */
export const createAnonClient = () =>
  createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
