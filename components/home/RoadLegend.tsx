import { ROAD_STATUS, TRAFFIC } from '@/lib/config';

const Swatch = ({ label, background }: { label: string; background: string }) => (
  <li className="flex items-center gap-1.5">
    <span className="h-[5px] w-4 rounded-full" style={{ background }} />
    {label}
  </li>
);

/** Road colors for floods, and (with a TomTom key) for traffic. */
export function RoadLegend() {
  return (
    <div className="flex flex-col gap-1 px-1 text-xs text-[#3A3A3C]">
      <ul aria-label="สีถนน" className="flex flex-wrap gap-x-3 gap-y-1">
        {Object.values(ROAD_STATUS).map((s) => (
          <Swatch key={s.label} label={s.label} background={s.color} />
        ))}
      </ul>
      {TRAFFIC.flowTiles && (
        <ul aria-label="สีจราจร" className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <li className="font-semibold">จราจร</li>
          {[...TRAFFIC.levels].reverse().map((l) => (
            <Swatch key={l.label} label={l.label} background={l.color} />
          ))}
          <Swatch
            label={TRAFFIC.closed.label}
            background={`repeating-linear-gradient(90deg,${TRAFFIC.closed.color} 0 4px,transparent 4px 7px)`}
          />
        </ul>
      )}
    </div>
  );
}
