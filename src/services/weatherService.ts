import type { LatLng } from '@/types';

/**
 * Prompt 41 — weather for the map header and route "best time to visit".
 *
 * Defaults to Open-Meteo, which needs no key. If VITE_OPENWEATHER_API_KEY is
 * set, OpenWeatherMap is used instead.
 */

export interface CurrentWeather {
  temperatureC: number;
  description: string;
  code: number;
  isDay: boolean;
}

export interface DailyForecast {
  date: string;
  maxC: number;
  minC: number;
  code: number;
  description: string;
  precipitationChance: number | null;
}

export interface WeatherReport {
  current: CurrentWeather;
  daily: DailyForecast[];
  source: 'open-meteo' | 'openweathermap';
}

/** WMO weather codes as used by Open-Meteo. */
const WMO: Record<number, string> = {
  0: 'Clear',
  1: 'Mostly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Freezing fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  56: 'Freezing drizzle',
  57: 'Freezing drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Light showers',
  81: 'Showers',
  82: 'Heavy showers',
  85: 'Snow showers',
  86: 'Snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Thunderstorm with hail',
};

export const describeCode = (code: number) => WMO[code] ?? 'Unknown';

const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY?.trim();

export async function fetchWeather(at: LatLng): Promise<WeatherReport> {
  if (apiKey) return fetchOpenWeather(at, apiKey);
  return fetchOpenMeteo(at);
}

async function fetchOpenMeteo(at: LatLng): Promise<WeatherReport> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${at.latitude}&longitude=${at.longitude}` +
    '&current=temperature_2m,weather_code,is_day' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
    '&forecast_days=7&timezone=auto';

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Weather request failed (${response.status})`);
  const json = (await response.json()) as {
    current: { temperature_2m: number; weather_code: number; is_day: number };
    daily: {
      time: string[];
      weather_code: number[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      precipitation_probability_max: (number | null)[];
    };
  };

  return {
    source: 'open-meteo',
    current: {
      temperatureC: Math.round(json.current.temperature_2m),
      code: json.current.weather_code,
      description: describeCode(json.current.weather_code),
      isDay: json.current.is_day === 1,
    },
    daily: json.daily.time.map((date, i) => ({
      date,
      maxC: Math.round(json.daily.temperature_2m_max[i]),
      minC: Math.round(json.daily.temperature_2m_min[i]),
      code: json.daily.weather_code[i],
      description: describeCode(json.daily.weather_code[i]),
      precipitationChance: json.daily.precipitation_probability_max[i],
    })),
  };
}

async function fetchOpenWeather(at: LatLng, key: string): Promise<WeatherReport> {
  const url =
    `https://api.openweathermap.org/data/2.5/forecast?lat=${at.latitude}&lon=${at.longitude}` +
    `&units=metric&appid=${key}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Weather request failed (${response.status})`);
  const json = (await response.json()) as {
    list: Array<{
      dt_txt: string;
      main: { temp: number; temp_max: number; temp_min: number };
      weather: Array<{ id: number; description: string }>;
      pop?: number;
    }>;
  };

  const first = json.list[0];
  const byDay = new Map<string, typeof json.list>();
  for (const row of json.list) {
    const day = row.dt_txt.slice(0, 10);
    const list = byDay.get(day) ?? [];
    list.push(row);
    byDay.set(day, list);
  }

  return {
    source: 'openweathermap',
    current: {
      temperatureC: Math.round(first.main.temp),
      code: first.weather[0]?.id ?? 0,
      description: first.weather[0]?.description ?? 'Unknown',
      isDay: true,
    },
    daily: [...byDay.entries()].slice(0, 7).map(([date, rows]) => ({
      date,
      maxC: Math.round(Math.max(...rows.map((r) => r.main.temp_max))),
      minC: Math.round(Math.min(...rows.map((r) => r.main.temp_min))),
      code: rows[0].weather[0]?.id ?? 0,
      description: rows[0].weather[0]?.description ?? 'Unknown',
      precipitationChance: Math.round(Math.max(...rows.map((r) => r.pop ?? 0)) * 100),
    })),
  };
}

/** "Best time to visit" line on a route detail (prompt 41). */
export function bestTimeToVisit(report: WeatherReport | null): string | null {
  if (!report || report.daily.length === 0) return null;
  const best = [...report.daily]
    .slice(0, 3)
    .sort((a, b) => (a.precipitationChance ?? 100) - (b.precipitationChance ?? 100))[0];
  if (!best) return null;

  const when = new Date(best.date).toLocaleDateString(undefined, { weekday: 'long' });
  const dry = (best.precipitationChance ?? 100) < 30;
  return dry
    ? `Best time to visit: ${when} — ${best.description.toLowerCase()}, ${best.maxC}°C`
    : `Rain likely all week. Wettest-free window: ${when}, ${best.maxC}°C`;
}
