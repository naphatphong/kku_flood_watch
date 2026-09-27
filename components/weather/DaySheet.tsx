'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { CloseIcon } from '@/components/ui/icons';
import { WATCH, zoneLevel } from '@/lib/config';
import type { WeatherDTO } from '@/lib/data/weather';
import { weatherInfo } from '@/lib/domain/weather';
import { dayLong, dayName } from '@/lib/format';
import { Alerts } from './Alerts';
import { Hourly } from './Hourly';
import { WeatherIcon } from './WeatherIcon';

const WatchMap = dynamic(() => import('./WatchMap'), { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-xl bg-white/10" /> });

/** One day in full: hours, alerts, rain and the watch spots its forecast rain would light up. */
export function DaySheet({ days, index, onSelect, onClose }: { days: WeatherDTO['days']; index: number; onSelect: (i: number) => void; onClose: () => void }) {
  const d = days[index];
  const today = days[0].date;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label={dayLong(d.date)}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-[28px] bg-[#1C1C1E]/95 p-4 pb-8 text-white shadow-2xl backdrop-blur-xl md:rounded-[28px]"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-bold">{dayLong(d.date)}</h2>
          <button type="button" aria-label="ปิด" onClick={onClose} className="grid size-8 place-items-center rounded-full bg-white/15">
            <CloseIcon size={13} />
          </button>
        </div>

        <div className="-mx-1 mt-3 flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none]">
          {days.map((x, i) => (
            <button
              key={x.date}
              type="button"
              aria-pressed={i === index}
              onClick={() => onSelect(i)}
              className="flex w-12 shrink-0 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[12px] aria-pressed:bg-white aria-pressed:text-black"
            >
              <span className="font-semibold">{dayName(x.date, today)}</span>
              <span>{x.date.slice(8)}</span>
              {x.watch.length > 0 && <span className="size-1.5 rounded-full bg-[#FF9F0A]" />}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-3">
          <WeatherIcon code={d.code} size={44} />
          <div>
            <p className="text-[20px] font-semibold">{weatherInfo(d.code).label}</p>
            <p className="text-[14px] text-white/70">
              สูงสุด {Math.round(d.tMax)}° · ต่ำสุด {Math.round(d.tMin)}° · ฝน {d.rainMm.toFixed(1)} มม. (โอกาส {d.rainProb}%)
            </p>
          </div>
        </div>
        {d.alerts.length > 0 && (
          <div className="mt-3">
            <Alerts alerts={d.alerts.map((a) => ({ ...a, day: '' }))} />
          </div>
        )}

        <div className="mt-4 rounded-2xl bg-white/8 p-3">
          <p className="mb-2 text-[12px] font-semibold text-white/60">รายชั่วโมง · โอกาสฝนและปริมาณฝน</p>
          <Hourly hours={d.hours} />
        </div>

        <div className="mt-4 rounded-2xl bg-white/8 p-3">
          <p className="text-[15px] font-semibold">จุดเฝ้าระวัง · {dayName(d.date, today)}</p>
          <p className="mb-2.5 text-[13px] text-white/65">
            {d.watch.length
              ? `ฝนที่คาดไว้ทำให้แอ่งพื้นที่ต่ำ ${d.watch.length} จุด เสี่ยงน้ำขัง`
              : `ฝนที่คาดไว้ยังไม่ถึงเกณฑ์เฝ้าระวัง (${WATCH.minPct}% ขึ้นไป)`}
          </p>
          <WatchMap watch={d.watch} />
          {d.watch.length > 0 && (
            <ul className="mt-2.5">
              {d.watch.map((w) => (
                <li key={w.id} className="flex items-center gap-2.5 border-b border-white/10 py-2 text-[14px] last:border-0">
                  <span className="size-2.5 rounded-full" style={{ background: zoneLevel(w.pct).color }} />
                  <span className="grow">{w.name ? `พื้นที่ต่ำใกล้ ${w.name}` : 'พื้นที่ต่ำ'}</span>
                  <span className="font-semibold">{w.pct}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
