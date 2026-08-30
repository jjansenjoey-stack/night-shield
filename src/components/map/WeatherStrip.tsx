import { useEffect, useState } from 'react';
import { CloudSun } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { fetchWeather, type WeatherReport } from '@/services/weatherService';

let cached: { at: number; report: WeatherReport } | null = null;
const TTL = 30 * 60 * 1000;

/** Prompt 41 — small current-conditions readout in the header on the map tab. */
export function WeatherStrip() {
  const mapCenter = useAppStore((s) => s.mapCenter);
  const userLocation = useAppStore((s) => s.userLocation);
  const [report, setReport] = useState<WeatherReport | null>(cached?.report ?? null);

  useEffect(() => {
    if (cached && Date.now() - cached.at < TTL) {
      setReport(cached.report);
      return;
    }
    let live = true;
    fetchWeather(userLocation ?? mapCenter)
      .then((result) => {
        cached = { at: Date.now(), report: result };
        if (live) setReport(result);
      })
      .catch(() => {
        /* weather is a nicety — never block the map on it */
      });
    return () => {
      live = false;
    };
    // Deliberately not re-fetching on every pan; the cache TTL governs refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!report) return null;

  return (
    <span className="row tiny muted" style={{ gap: '0.3rem', flexWrap: 'nowrap' }}>
      <CloudSun size={14} aria-hidden="true" />
      <span>
        {report.current.description}, {report.current.temperatureC}°C
      </span>
    </span>
  );
}
