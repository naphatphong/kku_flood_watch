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

export function WeatherView({ data }: { data: WeatherDTO }) {
  const [day, setDay] = useState<number | null>(null);
  const { current: c, next24, days } = data;
  const today = days[0];
  const wettest = next24.reduce((a, b) => (b.rainProb > a.rainProb ? b : a), next24[0]);
  const alerts = days.slice(0, 3).flatMap((d) => d.alerts.map((a) => ({ ...a, day: dayName(d.date, today.date) })));
  const watchDays = days.filter((d) => d.watch.length).length;

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 p-4 pb-12">
      <header className="flex items-center gap-2">
        <Link href="/" aria-label="กลับไปที่แผนที่" className="grid size-9 shrink-0 place-items-center rounded-full bg-fill hover:bg-fill-strong">
          <ChevronIcon size={16} className="rotate-180" />
        </Link>
        <h1 className="grow text-[19px] font-bold tracking-tight">พยากรณ์อากาศรอบ มข.</h1>
        <span className="text-[12px] text-secondary">อัปเดต {c.at.slice(11)} น.</span>
      </header>

      <section className="flex items-center gap-4 rounded-3xl bg-card p-5 shadow-sm">
        <WeatherIcon code={c.code} isDay={c.isDay} size={64} />
        <div className="min-w-0 grow">
          <p className="text-[48px] leading-none font-bold tracking-tight">{Math.round(c.temp)}°</p>
          <p className="mt-1 text-[16px] font-semibold">{weatherInfo(c.code).label}</p>
          <p className="text-[14px] text-secondary">
            สูงสุด {Math.round(today.tMax)}° · ต่ำสุด {Math.round(today.tMin)}° · รู้สึกเหมือน {Math.round(c.feelsLike)}°
          </p>
        </div>
      </section>

      {alerts.length > 0 && (
        <Card title="คำเตือนสภาพอากาศ · 3 วัน">
          <Alerts alerts={alerts} />
        </Card>
      )}

      <Card title="รายชั่วโมง · โอกาสฝน 24 ชม." icon={<ClockIcon size={13} />}>
        <p className="mb-3 text-[14px] leading-snug">
          {wettest.rainProb >= 40
            ? `ฝนมีโอกาสตกมากที่สุดช่วง ${wettest.time.slice(11, 16)} น. (${wettest.rainProb}%) ลมกระโชกตอนนี้ ${Math.round(c.gustKmh)} กม./ชม.`
            : `24 ชม. ข้างหน้าโอกาสฝนไม่เกิน ${wettest.rainProb}% ลมกระโชกตอนนี้ ${Math.round(c.gustKmh)} กม./ชม.`}
        </p>
        <Hourly hours={next24} nowLabel />
      </Card>

      <Card title="10 วัน · กดวันเพื่อดูจุดเฝ้าระวัง">
        <TenDay days={days} currentTemp={c.temp} onSelect={setDay} />
        <p className="mt-2 flex items-center gap-1.5 text-[12px] text-secondary">
          <span className="size-2 rounded-full bg-[#FF9F0A]" />
          {watchDays ? `มีจุดเฝ้าระวัง ${watchDays} วัน จากฝนที่คาดไว้` : 'ฝนที่คาดไว้ 10 วันยังไม่ถึงเกณฑ์เฝ้าระวัง'}
        </p>
      </Card>

      <Tiles current={c} days={days} />

      <p className="text-center text-[12px] text-secondary">
        ข้อมูลพยากรณ์ Open-Meteo ·{' '}
        <Link href="/about" className="font-semibold text-link">
          วิธีคำนวณจุดเฝ้าระวัง
        </Link>
      </p>
      {day !== null && <DaySheet days={days} index={day} onSelect={setDay} onClose={() => setDay(null)} />}
    </main>
  );
}
