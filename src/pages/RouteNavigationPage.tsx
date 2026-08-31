import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Marker } from 'react-map-gl/maplibre';
import { CheckCircle2, Flag, MapPin, Navigation, Timer, X } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useGeolocation } from '@/hooks/useGeolocation';
import { MapView } from '@/components/map/MapView';
import { Button, AnchorButton } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SafeImage } from '@/components/ui/Shared';
import { LoadingBlock } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { addPoints, getPoints, isoWeek } from '@/services/pointsService';
import { routeToMapItem } from '@/services/api';
import { directionsUrl, distanceKm, formatDistance, walkingMinutes } from '@/lib/geo';
import { routeTypeLabel } from '@/lib/format';

/** Prompt 40 — walking a route, one stop at a time. */
export function RouteNavigationPage() {
  const { routeId } = useParams<{ routeId: string }>();
  const navigate = useNavigate();
  const data = useAppStore((s) => s.data);
  const loading = useAppStore((s) => s.dataLoading);
  const user = useAppStore((s) => s.user);
  const markJourney = useAppStore((s) => s.markJourney);
  const toast = useToast();

  // A live watch here is worth the battery — the blue dot has to keep up.
  const { userLocation } = useGeolocation({ watch: true });
  const [index, setIndex] = useState(0);
  const [startedAt] = useState(() => Date.now());

  const route = data?.routes.find((r) => r.id === routeId) ?? null;
  const stops = useMemo(
    () => (route ? [...route.stops].sort((a, b) => a.order - b.order) : []),
    [route],
  );
  const current = stops[index] ?? null;
  const done = index >= stops.length;

  const toNext = current && userLocation ? distanceKm(userLocation, current.location) : null;

  const remainingMinutes = useMemo(() => {
    if (!route) return 0;
    const share = (stops.length - index) / Math.max(1, stops.length);
    return Math.max(1, Math.round(route.estimated_time_minutes * share));
  }, [route, stops.length, index]);

  /*
   * What this walk actually paid, measured rather than assumed.
   *
   * Both awards are idempotent, so a second walk of the same route earns only
   * the weekly token and a third in the same week earns nothing. Printing a
   * fixed "+12" would be a lie two times out of three, so take the difference
   * in the balance and show that.
   */
  const [earned, setEarned] = useState<number | null>(null);

  useEffect(() => {
    if (!done || !user) return;
    let cancelled = false;

    void (async () => {
      const before = await getPoints(user.id).catch(() => null);
      let after = before;

      // First time on this route: the full reward, once ever.
      const a = await addPoints(user.id, 'complete_route', route?.id ?? null).catch(() => null);
      if (a != null) after = a;

      /*
       * Art walks also pay a token amount for coming back, capped at one a
       * week. The changing route is different work every fortnight, so a
       * repeat walk is a real visit — but walking costs nothing, so this has
       * to stay small enough that it can never rival actually taking part.
       */
      if (route?.type === 'art_walk') {
        const b = await addPoints(user.id, 'walk_art_route', route.id, isoWeek()).catch(
          () => null,
        );
        if (b != null) after = b;
      }

      if (!cancelled && before != null && after != null) setEarned(after - before);
      void markJourney('explored');
    })();

    return () => {
      cancelled = true;
    };
  }, [done, user, route, markJourney]);

  if (loading && !data) return <LoadingBlock label="Loading route…" />;

  if (!route) {
    return (
      <div className="page">
        <EmptyState
          title="That route is not here"
          message="It may have been unpublished. Have a look at what else is on Explore."
          action={
            <Button variant="primary" onClick={() => navigate('/explore')}>
              Back to Explore
            </Button>
          }
        />
      </div>
    );
  }

  const items = current ? [{ ...routeToMapItem(route), distance: null }] : [];

  return (
    <div className="nav-page">
      <div className="nav-page__map">
        <MapView items={items} routesOverride={[route]} showUser>
          {current ? (
            <Marker
              latitude={current.location.latitude}
              longitude={current.location.longitude}
              anchor="bottom"
            >
              <MapPin size={34} color="var(--accent1)" fill="var(--accent1)" aria-hidden="true" />
            </Marker>
          ) : null}
        </MapView>

        <button
          className="map-fab"
          style={{ top: 12, right: 12 }}
          onClick={() => navigate('/explore')}
          aria-label="End route"
        >
          <X size={19} />
        </button>
      </div>

      <div className="nav-page__panel">
        <div className="row row--between">
          <div className="row" style={{ gap: '0.4rem' }}>
            <Badge tone={route.type === 'safe' ? 'teal' : 'pink'}>
              {routeTypeLabel(route.type)}
            </Badge>
            <span className="small muted">
              {done ? 'Finished' : `Stop ${index + 1} of ${stops.length}`}
            </span>
          </div>
          {!done ? (
            <span className="row tiny muted" style={{ gap: '0.25rem' }}>
              <Timer size={12} aria-hidden="true" />
              ~{remainingMinutes} min left
            </span>
          ) : null}
        </div>

        <div className="progress" role="img" aria-label={`${index} of ${stops.length} stops done`}>
          <div
            className="progress__fill"
            style={{ width: `${(index / Math.max(1, stops.length)) * 100}%` }}
          />
        </div>

        {done ? (
          <div className="center stack stack--xs" style={{ padding: '0.5rem 0' }}>
            <CheckCircle2 size={34} color="var(--success)" aria-hidden="true" />
            <h3 style={{ margin: 0 }}>Route complete</h3>
            <p className="small muted" style={{ margin: 0 }}>
              {route.distance_km} km in{' '}
              {Math.max(1, Math.round((Date.now() - startedAt) / 60000))} minutes
              {user && earned ? ` · +${earned} points` : ''}.
            </p>
            <div className="row" style={{ justifyContent: 'center' }}>
              <Button variant="primary" onClick={() => navigate('/explore')}>
                Back to Explore
              </Button>
              <Button
                variant="text"
                onClick={() => {
                  setIndex(0);
                  toast.show('Route restarted.');
                }}
              >
                Walk it again
              </Button>
            </div>
          </div>
        ) : current ? (
          <>
            <div className="next-stop">
              {current.image_url ? (
                <SafeImage src={current.image_url} alt="" className="next-stop__img" />
              ) : null}
              <div className="grow">
                <h3 style={{ fontSize: '1.05rem', marginBottom: '0.15rem' }}>{current.title}</h3>
                <p className="small muted" style={{ margin: 0 }}>
                  {current.note}
                </p>
                {toNext != null ? (
                  <p className="tiny" style={{ margin: '0.3rem 0 0', color: 'var(--accent2)' }}>
                    {formatDistance(toNext)} away · about {walkingMinutes(toNext)} min
                  </p>
                ) : (
                  <p className="tiny muted" style={{ margin: '0.3rem 0 0' }}>
                    Turn on location to see how far the next stop is.
                  </p>
                )}
              </div>
            </div>

            <div className="row">
              <Button
                variant="primary"
                icon={<Flag size={15} />}
                onClick={() => setIndex((i) => i + 1)}
              >
                {index === stops.length - 1 ? 'Finish route' : 'Arrived at stop'}
              </Button>
              <AnchorButton
                href={directionsUrl(current.location, userLocation)}
                variant="text"
                icon={<Navigation size={15} />}
              >
                Directions
              </AnchorButton>
              <Button variant="ghost" onClick={() => navigate('/explore')}>
                End route
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
