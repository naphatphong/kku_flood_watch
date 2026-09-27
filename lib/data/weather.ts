import 'server-only';
import { MAP, SITE, WEATHER } from '../config';
import { forecastDays, type Day, type DayInput, type Hour } from '../domain/weather';
import { watchFor } from './map';
import type { WatchDTO } from './types';

export interface WeatherDTO {
  current: {
    at: string;
    temp: number;
    feelsLike: number;
    humidity: number;
    code: number;
    isDay: boolean;
    windKmh: number;
    gustKmh: number;
    windDir: number;
    precipMm: number;
  };
  next24: Hour[];
  days: (Day & { watch: WatchDTO[] })[]; // today first; watch circles from that day's forecast rain
}

const HOURLY = 'temperature_2m,precipitation_probability,precipitation,weather_code,is_day,wind_speed_10m,wind_gusts_10m';
const DAILY =
  'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max,sunrise,sunset';
const CURRENT = 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation';

/** 10-day forecast at the area center (Open-Meteo, free, no key); past week included for wet-day streaks. */
export async function getWeather(): Promise<WeatherDTO> {
  const [lng, lat] = MAP.center;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&timezone=${encodeURIComponent(SITE.timeZone)}` +
    `&past_days=7&forecast_days=${WEATHER.days}&current=${CURRENT}&hourly=${HOURLY}&daily=${DAILY}`;
  const res = await fetch(url, { next: { revalidate: WEATHER.cacheMinutes * 60 } });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const { current: c, hourly: h, daily: d } = await res.json();

  const hours: Hour[] = h.time.map((time: string, i: number) => ({
    time,
    temp: h.temperature_2m[i],
    rainProb: h.precipitation_probability[i] ?? 0,
    rainMm: h.precipitation[i] ?? 0,
    code: h.weather_code[i],
    isDay: h.is_day[i] === 1,
    windKmh: h.wind_speed_10m[i],
    gustKmh: h.wind_gusts_10m[i],
  }));
  const days: DayInput[] = d.time.map((date: string, i: number) => ({
    date,
    code: d.weather_code[i],
    tMin: d.temperature_2m_min[i],
    tMax: d.temperature_2m_max[i],
    rainMm: d.precipitation_sum[i] ?? 0,
    rainProb: d.precipitation_probability_max[i] ?? 0,
    windMax: d.wind_speed_10m_max[i],
    gustMax: d.wind_gusts_10m_max[i],
    uvMax: d.uv_index_max[i] ?? 0,
    sunrise: d.sunrise[i],
    sunset: d.sunset[i],
    hours: hours.filter((x) => x.time.startsWith(date)),
  }));

  const now = hours.findLastIndex((x) => x.time <= c.time);
  return {
    current: {
      at: c.time,
      temp: c.temperature_2m,
      feelsLike: c.apparent_temperature,
      humidity: c.relative_humidity_2m,
      code: c.weather_code,
      isDay: c.is_day === 1,
      windKmh: c.wind_speed_10m,
      gustKmh: c.wind_gusts_10m,
      windDir: c.wind_direction_10m,
      precipMm: c.precipitation,
    },
    next24: hours.slice(Math.max(0, now), Math.max(0, now) + 24),
    days: forecastDays(days, c.time.slice(0, 10)).map((day) => ({ ...day, watch: watchFor(day.rainScore) })),
  };
}
