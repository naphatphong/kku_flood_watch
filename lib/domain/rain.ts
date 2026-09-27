import { SCORE } from '../config';
import type { RainSummary } from './types';

/** Hourly precipitation as returned by Open-Meteo (`timezone=Asia/Bangkok`). */
export interface HourlyRain {
  times: string[]; // local "YYYY-MM-DDTHH:mm"; each value is the sum of the preceding hour
  precipitation: (number | null)[];
  utcOffsetSeconds: number;
}

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const round1 = (x: number) => Math.round(x * 10) / 10;

export function summarizeRain({ times, precipitation, utcOffsetSeconds }: HourlyRain, now: Date): RainSummary {
  const mm = precipitation.map((v) => v ?? 0);
  const epoch = times.map((t) => Date.parse(`${t}:00Z`) - utcOffsetSeconds * 1000);
  const i = epoch.findLastIndex((t) => t <= now.getTime());
  const past = (hours: number) => sum(mm.slice(Math.max(0, i - hours + 1), i + 1));

  // Consecutive rainy days (>= rainyDayMm) ending today, or yesterday if today is still dry so far.
  const byDay = new Map<string, number>();
  times.slice(0, i + 1).forEach((t, k) => byDay.set(t.slice(0, 10), (byDay.get(t.slice(0, 10)) ?? 0) + mm[k]));
  const days = [...byDay.values()];
  if (days.length && days.at(-1)! < SCORE.rain.rainyDayMm) days.pop();
  let rainyDays = 0;
  while (days.length && days.pop()! >= SCORE.rain.rainyDayMm) rainyDays++;

  return {
    at: new Date(epoch[i] ?? now.getTime()),
    r1: round1(past(1)),
    r3: round1(past(3)),
    r24: round1(past(24)),
    r72: round1(past(72)),
    rainyDays,
    forecast3h: round1(sum(mm.slice(i + 1, i + 4))),
    hourly: mm.slice(Math.max(0, i - 11), i + 1),
  };
}

/** Rain score 0..1 (PLAN §5 step 1). */
export function rainScore({ r3, r24, rainyDays }: Pick<RainSummary, 'r3' | 'r24' | 'rainyDays'>): number {
  const { r3: a, r24: b, rainyDays: d } = SCORE.rain;
  return (
    a.weight * Math.min(1, r3 / a.capMm) + b.weight * Math.min(1, r24 / b.capMm) + d.weight * Math.min(1, rainyDays / d.cap)
  );
}
