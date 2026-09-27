'use client';

import { useState } from 'react';

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = location.href;
    if (navigator.share) return navigator.share({ title, url }).catch(() => {});
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button type="button" onClick={share} className="text-[14px] font-semibold text-link">
      {copied ? 'คัดลอกลิงก์แล้ว' : 'แชร์'}
    </button>
  );
}
