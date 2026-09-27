import type { Alert } from '@/lib/domain/weather';

const ICON: Record<Alert['kind'], string> = { rain: '🌧️', storm: '⛈️', wind: '💨', heat: '🌡️' };

/** Weather warnings; severe ones in red. */
export function Alerts({ alerts }: { alerts: (Alert & { day: string })[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {alerts.map((a, i) => (
        <li
          key={i}
          className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-[14px] ${a.severe ? 'bg-[#FDECEA] text-[#8A0010]' : 'bg-[#FFF1CC] text-[#7A5200]'}`}
        >
          <span aria-hidden>{ICON[a.kind]}</span>
          <span className="grow font-semibold">{a.text}</span>
          {a.day && <span className="shrink-0 text-[13px] opacity-75">{a.day}</span>}
        </li>
      ))}
    </ul>
  );
}
