'use client';

import type { ReactNode } from 'react';

/** Toggle chip (aria-pressed). */
export function Chip({
  pressed,
  onClick,
  children,
  tone,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
  tone?: string; // accent color when pressed
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      style={pressed && tone ? { background: `${tone}22`, color: tone, borderColor: `${tone}66` } : undefined}
      className="min-h-10 rounded-full border border-transparent bg-fill px-3.5 text-[14px] transition-colors aria-pressed:border-accent/40 aria-pressed:bg-accent/12 aria-pressed:font-semibold aria-pressed:text-link"
    >
      {children}
    </button>
  );
}
