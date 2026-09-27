'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { DropIcon } from '@/components/ui/icons';

/** Any page that throws lands here: a way back, plus the technical detail for bug reports. */
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <div className="glass w-full max-w-[380px] rounded-[28px] p-7 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent text-white">
          <DropIcon size={30} />
        </span>
        <h1 className="mt-4 text-[20px] font-bold tracking-tight">หน้านี้โหลดไม่สำเร็จ</h1>
        <p className="mt-1.5 text-[14px] text-secondary">ลองใหม่อีกครั้ง หรือกลับไปหน้าแผนที่</p>
        <div className="mt-5 flex gap-2.5">
          <button type="button" onClick={reset} className="h-11 flex-1 rounded-full bg-accent text-[15px] font-semibold text-white">
            ลองใหม่
          </button>
          <Link href="/" className="grid h-11 flex-1 place-items-center rounded-full bg-fill text-[15px] font-semibold">
            กลับหน้าแผนที่
          </Link>
        </div>
        {/* Shown so a screenshot is enough to report the bug. */}
        <p className="mt-5 text-left font-mono text-[11px] break-words text-tertiary">
          {error.digest ? `server error ${error.digest}` : `${error.name}: ${error.message}`}
        </p>
      </div>
    </main>
  );
}
