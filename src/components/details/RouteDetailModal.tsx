import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Footprints, Heart, MapPin, Navigation, Ruler, Timer } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { AnchorButton, Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { AccessibilityIcons, SafeImage, SafetyScore } from '@/components/ui/Shared';
import { routeDirectionsUrl } from '@/lib/geo';
import { routeTypeLabel } from '@/lib/format';
import { routePath } from '@/services/routeService';
import { hasEnoughReports } from '@/services/feedbackService';
import { bestTimeToVisit, fetchWeather, type WeatherReport } from '@/services/weatherService';
import type { DiscoveryRoute } from '@/types';
import { ExampleBadge } from '@/components/ui/ExampleBadge';

interface Props {
  route: DiscoveryRoute;
  onClose: () => void;
}

/** Prompt 34 — full route sheet: stops, accessibility, and a way to start walking. */
export function RouteDetailModal({ route, onClose }: Props) {
  const navigate = useNavigate();
  const user = useAppStore((s) => s.user);
  const isSaved = useAppStore((s) => s.isSaved);
  const toggleSaved = useAppStore((s) => s.toggleSaved);
  const setMapCenter = useAppStore((s) => s.setMapCenter);
  const safety = useAppStore((s) => s.data?.safety);
  const markJourney = useAppStore((s) => s.markJourney);
  const toast = useToast();

  const [savingSave, setSavingSave] = useState(false);
  const [weather, setWeather] = useState<WeatherReport | null>(null);

  const saved = isSaved('route', route.id);
  const summary = safety?.get(route.id);
  const stops = [...route.stops].sort((a, b) => a.order - b.order);

  useEffect(() => {
    let live = true;
    fetchWeather(route.start_location)
      .then((report) => live && setWeather(report))
      .catch(() => null);
    return () => {
      live = false;
    };
  }, [route.start_location]);

  const tone = route.type === 'safe' ? 'teal' : route.type === 'exploration' ? 'pink' : 'warning';

  async function handleSave() {
    if (!user) {
      toast.show('Sign in to save routes.', 'info', {
        label: 'Log in',
        onClick: () => window.location.assign('/login'),
      });
      return;
    }
    setSavingSave(true);
    try {
      const nowSaved = await toggleSaved('route', route.id);
      toast.success(nowSaved ? 'Route saved.' : 'Route removed from your saved list.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save that route.');
    } finally {
      setSavingSave(false);
    }
  }

  const tip = bestTimeToVisit(weather);

  return (
    <Modal
      open
      onClose={onClose}
      title={route.title}
      footer={
        <>
          <Button
            variant="primary"
            icon={<Footprints size={15} />}
            onClick={() => {
              void markJourney('explored');
              navigate(`/route/${route.id}`);
              onClose();
            }}
          >
            Start route
          </Button>
          <Button
            variant={saved ? 'secondary' : 'text'}
            onClick={handleSave}
            loading={savingSave}
            icon={<Heart size={15} fill={saved ? 'currentColor' : 'none'} />}
          >
            {saved ? 'Saved' : 'Save route'}
          </Button>
          <AnchorButton
            href={routeDirectionsUrl(routePath(route))}
            variant="ghost"
            icon={<Navigation size={15} />}
          >
            Open in maps
          </AnchorButton>
        </>
      }
    >
      <div className="stack">
        <div className="row">
          <Badge tone={tone}>{routeTypeLabel(route.type)}</Badge>
          <ExampleBadge show={route.is_example} />
          {route.accessibility.includes('wheelchair') ? (
            <Badge tone="success">Step-free</Badge>
          ) : null}
        </div>

        {route.description ? <p>{route.description}</p> : null}

        <div className="stat-row">
          <div className="stat">
            <span className="stat__value">
              <Ruler size={15} aria-hidden="true" /> {route.distance_km} km
            </span>
            <span className="stat__label">Distance</span>
          </div>
          <div className="stat">
            <span className="stat__value">
              <Timer size={15} aria-hidden="true" /> {route.estimated_time_minutes} min
            </span>
            <span className="stat__label">Typical time</span>
          </div>
          <div className="stat">
            <span className="stat__value">
              <MapPin size={15} aria-hidden="true" /> {stops.length}
            </span>
            <span className="stat__label">Stops</span>
          </div>
        </div>

        {tip ? <p className="small muted" style={{ margin: 0 }}>{tip}</p> : null}

        {route.accessibility.length > 0 ? (
          <div>
            <h4 style={{ marginBottom: '0.35rem' }}>Along the way</h4>
            <AccessibilityIcons tags={route.accessibility} />
          </div>
        ) : null}

        {hasEnoughReports(summary) && summary ? (
          <div>
            <h4 style={{ marginBottom: '0.35rem' }}>How this route feels</h4>
            <SafetyScore summary={summary} />
          </div>
        ) : null}

        <div>
          <h4 style={{ marginBottom: '0.35rem' }}>Stops</h4>
          <ol className="stop-list">
            {stops.map((stop) => (
              <li key={stop.order} className="stop">
                <span className="stop__num" aria-hidden="true">
                  {stop.order}
                </span>
                {stop.image_url ? (
                  <SafeImage src={stop.image_url} alt="" className="stop__img" />
                ) : null}
                <span className="grow">
                  <button
                    className="link-btn"
                    style={{ fontWeight: 600, fontSize: '0.95rem' }}
                    onClick={() => {
                      setMapCenter(stop.location, 17);
                      onClose();
                    }}
                  >
                    {stop.title}
                  </button>
                  <span className="small muted" style={{ display: 'block' }}>
                    {stop.note}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Modal>
  );
}
