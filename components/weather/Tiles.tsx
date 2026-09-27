import type { ReactNode } from 'react';
import type { WeatherDTO } from '@/lib/data/weather';

const uvLevel = (uv: number) => (uv < 3 ? 'ต่ำ' : uv < 6 ? 'ปานกลาง' : uv < 8 ? 'สูง' : uv < 11 ? 'สูงมาก' : 'อันตราย');

function Tile({ title, value, note, children }: { title: string; value: ReactNode; note?: string; children?: ReactNode }) {
  return (
    <section className="flex min-h-36 flex-col rounded-2xl bg-card p-3.5 shadow-sm">
      <h3 className="text-[13px] font-semibold text-secondary">{title}</h3>
      <p className="mt-1 text-[28px] leading-tight font-bold tracking-tight">{value}</p>
      <div className="grow">{children}</div>
      {note && <p className="text-[13px] leading-snug text-secondary">{note}</p>}
    </section>
  );
}

/** Detail tiles: UV, wind, humidity, feels like, sun, rain. */
export function Tiles({ current: c, days }: Pick<WeatherDTO, 'current' | 'days'>) {
  const [today, tomorrow] = days;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      <Tile title="ดัชนี UV" value={Math.round(today.uvMax)} note={uvLevel(today.uvMax)}>
        <div className="mt-2 h-1.5 rounded-full bg-[linear-gradient(90deg,#30D158,#FFD60A,#FF9F0A,#FF453A,#BF5AF2)]">
          <span className="block size-1.5 rounded-full bg-white ring-2 ring-label/60" style={{ marginLeft: `${Math.min(100, (today.uvMax / 11) * 100)}%` }} />
        </div>
      </Tile>
      <Tile title="ลม" value={<>{Math.round(c.windKmh)} <span className="text-[15px] font-medium text-secondary">กม./ชม.</span></>} note={`กระโชก ${Math.round(c.gustKmh)} กม./ชม.`}>
        <svg viewBox="0 0 24 24" className="mt-1 size-9" aria-label={`ลมมาจากทิศ ${c.windDir}°`}>
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeOpacity=".2" />
          <path d="M12 5l3 8h-6z" fill="#0071E3" transform={`rotate(${c.windDir + 180} 12 12)`} />
        </svg>
      </Tile>
      <Tile title="ความชื้น" value={`${c.humidity}%`} note={c.humidity >= 80 ? 'ชื้นมาก' : c.humidity >= 60 ? 'ค่อนข้างชื้น' : 'สบาย'} />
      <Tile title="รู้สึกเหมือน" value={`${Math.round(c.feelsLike)}°`} note={c.feelsLike > c.temp + 1 ? 'ความชื้นทำให้รู้สึกร้อนกว่าจริง' : 'ใกล้เคียงอุณหภูมิจริง'} />
      <Tile title="พระอาทิตย์" value={today.sunrise.slice(11)} note={`ตก ${today.sunset.slice(11)} น.`} />
      <Tile title="ปริมาณฝน" value={<>{today.rainMm.toFixed(1)} <span className="text-[15px] font-medium text-secondary">มม.</span></>} note={tomorrow ? `พรุ่งนี้ ${tomorrow.rainMm.toFixed(1)} มม.` : undefined} />
    </div>
  );
}
