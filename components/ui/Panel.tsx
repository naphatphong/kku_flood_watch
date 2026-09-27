'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Glass panel: floating sidebar on desktop, bottom sheet on mobile.
 * On mobile the handle toggles between a peek height and near full height.
 */
export function Panel({
  expanded,
  onToggle,
  scrollKey,
  footer,
  children,
}: {
  expanded: boolean;
  onToggle: () => void;
  scrollKey?: unknown; // scroll back to top when this changes (new selection)
  footer: ReactNode;
  children: ReactNode;
}) {
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => body.current?.scrollTo({ top: 0, behavior: 'smooth' }), [scrollKey]);

  return (
    <aside
      className={`glass absolute inset-x-2 bottom-2 flex flex-col overflow-hidden rounded-[30px] transition-[max-height] duration-300 ease-out md:inset-x-auto md:top-4 md:bottom-4 md:left-4 md:max-h-none md:w-[372px] md:rounded-[22px] ${
        expanded ? 'max-h-[86dvh]' : 'max-h-[46dvh]'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={expanded ? 'ย่อแผง' : 'ขยายแผง'}
        aria-expanded={expanded}
        className="flex h-6 w-full shrink-0 items-center justify-center md:hidden"
      >
        <span className="h-[5px] w-9 rounded-full bg-tertiary/70" />
      </button>
      <div ref={body} className="flex min-h-0 grow flex-col gap-3.5 overflow-y-auto px-4 pb-4 md:pt-4">
        {children}
      </div>
      <div className="shrink-0 border-t border-separator bg-white/60 px-4 py-3">{footer}</div>
    </aside>
  );
}
