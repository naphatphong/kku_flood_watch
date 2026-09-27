import type { ReactNode } from 'react';

/** Section card in the site's style: caption above, white card below. */
export function Card({ title, icon, children, className = '' }: { title: string; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      <h2 className="mb-1.5 flex items-center gap-1.5 px-1 text-[13px] font-semibold text-secondary">
        {icon}
        {title}
      </h2>
      <div className="rounded-2xl bg-card p-3.5 shadow-sm">{children}</div>
    </section>
  );
}

/** Temperature → color for the range bars (cool blue to hot red). */
export function tempColor(t: number) {
  const stops: [number, string][] = [[20, '#5AC8FA'], [24, '#30D158'], [28, '#FFD60A'], [32, '#FF9F0A'], [36, '#FF453A']];
  return (stops.find(([limit]) => t <= limit) ?? stops[stops.length - 1])[1];
}
