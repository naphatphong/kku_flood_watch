import { NextResponse, type NextRequest } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase/env';
import { updateSession } from '@/lib/supabase/proxy';

export async function proxy(request: NextRequest) {
  return isSupabaseConfigured ? updateSession(request) : NextResponse.next();
}

export const config = {
  // Skip static assets and the public read API (no session needed there).
  matcher: ['/((?!_next/static|_next/image|icon.svg|favicon.ico|api/zones|api/segments|.*\\.(?:png|jpg|jpeg|gif|webp|svg)$).*)'],
};
