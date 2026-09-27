'use client';

import { PASSABILITY_COLORS } from '@/components/ui/colors';
import { VEHICLES, type Passability, type Vehicle } from '@/lib/config';

const OPTIONS = Object.entries(PASSABILITY_COLORS) as [Passability, (typeof PASSABILITY_COLORS)[Passability]][];

/** One row per vehicle: ok / hard / blocked, tap again to clear. */
export function PassabilityPicker({
  value,
  onChange,
}: {
  value: Partial<Record<Vehicle, Passability>>;
  onChange: (v: Partial<Record<Vehicle, Passability>>) => void;
}) {
  const set = (vehicle: Vehicle, s: Passability) => {
    const next = { ...value };
    if (next[vehicle] === s) delete next[vehicle];
    else next[vehicle] = s;
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl bg-card p-2 shadow-sm">
      {VEHICLES.map((v) => (
        <div key={v.id} role="group" aria-label={v.label} className="flex items-center gap-2">
          <span className="w-20 shrink-0 pl-1.5 text-[14px]">{v.label}</span>
          <div className="flex grow gap-1">
            {OPTIONS.map(([s, c]) => (
              <button
                key={s}
                type="button"
                aria-pressed={value[v.id] === s}
                onClick={() => set(v.id, s)}
                style={value[v.id] === s ? { background: `${c.text}1A`, color: c.text } : undefined}
                className="h-9 flex-1 rounded-lg bg-fill/70 text-[13px] aria-pressed:font-semibold"
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
