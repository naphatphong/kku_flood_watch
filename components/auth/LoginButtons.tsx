'use client';

import { useState } from 'react';
import { AUTH_PROVIDERS } from '@/lib/config';
import { createClient } from '@/lib/supabase/browser';

const PROVIDERS: Record<string, { label: string; className: string; logo: React.ReactNode }> = {
  google: {
    label: 'ดำเนินการต่อด้วย Google',
    className: 'bg-white text-label ring-1 ring-black/10 hover:bg-[#F7F7F8]',
    logo: (
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
    ),
  },
  'custom:line': {
    label: 'ดำเนินการต่อด้วย LINE',
    className: 'bg-[#06C755] text-white hover:bg-[#05B34C]',
    logo: <span className="rounded-md bg-white px-1 text-[11px] font-black text-[#06C755]">LINE</span>,
  },
};

export function LoginButtons({ next }: { next: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);

  async function signIn(provider: string) {
    setBusy(provider);
    setError(false);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: provider as `custom:${string}`,
      options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setBusy(null);
      setError(true);
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      {AUTH_PROVIDERS.filter((p) => PROVIDERS[p]).map((p) => (
        <button
          key={p}
          type="button"
          disabled={busy !== null}
          onClick={() => signIn(p)}
          className={`flex h-12 items-center justify-center gap-2.5 rounded-full text-[15px] font-semibold transition-colors disabled:opacity-60 ${PROVIDERS[p].className}`}
        >
          {PROVIDERS[p].logo}
          {busy === p ? 'กำลังไปหน้าเข้าสู่ระบบ…' : PROVIDERS[p].label}
        </button>
      ))}
      {error && (
        <p role="alert" className="text-center text-[13px] text-danger">
          เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง
        </p>
      )}
    </div>
  );
}
