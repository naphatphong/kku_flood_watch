// Forecast summaries, alerts and per-day watch inputs (weather page). Data: Open-Meteo, WMO codes.
import { SCORE, WEATHER } from '../config';
import { rainScore } from './rain';

export interface Hour {
  time: string; // local "YYYY-MM-DDTHH:mm"
  temp: number;
  rainProb: number; // %
  rainMm: number;
  code: number;
  isDay: boolean;
  windKmh: number;
  gustKmh: number;
}

export interface DayInput {
  date: string; // local "YYYY-MM-DD"
  code: number;
  tMin: number;
  tMax: number;
  rainMm: number;
  rainProb: number;
  windMax: number;
  gustMax: number;
  uvMax: number;
  sunrise: string;
  sunset: string;
  hours: Hour[];
}

export interface Alert {
  kind: 'rain' | 'storm' | 'wind' | 'heat';
  severe: boolean;
  text: string;
}

export interface Day extends DayInput {
  alerts: Alert[];
  rainScore: number; // PLAN §5 step 1, from this day's forecast rain
}

/** WMO weather code → icon kind and Thai label. */
export function weatherInfo(code: number): { kind: 'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'heavy' | 'storm'; label: string } {
  if (code === 0) return { kind: 'clear', label: 'ท้องฟ้าแจ่มใส' };
  if (code === 1 || code === 2) return { kind: 'partly', label: code === 1 ? 'มีเมฆเล็กน้อย' : 'มีเมฆบางส่วน' };
  if (code === 3) return { kind: 'cloudy', label: 'เมฆมาก' };
  if (code === 45 || code === 48) return { kind: 'fog', label: 'หมอก' };
  if (code >= 51 && code <= 57) return { kind: 'drizzle', label: 'ฝนปรอย' };
  if (code === 61 || code === 80) return { kind: 'rain', label: code === 80 ? 'ฝนตกเป็นช่วง ๆ' : 'ฝนเล็กน้อย' };
  if (code === 63 || code === 66 || code === 81) return { kind: 'rain', label: 'ฝนปานกลาง' };
  if (code === 65 || code === 67 || code === 82) return { kind: 'heavy', label: 'ฝนตกหนัก' };
  if (code >= 95) return { kind: 'storm', label: code === 95 ? 'พายุฝนฟ้าคะนอง' : 'พายุฝนฟ้าคะนอง มีลูกเห็บ' };
  return { kind: 'cloudy', label: 'มีเมฆ' };
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/** Alerts for one day (thresholds in WEATHER.alerts). */
export function dayAlerts(d: Pick<DayInput, 'code' | 'rainMm' | 'gustMax' | 'tMax'>): Alert[] {
  const a = WEATHER.alerts;
  const out: Alert[] = [];
  if (d.rainMm >= a.heavyRainMm)
    out.push({ kind: 'rain', severe: d.rainMm > a.veryHeavyRainMm, text: `${d.rainMm > a.veryHeavyRainMm ? 'ฝนตกหนักมาก' : 'ฝนตกหนัก'} ${round1(d.rainMm)} มม.` });
  if (d.code >= 95) out.push({ kind: 'storm', severe: d.code > 95, text: weatherInfo(d.code).label });
  if (d.gustMax >= a.gustKmh)
    out.push({ kind: 'wind', severe: d.gustMax >= a.strongGustKmh, text: `ลมกระโชกแรง ${Math.round(d.gustMax)} กม./ชม.` });
  if (d.tMax >= a.heatC) out.push({ kind: 'heat', severe: false, text: `อากาศร้อนจัด ${Math.round(d.tMax)}°` });
  return out;
}

/**
 * Days from `today` on, each with alerts and a rain score for watch circles: r3 = wettest
 * 3 hours of the day, r24 = the day's total, rainy days = wet days (observed or forecast) just before it.
 */
export function forecastDays(days: DayInput[], today: string): Day[] {
  const start = days.findIndex((d) => d.date === today);
  return days.slice(Math.max(0, start), Math.max(0, start) + WEATHER.days).map((d) => {
    const i = days.indexOf(d);
    let rainyDays = 0;
    for (let k = i - 1; k >= 0 && days[k].rainMm >= SCORE.rain.rainyDayMm; k--) rainyDays++;
    const mm = d.hours.map((h) => h.rainMm);
    const r3 = Math.max(0, ...mm.map((_, h) => mm.slice(h, h + 3).reduce((s, x) => s + x, 0)));
    return { ...d, alerts: dayAlerts(d), rainScore: rainScore({ r3, r24: d.rainMm, rainyDays }) };
  });
}
