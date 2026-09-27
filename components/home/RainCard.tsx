import { RainIcon } from '@/components/ui/icons';
import { clock } from '@/lib/format';
import type { RainDTO } from '@/lib/data/types';

export function RainCard({ rain }: { rain: RainDTO | null }) {
  if (!rain)
    return (
      <section aria-label="ฝน" className="rounded-2xl bg-card p-3.5 text-[13px] text-secondary shadow-sm">
        ยังไม่มีข้อมูลฝน
      </section>
    );
  const max = Math.max(...rain.hourly, 1);
  return (
    <section aria-label="ฝน" className="rounded-2xl bg-card p-3.5 shadow-sm">
      <div className="flex items-center justify-between text-[13px] font-semibold text-secondary">
        <span className="flex items-center gap-1.5">
          <RainIcon className="text-[#007AFF]" />
          ฝน · Open-Meteo
        </span>
        <span className="text-xs font-normal">{clock(rain.at)}</span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
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
              style={{
                height: Math.max(4, (mm / max) * 44),
                background: i >= rain.hourly.length - 3 ? '#007AFF' : '#9CC8FF',
              }}
            />
          ))}
        </div>
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-2">
        {[
          ['24 ชั่วโมง', `${rain.r24} มม.`],
          ['ตกติดกัน', `${rain.rainyDays} วัน`],
          ['คาด 3 ชม.', `${rain.forecast3h} มม.`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-[10px] bg-fill/70 px-2.5 py-2">
            <p className="text-xs text-secondary">{k}</p>
            <p className="text-[15px] font-semibold">{v}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
