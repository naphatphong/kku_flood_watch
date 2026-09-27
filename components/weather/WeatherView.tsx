'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronIcon, ClockIcon } from '@/components/ui/icons';
import type { WeatherDTO } from '@/lib/data/weather';
import { weatherInfo } from '@/lib/domain/weather';
import { dayName } from '@/lib/format';
import { Alerts } from './Alerts';
import { Card } from './Card';
import { DaySheet } from './DaySheet';
import { Hourly } from './Hourly';
import { TenDay } from './TenDay';
import { Tiles } from './Tiles';
import { WeatherIcon } from './WeatherIcon';

/** Sky behind the page, from the current weather (like the iOS Weather app). */
function sky(code: number, isDay: boolean) {
  const kind = weatherInfo(code).kind;
  if (!isDay) return 'linear-gradient(180deg,#0B1D3A 0%,#23386B 100%)';
  if (kind === 'storm' || kind === 'heavy' || kind === 'rain' || kind === 'drizzle') return 'linear-gradient(180deg,#4B5B6E 0%,#7E8FA3 100%)';
  if (kind === 'cloudy' || kind === 'fog') return 'linear-gradient(180deg,#5F7488 0%,#9DB0C2 100%)';
  return 'linear-gradient(180deg,#2F80ED 0%,#6CC3F5 100%)';
}

export function WeatherView({ data }: { data: WeatherDTO }) {
  const [day, setDay] = useState<number | null>(null);
  const { current: c, next24, days } = data;
  const today = days[0];
  const wettest = next24.reduce((a, b) => (b.rainProb > a.rainProb ? b : a), next24[0]);
  const alerts = days.slice(0, 3).flatMap((d) => d.alerts.map((a) => ({ ...a, day: dayName(d.date, today.date) })));
  const watchDays = days.filter((d) => d.watch.length).length;

  return (
    <main className="min-h-dvh text-white" style={{ background: sky(c.code, c.isDay) }}>
      <div className="mx-auto flex max-w-xl flex-col gap-3 px-4 pt-4 pb-16">
        <header className="flex items-center">
          <Link href="/" aria-label="กลับไปที่แผนที่" className="grid size-9 place-items-center rounded-full bg-white/15 backdrop-blur-xl">
            <ChevronIcon size={16} className="rotate-180" />
          </Link>
        </header>

        <section className="py-4 text-center [text-shadow:0_1px_8px_rgb(0_0_0/0.15)]">
          <p className="text-[26px] font-medium">รอบ มข.</p>
          <p className="text-[92px] leading-none font-extralight">{Math.round(c.temp)}°</p>
          <p className="mt-1 text-[19px] font-medium">{weatherInfo(c.code).label}</p>
          <p className="text-[17px] font-medium">
            สูงสุด {Math.round(today.tMax)}° ต่ำสุด {Math.round(today.tMin)}°
          </p>
        </section>

        {alerts.length > 0 && (
          <Card title="คำเตือนสภาพอากาศ · 3 วัน">
            <Alerts alerts={alerts} />
          </Card>
        )}

        <Card title="พยากรณ์รายชั่วโมง · โอกาสฝน 24 ชม." icon={<ClockIcon size={13} />}>
          <p className="mb-3 text-[14px] leading-snug">
            {wettest.rainProb >= 40
              ? `ฝนมีโอกาสตกมากที่สุดช่วง ${wettest.time.slice(11, 16)} น. (${wettest.rainProb}%) ลมกระโชกตอนนี้ ${Math.round(c.gustKmh)} กม./ชม.`
              : `24 ชม. ข้างหน้าโอกาสฝนไม่เกิน ${wettest.rainProb}% ลมกระโชกตอนนี้ ${Math.round(c.gustKmh)} กม./ชม.`}
          </p>
          <Hourly hours={next24} nowLabel />
        </Card>

        <Card title="พยากรณ์ 10 วัน · กดวันเพื่อดูจุดเฝ้าระวัง">
          <TenDay days={days} currentTemp={c.temp} onSelect={setDay} />
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-white/70">
            <span className="size-2 rounded-full bg-[#FF9F0A]" />
            {watchDays ? `มีจุดเฝ้าระวัง ${watchDays} วัน จากฝนที่คาดไว้` : 'ฝนที่คาดไว้ 10 วันยังไม่ถึงเกณฑ์เฝ้าระวัง'}
          </p>
        </Card>

        <Tiles current={c} days={days} />

        <p className="mt-2 text-center text-[12px] text-white/60">
          ข้อมูลพยากรณ์ Open-Meteo · ณ {c.at.slice(11)} น. ·{' '}
          <Link href="/about" className="underline">
            วิธีคำนวณจุดเฝ้าระวัง
          </Link>
        </p>
      </div>
      {day !== null && <DaySheet days={days} index={day} onSelect={setDay} onClose={() => setDay(null)} />}
    </main>
  );
}
