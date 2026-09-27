import type { ReactNode } from 'react';

/** Frosted card on the sky background, with a small caption like the iOS Weather app. */
export function Card({ title, icon, children, className = '' }: { title: string; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl bg-white/12 p-3.5 ring-1 ring-white/10 backdrop-blur-xl ${className}`}>
      <h2 className="mb-2 flex items-center gap-1.5 border-b border-white/15 pb-2 text-[12px] font-semibold tracking-wide text-white/70">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Temperature → color for the range bars (cool blue to hot red). */
export function tempColor(t: number) {
  const stops: [number, string][] = [[20, '#5AC8FA'], [24, '#30D158'], [28, '#FFD60A'], [32, '#FF9F0A'], [36, '#FF453A']];
  return (stops.find(([limit]) => t <= limit) ?? stops[stops.length - 1])[1];
}
