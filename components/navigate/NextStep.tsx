import type { RouteStep } from '@/lib/domain/route';
import { distance, duration } from '@/lib/format';

/** Floating card while navigating: the next maneuver and what's left. */
export function NextStep({ step, inM, leftM, leftS }: { step: RouteStep; inM: number; leftM: number; leftS: number }) {
  return (
    <div role="status" className="glass absolute inset-x-2 top-2 z-10 rounded-[22px] px-4 py-3 md:left-[400px] md:right-auto md:top-4 md:w-[380px]">
      <p className="text-[13px] font-semibold text-accent">{step.distanceM === 0 ? 'ใกล้ถึงแล้ว' : `อีก ${distance(inM)}`}</p>
      <p className="text-[19px] leading-snug font-bold tracking-tight">{step.text}</p>
      <p className="mt-0.5 text-[13px] text-secondary">
        เหลือ {distance(leftM)} · ประมาณ {duration(leftS)}
      </p>
    </div>
  );
}
