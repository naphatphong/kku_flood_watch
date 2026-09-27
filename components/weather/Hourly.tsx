import type { Hour } from '@/lib/domain/weather';
import { WeatherIcon } from './WeatherIcon';

/** Horizontal hour strip: time, symbol, chance of rain, rain amount and temperature. */
export function Hourly({ hours, nowLabel = false }: { hours: Hour[]; nowLabel?: boolean }) {
  const maxMm = Math.max(1, ...hours.map((h) => h.rainMm));
  return (
    <div className="-mx-1 flex overflow-x-auto pb-1 [scrollbar-width:none]">
      {hours.map((h, i) => (
        <div key={h.time} className="flex w-[52px] shrink-0 flex-col items-center gap-1 text-center">
          <span className="text-[13px] text-secondary">{nowLabel && i === 0 ? 'ตอนนี้' : `${h.time.slice(11, 13)} น.`}</span>
          <WeatherIcon code={h.code} isDay={h.isDay} size={26} />
          <span className={`text-[12px] font-semibold ${h.rainProb >= 30 ? 'text-accent' : 'text-tertiary'}`}>{h.rainProb}%</span>
          <span className="flex h-6 items-end" title={`${h.rainMm} มม.`}>
            <span className="w-2 rounded-full bg-accent/60" style={{ height: h.rainMm ? Math.max(3, (h.rainMm / maxMm) * 24) : 0 }} />
          </span>
          <span className="text-[16px] font-semibold">{Math.round(h.temp)}°</span>
        </div>
      ))}
    </div>
  );
}
