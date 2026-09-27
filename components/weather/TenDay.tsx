import type { WeatherDTO } from '@/lib/data/weather';
import { dayName } from '@/lib/format';
import { tempColor } from './Card';
import { WeatherIcon } from './WeatherIcon';

/** 10-day rows with the iOS temperature range bar; tap a day for its details and watch spots. */
export function TenDay({ days, currentTemp, onSelect }: { days: WeatherDTO['days']; currentTemp: number; onSelect: (i: number) => void }) {
  const lo = Math.min(...days.map((d) => d.tMin));
  const hi = Math.max(...days.map((d) => d.tMax));
  const at = (t: number) => `${((t - lo) / Math.max(1, hi - lo)) * 100}%`;
  const today = days[0]?.date ?? '';
  return (
    <ul>
      {days.map((d, i) => (
        <li key={d.date} className="border-b border-white/15 last:border-0">
          <button type="button" onClick={() => onSelect(i)} className="flex w-full items-center gap-2 py-2.5 text-left hover:bg-white/5">
            <span className="w-16 shrink-0 text-[16px] font-semibold">{dayName(d.date, today)}</span>
            <span className="flex w-11 shrink-0 flex-col items-center">
              <WeatherIcon code={d.code} size={24} />
              {d.rainProb >= 20 && <span className="text-[11px] font-semibold text-[#64D2FF]">{d.rainProb}%</span>}
            </span>
            <span className="w-9 shrink-0 text-right text-[16px] text-white/60">{Math.round(d.tMin)}°</span>
            <span className="relative mx-1 h-1.5 grow rounded-full bg-black/20">
              <span
                className="absolute inset-y-0 rounded-full"
                style={{ left: at(d.tMin), right: `calc(100% - ${at(d.tMax)})`, background: `linear-gradient(90deg, ${tempColor(d.tMin)}, ${tempColor(d.tMax)})` }}
              />
              {i === 0 && <span className="absolute top-1/2 size-2 -translate-1/2 rounded-full bg-white ring-2 ring-black/20" style={{ left: at(currentTemp) }} />}
            </span>
            <span className="w-9 shrink-0 text-[16px] font-semibold">{Math.round(d.tMax)}°</span>
            <span className="flex w-5 shrink-0 justify-center">
              {d.watch.length > 0 && <span title={`เฝ้าระวัง ${d.watch.length} จุด`} className="size-2.5 rounded-full bg-[#FF9F0A]" />}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
