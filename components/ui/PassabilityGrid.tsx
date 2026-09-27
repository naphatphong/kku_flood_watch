import { VEHICLES, type Passability, type Vehicle } from '@/lib/config';
import { PASSABILITY_COLORS } from './colors';

/** Read-only passability per vehicle. */
export function PassabilityGrid({ value }: { value: Partial<Record<Vehicle, Passability>> }) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {VEHICLES.map((v) => {
        const s = value[v.id];
        return (
          <div key={v.id} className="rounded-lg bg-fill/60 px-2 py-1.5 text-xs">
            <p className="text-secondary">{v.short}</p>
            <p className="font-semibold" style={{ color: s ? PASSABILITY_COLORS[s].text : undefined }}>
              {s ? PASSABILITY_COLORS[s].label : '—'}
            </p>
          </div>
        );
      })}
    </div>
  );
}
