import { HomeView } from '@/components/home/HomeView';
import { getViewer } from '@/lib/auth';
import { getWeather } from '@/lib/data/weather';
import { dayName } from '@/lib/format';

export default async function Home() {
  const [viewer, weather] = await Promise.all([getViewer(), getWeather().catch(() => null)]);
  // First weather warning for today or tomorrow (the forecast is cached for 15 minutes).
  const today = weather?.days[0]?.date ?? '';
  const warning = weather?.days.slice(0, 2).flatMap((d) => d.alerts.map((a) => `${dayName(d.date, today)} · ${a.text}`))[0] ?? null;
  return <HomeView viewer={viewer} warning={warning} />;
}
