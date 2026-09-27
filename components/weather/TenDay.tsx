import type { WeatherDTO } from '@/lib/data/weather';
import { dayName } from '@/lib/format';
import { tempColor } from './Card';
import { WeatherIcon } from './WeatherIcon';

/** 10-day rows with a temperature range bar; tap a day for its details and watch spots. */
export function TenDay({ days, currentTemp, onSelect }: { days: WeatherDTO['days']; currentTemp: number; onSelect: (i: number) => void }) {
  const lo = Math.min(...days.map((d) => d.tMin));
  const hi = Math.max(...days.map((d) => d.tMax));
  const at = (t: number) => `${((t - lo) / Math.max(1, hi - lo)) * 100}%`;
  const today = days[0]?.date ?? '';
  return (
    <ul>
      {days.map((d, i) => (
        <li key={d.date} className="border-b border-separator last:border-0">
          <button type="button" onClick={() => onSelect(i)} className="flex w-full items-center gap-2 rounded-lg py-2.5 text-left hover:bg-fill/60">
            <span className="w-16 shrink-0 text-[15px] font-semibold">{dayName(d.date, today)}</span>
            <span className="flex w-11 shrink-0 flex-col items-center">
              <WeatherIcon code={d.code} size={24} />
              {d.rainProb >= 20 && <span className="text-[11px] font-semibold text-accent">{d.rainProb}%</span>}
            </span>
            <span className="w-9 shrink-0 text-right text-[15px] text-secondary">{Math.round(d.tMin)}°</span>
            <span className="relative mx-1 h-1.5 grow rounded-full bg-fill">
              <span
                className="absolute inset-y-0 rounded-full"
                style={{ left: at(d.tMin), right: `calc(100% - ${at(d.tMax)})`, background: `linear-gradient(90deg, ${tempColor(d.tMin)}, ${tempColor(d.tMax)})` }}
              />
              {i === 0 && <span className="absolute top-1/2 size-2.5 -translate-1/2 rounded-full bg-white shadow ring-2 ring-label/60" style={{ left: at(currentTemp) }} />}
            </span>
            <span className="w-9 shrink-0 text-[15px] font-semibold">{Math.round(d.tMax)}°</span>
            <span className="flex w-5 shrink-0 justify-center">
              {d.watch.length > 0 && <span title={`เฝ้าระวัง ${d.watch.length} จุด`} className="size-2.5 rounded-full bg-[#FF9F0A]" />}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
