'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

const OPEN = Symbol('open');
const SWIPE_PX = 40; // a drag at least this long moves one step
// Closed: only the handle strip stays above the bottom edge (and the iPhone home bar).
const CLOSED_Y = 'calc(100% - 32px - env(safe-area-inset-bottom))';

/**
 * Glass panel: floating sidebar on desktop, bottom sheet on mobile.
 * On mobile the handle has three stops: closed (swiped down to the edge), peek and near full
 * height. Tap it to open or expand; drag it up or down to move one stop.
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
  scrollKey?: unknown; // scroll back to top (and reopen) when this changes (new selection)
  footer: ReactNode;
  children: ReactNode;
}) {
  const body = useRef<HTMLDivElement>(null);
  // Braces matter: newer browsers return a Promise from scrollTo, which React would call as cleanup.
  useEffect(() => {
    body.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [scrollKey]);

  // Closed for the current content only: a new selection opens the sheet again.
  const [closedFor, setClosedFor] = useState<unknown>(OPEN);
  const closed = closedFor === scrollKey;
  const [dragY, setDragY] = useState<number | null>(null);
  const start = useRef({ y: 0, moved: false });

  const release = (dy: number) => {
    setDragY(null);
    if (dy >= SWIPE_PX) {
      if (expanded) onToggle();
      else setClosedFor(scrollKey);
    } else if (dy <= -SWIPE_PX) {
      if (closed) setClosedFor(OPEN);
      else if (!expanded) onToggle();
    }
  };

  const translate =
    dragY === null ? undefined : closed ? `0 calc(${CLOSED_Y} + ${Math.min(dragY, 0)}px)` : `0 ${Math.max(dragY, -24)}px`;

  return (
    <aside
      style={{ translate }}
      className={`glass absolute inset-x-2 bottom-2 flex flex-col overflow-hidden rounded-[30px] ease-out md:inset-x-auto md:top-4 md:bottom-4 md:left-4 md:max-h-none md:w-[372px] md:rounded-[22px] ${
        expanded && !closed ? 'max-h-[86dvh]' : 'max-h-[46dvh]'
      } ${closed ? 'max-md:translate-y-[calc(100%_-_32px_-_env(safe-area-inset-bottom))]' : ''} ${
        dragY === null ? 'transition-[max-height,translate] duration-300' : ''
      }`}
    >
      <button
        type="button"
        onClick={() => {
          if (start.current.moved) return; // the drag already moved it
          if (closed) setClosedFor(OPEN);
          else onToggle();
        }}
        onPointerDown={(e) => {
          start.current = { y: e.clientY, moved: false };
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragY(0);
        }}
        onPointerMove={(e) => {
          if (dragY === null) return;
          const dy = e.clientY - start.current.y;
          if (Math.abs(dy) > 6) start.current.moved = true;
          setDragY(dy);
        }}
        onPointerUp={(e) => release(e.clientY - start.current.y)}
        onPointerCancel={() => setDragY(null)}
        aria-label={closed ? 'แสดงแผง' : expanded ? 'ย่อแผง' : 'ขยายแผง'}
        aria-expanded={!closed}
        className="flex h-7 w-full shrink-0 touch-none items-center justify-center md:hidden"
      >
        <span className="h-[5px] w-9 rounded-full bg-tertiary/70" />
      </button>
      <div
        ref={body}
        inert={closed}
        className={`flex min-h-0 grow flex-col gap-3.5 overflow-y-auto px-4 pb-4 transition-opacity md:pt-4 ${closed ? 'max-md:opacity-0' : ''}`}
      >
        {children}
      </div>
      <div
        inert={closed}
        className={`shrink-0 border-t border-separator bg-white/60 px-4 py-3 transition-opacity ${closed ? 'max-md:opacity-0' : ''}`}
      >
        {footer}
      </div>
    </aside>
  );
}
