'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const TONES = {
  primary: 'bg-accent text-white hover:bg-accent-hover',
  plain: 'bg-fill hover:bg-fill-strong',
  danger: 'bg-[#FDECEA] text-danger hover:bg-[#FAD9D6]',
};

/**
 * Admin action: POSTs {action} to `endpoint`, then reloads the page data.
 * With `confirm`, the first click asks and the second one acts.
 */
export function ActionButton({
  endpoint,
  action,
  label,
  tone = 'plain',
  confirm,
}: {
  endpoint: string;
  action: string;
  label: string;
  tone?: keyof typeof TONES;
  confirm?: string;
}) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (confirm && !asking) return setAsking(true);
    setBusy(true);
    setError(null);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (res.ok) router.refresh();
    else setError((await res.json().catch(() => ({}))).error ?? 'ทำรายการไม่สำเร็จ');
    setBusy(false);
    setAsking(false);
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <span className="inline-flex gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={run}
          className={`h-9 rounded-full px-3.5 text-[14px] font-semibold transition-colors disabled:opacity-50 ${asking ? TONES.danger : TONES[tone]}`}
        >
          {asking ? confirm : label}
        </button>
        {asking && (
          <button type="button" onClick={() => setAsking(false)} className="h-9 rounded-full px-3 text-[14px] text-secondary hover:bg-fill">
            ยกเลิก
          </button>
        )}
      </span>
      {error && <span className="text-[12px] text-danger">{error}</span>}
    </span>
  );
}
