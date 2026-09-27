import { weatherInfo } from '@/lib/domain/weather';

const SUN = '#FFD60A';
const CLOUD = '#F2F2F7';
const DROP = '#64D2FF';

const Sun = ({ x = 12, y = 12, r = 4.2 }) => (
  <g stroke={SUN} strokeWidth={1.8} strokeLinecap="round">
    <circle cx={x} cy={y} r={r} fill={SUN} stroke="none" />
    {Array.from({ length: 8 }, (_, i) => {
      const a = (i * Math.PI) / 4;
      return <line key={i} x1={x + Math.cos(a) * (r + 2)} y1={y + Math.sin(a) * (r + 2)} x2={x + Math.cos(a) * (r + 4)} y2={y + Math.sin(a) * (r + 4)} />;
    })}
  </g>
);
const Moon = ({ x = 12, y = 11 }) => <path d={`M${x + 3} ${y - 6}a6.5 6.5 0 1 0 5 9a5 5 0 0 1-5-9z`} fill="#E5E5EA" />;
const Cloud = ({ dy = 0, fill = CLOUD }) => (
  <path transform={`translate(0 ${dy})`} d="M7 18h10.5a3.8 3.8 0 0 0 .4-7.6A5.6 5.6 0 0 0 7.2 9.6 4.2 4.2 0 0 0 7 18z" fill={fill} />
);
const Drops = ({ n, color = DROP }: { n: number; color?: string }) => (
  <g stroke={color} strokeWidth={1.8} strokeLinecap="round">
    {Array.from({ length: n }, (_, i) => {
      const x = 8.5 + (i * 7) / Math.max(1, n - 1);
      return <line key={i} x1={x} y1={19.5} x2={x - 1.2} y2={22.5} />;
    })}
  </g>
);

/** Weather symbol for a WMO code, in the colors of the iOS Weather app. */
export function WeatherIcon({ code, isDay = true, size = 28 }: { code: number; isDay?: boolean; size?: number }) {
  const { kind, label } = weatherInfo(code);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={label} className="shrink-0">
      {kind === 'clear' && (isDay ? <Sun /> : <Moon />)}
      {kind === 'partly' && (
        <>
          {isDay ? <Sun x={9} y={8.5} r={3.4} /> : <Moon x={8} y={8} />}
          <Cloud dy={2} />
        </>
      )}
      {kind === 'cloudy' && <Cloud />}
      {kind === 'fog' && (
        <>
          <Cloud dy={-2} />
          <g stroke={CLOUD} strokeWidth={1.6} strokeLinecap="round">
            <line x1={5} y1={19} x2={19} y2={19} />
            <line x1={7} y1={22} x2={17} y2={22} />
          </g>
        </>
      )}
      {(kind === 'drizzle' || kind === 'rain' || kind === 'heavy') && (
        <>
          <Cloud dy={-3} />
          <Drops n={kind === 'drizzle' ? 2 : kind === 'rain' ? 3 : 4} />
        </>
      )}
      {kind === 'storm' && (
        <>
          <Cloud dy={-3} fill="#D1D1D6" />
          <path d="M12.5 15.5l-2.6 4h2.4l-1.3 3.5 3.9-5h-2.5l1.4-2.5z" fill={SUN} />
        </>
      )}
    </svg>
  );
}
