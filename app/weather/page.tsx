import type { Metadata } from 'next';
import Link from 'next/link';
import { WeatherView } from '@/components/weather/WeatherView';
import { WEATHER } from '@/lib/config';
import { getWeather } from '@/lib/data/weather';

export const metadata: Metadata = {
  title: 'พยากรณ์อากาศ 10 วัน',
  description: 'พยากรณ์อากาศรอบ มข. รายชั่วโมงและ 10 วัน พร้อมคำเตือนและจุดเฝ้าระวังน้ำขังล่วงหน้า',
};
export const revalidate = 900; // = WEATHER.cacheMinutes; must be a literal for Next

export default async function WeatherPage() {
  const data = await getWeather().catch((e) => {
    console.error(e);
    return null;
  });
  if (!data)
    return (
      <main className="grid min-h-dvh place-items-center p-4 text-center">
        <p className="text-[15px] text-secondary">
          โหลดพยากรณ์อากาศไม่สำเร็จ ลองใหม่ในอีก {WEATHER.cacheMinutes} นาที ·{' '}
          <Link href="/" className="font-semibold text-link">
            กลับหน้าแผนที่
          </Link>
        </p>
      </main>
    );
  return <WeatherView data={data} />;
}
