'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Vote = 'still' | 'receded' | null;

/** "Still flooded" / "Receded" votes: one per user, tap again to take it back. */
export function VoteButtons({
  id,
  still,
  receded,
  myVote,
  signedIn,
}: {
  id: number;
  still: number;
  receded: number;
  myVote: Vote;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [vote, setVote] = useState<Vote>(myVote);
  const [counts, setCounts] = useState({ still, receded });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!signedIn)
    return (
      <Link href={`/login?next=/post/${id}`} className="block rounded-2xl bg-fill px-4 py-3 text-center text-[14px] font-semibold text-link">
        เข้าสู่ระบบเพื่อโหวตว่ายังท่วมหรือลดแล้ว
      </Link>
    );

  async function cast(next: Exclude<Vote, null>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const undo = vote === next;
    const res = await fetch(`/api/reports/${id}/vote`, {
      method: undo ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: undo ? undefined : JSON.stringify({ vote: next }),
    });
    if (res.ok) {
      setCounts((c) => ({
        still: c.still + (next === 'still' ? (undo ? -1 : 1) : vote === 'still' ? -1 : 0),
        receded: c.receded + (next === 'receded' ? (undo ? -1 : 1) : vote === 'receded' ? -1 : 0),
      }));
      setVote(undo ? null : next);
      router.refresh();
    } else setError((await res.json().catch(() => ({}))).error ?? 'โหวตไม่สำเร็จ');
    setBusy(false);
  }

  const button = (kind: Exclude<Vote, null>, label: string, n: number) => (
    <button
      type="button"
      aria-pressed={vote === kind}
      disabled={busy}
      onClick={() => cast(kind)}
      className="h-12 flex-1 rounded-2xl bg-fill text-[15px] font-semibold transition-colors aria-pressed:bg-accent aria-pressed:text-white disabled:opacity-60"
    >
      {label} · {n}
    </button>
  );

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        {button('still', 'ยังท่วม', counts.still)}
        {button('receded', 'ลดแล้ว', counts.receded)}
      </div>
      {error && (
        <p role="alert" className="text-center text-[13px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
