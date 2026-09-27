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
