'use client';

import { useState } from 'react';
import { ROAD_STATUS, TRAFFIC } from '@/lib/config';
import type { Route, RouteKind } from '@/lib/domain/route';
import { distance, duration } from '@/lib/format';

const KIND: Record<RouteKind, string> = { safest: 'ปลอดภัยสุด', balanced: 'สมดุล', shortest: 'สั้นสุด' };
const title = (r: Route) =>
  r.kinds.includes('safest') && r.kinds.includes('shortest') ? 'ปลอดภัยและสั้นสุด' : KIND[r.kinds[0]];

function Exposure({ route }: { route: Route }) {
  if (!route.hard && !route.blocked)
    return <span className="text-[13px] font-medium text-[#248A3D]">ไม่ผ่านจุดที่รายงานว่าท่วม</span>;
  return (
    <span className="flex flex-wrap gap-1.5 text-[12px] font-semibold">
      {route.blocked > 0 && (
        <span className="rounded-full px-2 py-0.5" style={{ color: '#D70015', background: `${ROAD_STATUS.blocked.color}1F` }}>
          ผ่านไม่ได้ {route.blocked} ท่อน
        </span>
      )}
      {route.hard > 0 && (
        <span className="rounded-full px-2 py-0.5" style={{ color: '#8A6100', background: `${ROAD_STATUS.hard.color}29` }}>
          ผ่านยาก {route.hard} ท่อน
        </span>
      )}
    </span>
  );
}

/** Route choices (PLAN §6). A route through a "blocked" road needs a confirmation first. */
export function RouteCards({ routes, selected, onSelect }: { routes: Route[]; selected: number; onSelect: (i: number) => void }) {
  const [confirming, setConfirming] = useState<number | null>(null);
  return (
    <ul className="flex flex-col gap-2">
      {routes.map((r, i) => {
        const spots = r.spots.filter((s) => s.status === 'blocked').map((s) => s.name ?? 'ถนนไม่มีชื่อ');
        return (
          <li key={r.kinds.join()}>
            <button
              type="button"
              aria-pressed={i === selected}
              onClick={() => (r.blocked && i !== selected ? setConfirming(i) : onSelect(i))}
              className="flex w-full flex-col gap-1.5 rounded-2xl bg-white/70 p-3.5 text-left ring-1 ring-separator transition-shadow aria-pressed:ring-2 aria-pressed:ring-accent"
            >
              <span className="flex items-baseline gap-2">
                <span className="grow text-[15px] font-semibold">{title(r)}</span>
                {r.delayS !== null && r.delayS >= TRAFFIC.delayChipMinutes * 60 && (
                  <span className="rounded-full bg-[#FF9F0A]/15 px-2 py-0.5 text-[12px] font-semibold text-[#C93400]">
                    รถติด +{duration(r.delayS)}
                  </span>
                )}
                <span className="text-[17px] font-bold tracking-tight">{duration(r.durationS)}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="grow">
                  <Exposure route={r} />
                </span>
                <span className="shrink-0 text-[13px] text-secondary">{distance(r.distanceM)}</span>
              </span>
              {spots.length > 0 && (
                <span className="text-[12px] text-secondary">ผ่านจุดที่ผ่านไม่ได้: {[...new Set(spots)].join(', ')}</span>
              )}
            </button>
            {confirming === i && (
              <div role="alertdialog" aria-label="ยืนยันเส้นทาง" className="mt-1.5 rounded-2xl bg-[#FDECEA] p-3 text-[13px] text-[#8A0010]">
                เส้นทางนี้ผ่านจุดที่มีรายงานว่ารถประเภทนี้ผ่านไม่ได้ {r.blocked} ท่อน อาจติดน้ำหรือต้องกลับรถ
                <span className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirming(null);
                      onSelect(i);
                    }}
                    className="rounded-full bg-danger px-3.5 py-1.5 font-semibold text-white"
                  >
                    ใช้เส้นทางนี้
                  </button>
                  <button type="button" onClick={() => setConfirming(null)} className="rounded-full bg-white/80 px-3.5 py-1.5 font-semibold">
                    ยกเลิก
                  </button>
                </span>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
