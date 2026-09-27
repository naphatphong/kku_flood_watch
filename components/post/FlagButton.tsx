'use client';

import { useState } from 'react';
import { FLAG_REASONS } from '@/lib/config';

export function FlagButton({ id, flagged }: { id: number; flagged: boolean }) {
  const [done, setDone] = useState(flagged);
  const [error, setError] = useState<string | null>(null);
  if (done) return <p className="text-[13px] text-secondary">คุณรีพอร์ตโพสต์นี้แล้ว ขอบคุณ</p>;

  async function send(reason: string) {
    const res = await fetch(`/api/reports/${id}/flag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (res.ok || res.status === 409) setDone(true);
    else setError((await res.json().catch(() => ({}))).error ?? 'รีพอร์ตไม่สำเร็จ');
  }

  return (
    <details className="text-[14px]">
      <summary className="cursor-pointer list-none text-secondary hover:text-danger [&::-webkit-details-marker]:hidden">
        รีพอร์ตโพสต์นี้
      </summary>
      <div className="mt-2 flex flex-wrap gap-2">
        {Object.entries(FLAG_REASONS).map(([value, label]) => (
          <button key={value} type="button" onClick={() => send(value)} className="rounded-full bg-fill px-3.5 py-2 hover:bg-fill-strong">
            {label}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
    </details>
  );
}
