import type { RouteStep } from '@/lib/domain/route';
import { distance } from '@/lib/format';

/** Text directions; the step in progress is highlighted while navigating. */
export function StepList({ steps, current }: { steps: RouteStep[]; current: number | null }) {
  return (
    <details className="rounded-2xl bg-white/70 ring-1 ring-separator" open={current !== null}>
      <summary className="cursor-pointer list-none px-3.5 py-3 text-[14px] font-semibold [&::-webkit-details-marker]:hidden">
        รายการเลี้ยว · {steps.length - 1} จุด
      </summary>
      <ol className="border-t border-separator px-1.5 py-1.5">
        {steps.map((s, i) => (
          <li
            key={i}
            aria-current={i === current ? 'step' : undefined}
            className="flex items-baseline gap-2.5 rounded-xl px-2 py-1.5 text-[14px] aria-[current=step]:bg-accent/10 aria-[current=step]:font-semibold"
          >
            <span className="w-5 shrink-0 text-right text-[12px] text-tertiary">{i + 1}</span>
            <span className="grow">{s.text}</span>
            {s.distanceM > 0 && <span className="shrink-0 text-[12px] text-secondary">{distance(s.distanceM)}</span>}
          </li>
        ))}
      </ol>
    </details>
  );
}
