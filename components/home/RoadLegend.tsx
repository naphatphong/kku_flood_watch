import { ROAD_STATUS } from '@/lib/config';

export function RoadLegend() {
  return (
    <ul aria-label="สีถนน" className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-xs text-[#3A3A3C]">
      {Object.values(ROAD_STATUS).map((s) => (
        <li key={s.label} className="flex items-center gap-1.5">
          <span className="h-[5px] w-4 rounded-full" style={{ background: s.color }} />
          {s.label}
        </li>
      ))}
    </ul>
  );
}
