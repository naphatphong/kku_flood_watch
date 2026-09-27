import { SITE } from './config';

const rtf = new Intl.RelativeTimeFormat('th', { numeric: 'auto' });

/** "15 นาทีที่แล้ว" */
export function timeAgo(iso: string, now = Date.now()): string {
  const sec = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(sec);
  if (abs < 60) return 'เมื่อสักครู่';
  if (abs < 3600) return rtf.format(Math.round(sec / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(sec / 3600), 'hour');
  return rtf.format(Math.round(sec / 86_400), 'day');
}

/** "14:05" in Thai time. */
export const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: SITE.timeZone });

export const pct = (x: number) => `${Math.round(x)}%`;

/** "850 ม." / "3.2 กม." */
export const distance = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} ม.` : `${(m / 1000).toFixed(1)} กม.`);

/** "12 นาที" / "1 ชม. 5 นาที" */
export function duration(s: number) {
  const min = Math.max(1, Math.round(s / 60));
  return min < 60 ? `${min} นาที` : `${Math.floor(min / 60)} ชม.${min % 60 ? ` ${min % 60} นาที` : ''}`;
}

// Fixed names: Node and browsers ship different Thai ICU data ("อังคาร" vs "อ."), which breaks hydration.
const WEEKDAY = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const WEEKDAY_LONG = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const MONTH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const utc = (date: string) => new Date(`${date}T00:00:00Z`);

/** "วันนี้" / "พรุ่งนี้" / "พ." for a local "YYYY-MM-DD". */
export const dayName = (date: string, today: string) =>
  date === today ? 'วันนี้' : utc(date).getTime() - utc(today).getTime() === 86_400_000 ? 'พรุ่งนี้' : WEEKDAY[utc(date).getUTCDay()];

/** "วันอังคารที่ 29 กันยายน" */
export const dayLong = (date: string) => {
  const d = utc(date);
  return `วัน${WEEKDAY_LONG[d.getUTCDay()]}ที่ ${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}`;
};
