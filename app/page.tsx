'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState } from 'react';
import { ROAD_STATUS, VEHICLES, zoneLevel, type Vehicle } from '@/lib/config';
import { rain, zones } from '@/lib/mock';

const FloodMap = dynamic(() => import('@/components/FloodMap'), { ssr: false });

const ranked = [...zones].sort((a, b) => b.final - a.final);
const maxHourly = Math.max(...rain.hourly, 1);

function Ring({ pct, color }: { pct: number; color: string }) {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <circle cx="16" cy="16" r="12" fill="none" stroke={color} strokeOpacity={0.2} strokeWidth="5" />
      <circle
        cx="16" cy="16" r="12" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
        pathLength={100} strokeDasharray={`${pct} 100`} transform="rotate(-90 16 16)"
      />
    </svg>
  );
}

export default function Home() {
  const [vehicle, setVehicle] = useState<Vehicle>('motorcycle');
  const [selected, setSelected] = useState<string | null>(null);
  const zone = zones.find((z) => z.id === selected);
  const level = zone && zoneLevel(zone.final);

  return (
    <main className="relative h-dvh overflow-hidden">
      <FloodMap vehicle={vehicle} selected={selected} onSelect={setSelected} />

      <aside className="glass absolute inset-x-2 bottom-2 flex max-h-[55dvh] flex-col gap-3.5 overflow-y-auto rounded-[32px] p-4 md:inset-x-auto md:top-4 md:bottom-4 md:left-4 md:max-h-none md:w-[360px] md:rounded-[22px]">
        <header className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-[11px] bg-accent">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 3c3 4 6 7.5 6 11a6 6 0 01-12 0c0-3.5 3-7 6-11z" />
              <path d="M9 15a3 3 0 003 3" />
            </svg>
          </span>
          <div>
            <h1 className="text-[19px] font-bold tracking-tight">น้ำท่วมรอบ มข.</h1>
            <p className="text-[13px] text-secondary">ข้อมูลจากชุมชน · อัปเดต {rain.at}</p>
          </div>
        </header>

        <Link href="/navigate" className="flex h-10 shrink-0 items-center gap-2 rounded-xl bg-fill px-3 text-[15px] text-secondary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
          ค้นหาปลายทางเพื่อนำทางหลบน้ำ
        </Link>

        <div role="group" aria-label="ประเภทรถ" className="flex shrink-0 rounded-[10px] bg-fill p-0.5">
          {VEHICLES.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={vehicle === v.id}
              onClick={() => setVehicle(v.id)}
              className="h-10 flex-1 rounded-lg text-[13px] aria-pressed:bg-white aria-pressed:font-semibold aria-pressed:shadow-sm md:h-8"
            >
              {v.label}
            </button>
          ))}
        </div>
        <ul aria-label="สีถนน" className="-mt-1.5 flex flex-wrap gap-x-3 gap-y-1 px-1 text-xs text-[#3A3A3C]">
          {Object.values(ROAD_STATUS).map((s) => (
            <li key={s.label} className="flex items-center gap-1.5">
              <span className="h-[5px] w-4 rounded-full" style={{ background: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>

        {zone && level && (
          <section aria-label={`รายละเอียด${zone.name}`} className="rounded-2xl bg-white/80 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-bold">{zone.name}</h2>
              <button type="button" aria-label="ปิด" onClick={() => setSelected(null)} className="grid size-7 place-items-center rounded-full bg-fill">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#6E6E73" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M2 2l8 8M10 2l-8 8" />
                </svg>
              </button>
            </div>
            <div className="mt-1 flex items-center gap-2.5">
              <span className="text-[40px] leading-none font-bold tracking-tight" style={{ color: level.text }}>{zone.final}%</span>
              <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ color: level.text, background: `${level.color}1F` }}>
                {level.label}
              </span>
            </div>
            <dl className="mt-3 space-y-1.5 text-[13px]">
              {[
                ['ฝน + พื้นที่ต่ำ (base)', `${zone.base}%`],
                ['จากโพสต์ (report)', zone.c ? `${zone.report}%` : '—'],
                ['น้ำหนักโพสต์ (c)', zone.c.toFixed(2)],
                ['โพสต์ที่นับ', `${zone.posts}`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <dt className="text-secondary">{k}</dt>
                  <dd className="font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <section aria-label="ฝน" className="rounded-2xl bg-white/80 p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-[13px] font-semibold text-secondary">
            <span className="flex items-center gap-1.5">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M7 15a4 4 0 01-.5-8 5.5 5.5 0 0110.6 1.5A3.5 3.5 0 0117 15z" />
                <path d="M9 18l-1 2M13 18l-1 2M17 18l-1 2" />
              </svg>
              ฝน · Open-Meteo
            </span>
            <span className="text-xs font-normal">{rain.at}</span>
          </div>
          <div className="mt-2 flex items-end justify-between">
            <div>
              <p className="text-[34px] leading-none font-bold tracking-tight">
                {rain.r3}
                <span className="text-base font-medium tracking-normal text-secondary"> มม.</span>
              </p>
              <p className="mt-1 text-[13px] text-secondary">สะสม 3 ชั่วโมง</p>
            </div>
            <div role="img" aria-label="ฝนรายชั่วโมง 12 ชั่วโมงล่าสุด" className="flex h-11 items-end gap-[3px]">
              {rain.hourly.map((mm, i) => (
                <span
                  key={i}
                  className="w-1.5 rounded-full"
                  style={{ height: Math.max(4, (mm / maxHourly) * 44), background: i >= rain.hourly.length - 3 ? '#007AFF' : '#9CC8FF' }}
                />
              ))}
            </div>
          </div>
          <div className="mt-2.5 flex gap-2">
            {[
              ['24 ชั่วโมง', `${rain.r24} มม.`],
              ['ตกติดกัน', `${rain.rainyDays} วัน`],
              ['คาด 3 ชม.', `${rain.forecast3h} มม.`],
            ].map(([k, v]) => (
              <div key={k} className="flex-1 rounded-[10px] bg-fill/70 px-2.5 py-2">
                <p className="text-xs text-secondary">{k}</p>
                <p className="text-[15px] font-semibold">{v}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-1.5 px-1 text-[13px] font-semibold text-secondary">โซนเรียงตามความเสี่ยง</h2>
          <ul className="rounded-2xl bg-white/80 px-3 shadow-sm">
            {ranked.map((z) => {
              const l = zoneLevel(z.final);
              return (
                <li key={z.id} className="border-b border-black/[0.08] last:border-0">
                  <button
                    type="button"
                    onClick={() => setSelected(z.id)}
                    aria-current={z.id === selected || undefined}
                    className="flex h-[54px] w-full items-center gap-3 text-left"
                  >
                    <Ring pct={z.final} color={l.color} />
                    <span className="grow">
                      <span className="block text-[15px] font-semibold">{z.name}</span>
                      <span className="block text-xs text-secondary">
                        {l.label} · {z.posts} โพสต์
                      </span>
                    </span>
                    <span className="text-[17px] font-bold" style={{ color: l.text }}>{z.final}%</span>
                    <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="#C7C7CC" strokeWidth="2" strokeLinecap="round" aria-hidden>
                      <path d="M1 1l6 6-6 6" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="sticky bottom-0 -mx-4 -mb-4 mt-auto flex shrink-0 gap-2.5 bg-[#FAFAFC]/95 p-4 pt-3 backdrop-blur-xl">
          <Link href="/navigate" className="flex h-11 flex-1 items-center justify-center rounded-full bg-accent/12 text-[15px] font-semibold text-link">
            นำทางหลบน้ำ
          </Link>
          <Link href="/report" className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-accent text-[15px] font-semibold text-white">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
            รายงานน้ำท่วม
          </Link>
        </div>
      </aside>
    </main>
  );
}
