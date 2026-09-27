import 'server-only';
import { createClient } from './supabase/server';
import { isSupabaseConfigured } from './supabase/env';

export interface Viewer {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  banned: boolean;
  createdAt: string;
}

/** The signed-in visitor with their profile, or null (also null in demo mode). */
export async function getViewer(): Promise<Viewer | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await supabase
    .from('profiles')
    .select('display_name, avatar_url, role, banned, created_at')
    .eq('id', user.id)
    .maybeSingle();
  return {
    id: user.id,
    displayName: p?.display_name || user.email?.split('@')[0] || 'ผู้ใช้',
    avatarUrl: p?.avatar_url ?? null,
    isAdmin: p?.role === 'admin',
    banned: p?.banned ?? false,
    createdAt: p?.created_at ?? user.created_at,
  };
}
