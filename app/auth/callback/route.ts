import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/** OAuth redirect target: trade the code for a session, then continue to `next`. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = safeNext(url.searchParams.get('next'));
  if (code) {
    const { error } = await (await createClient()).auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL('/login?error=1', url.origin));
}

/** Only same-site paths, never an open redirect. */
const safeNext = (next: string | null) => (next?.startsWith('/') && !next.startsWith('//') ? next : '/');
