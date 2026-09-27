import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from './env';

/** Client for the browser (auth, realtime). Only call when isSupabaseConfigured. */
export const createClient = () => createBrowserClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);
