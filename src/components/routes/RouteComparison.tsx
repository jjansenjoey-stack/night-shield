import { useMemo, useState } from 'react';
import { Accessibility, Clock, Footprints, Ruler } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { AccessibilityIcons } from '@/components/ui/Shared';
import { useSnappedRoutes } from '@/hooks/useSnappedRoutes';
import { routeTypeLabel } from '@/lib/format';
import type { DiscoveryRoute } from '@/types';

/**
 * Compare the walks side by side, at your own pace.
 *
 * Two things make a route walkable and they are not the same thing: how far it
 * is, and how long *you* need. A router's "45 minutes" assumes an unencumbered
 * adult at 5 km/h, which is no use to someone on crutches, pushing a buggy, or
 * stopping to rest. So distance is measured — along real footpaths, not
 * straight lines — and the time is recalculated from a pace you choose.
 *
 * Shortest and longest are labelled because that is the question people
 * actually arrive with: which of these can I manage tonight?
 */

interface Pace {
  id: string;
  label: string;
  kmh: number;
  /** Reads after the time, so 'With rests' does not become 'at with rests pace'. */
  phrase: string;
  note: string;
}

const PACES: Pace[] = [
  { id: 'brisk', label: 'Brisk', kmh: 5, phrase: 'at a brisk pace', note: 'Walking to be somewhere.' },
  { id: 'steady', label: 'Steady', kmh: 4, phrase: 'at a steady pace', note: 'An ordinary pace, no rush.' },
  { id: 'gentle', label: 'Gentle', kmh: 3, phrase: 'at a gentle pace', note: 'Slower going, or a lot of looking.' },
  { id: 'rests', label: 'With rests', kmh: 2, phrase: 'taking it slowly, with rests', note: 'Frequent stops, benches wanted.' },
];

function minutesFor(metres: number, kmh: number): number {
  return Math.max(1, Math.round((metres / 1000 / kmh) * 60));
}

function formatMinutes(total: number): string {
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
}

export function RouteComparison({ routes }: { routes: DiscoveryRoute[] }) {
  const [paceId, setPaceId] = useState('steady');
  const [stepFreeOnly, setStepFreeOnly] = useState(false);

  const pace = PACES.find((p) => p.id === paceId) ?? PACES[1];

  // Measured along the walking network, so the number matches the drawn line.
  const snapped = useSnappedRoutes(routes);

  const rows = useMemo(() => {
    const shown = stepFreeOnly
      ? routes.filter((r) => r.accessibility.includes('step_free'))
      : routes;

    return shown
      .map((route) => {
        const measured = snapped.get(route.id)?.distanceM ?? null;
        // Falls back to the stored figure until the router answers, so the
        // list is never empty and never jumps around while loading.
        const metres = measured ?? route.distance_km * 1000;
        return {
          route,
          metres,
          measured: measured !== null,
          minutes: minutesFor(metres, pace.kmh),
        };
      })
      .sort((a, b) => a.metres - b.metres);
  }, [routes, snapped, pace.kmh, stepFreeOnly]);

  if (routes.length === 0) return null;

  const shortestId = rows[0]?.route.id;
  const longestId = rows.length > 1 ? rows[rows.length - 1]?.route.id : undefined;

  return (
    <div className="stack stack--xs">
      <p className="small muted" style={{ margin: 0 }}>
        Distances are measured along the actual pavements, not in straight lines. Pick the pace
        that matches how you walk and the times change with it.
      </p>

      <div className="row row--wrap" style={{ gap: '0.35rem' }} role="group" aria-label="Walking pace">
        {PACES.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`chip${option.id === paceId ? ' is-active' : ''}`}
            aria-pressed={option.id === paceId}
            title={option.note}
            onClick={() => setPaceId(option.id)}
          >
            <Footprints size={13} aria-hidden="true" />
            {option.label}
            <span className="tiny" style={{ opacity: 0.75 }}>
              {option.kmh} km/h
            </span>
          </button>
        ))}
      </div>

      <div className="row row--wrap" style={{ gap: '0.35rem' }}>
        <button
          type="button"
          className={`chip${stepFreeOnly ? ' is-active' : ''}`}
          aria-pressed={stepFreeOnly}
          onClick={() => setStepFreeOnly((on) => !on)}
        >
          <Accessibility size={13} aria-hidden="true" />
          Step-free only
        </button>
      </div>

      <p className="tiny muted" style={{ margin: '0.1rem 0 0.4rem' }}>
        {pace.note}
      </p>

      {rows.length === 0 ? (
        <Card>
          <p className="small muted" style={{ margin: 0 }}>
            None of the walks are marked step-free yet. Turn the filter off to see them all.
          </p>
        </Card>
      ) : (
        <ul className="route-compare" aria-label="Walks, shortest first">
          {rows.map(({ route, metres, minutes, measured }) => (
            <li key={route.id}>
              <Card className="route-compare__row">
                <div className="row row--between row--wrap" style={{ gap: 'var(--xs)' }}>
                  <div className="grow">
                    <div className="row row--wrap" style={{ gap: '0.35rem', marginBottom: '0.3rem' }}>
                      <Badge tone={route.type === 'safe' ? 'teal' : 'pink'}>
                        {routeTypeLabel(route.type)}
                      </Badge>
                      {route.id === shortestId ? <Badge tone="success">Shortest</Badge> : null}
                      {route.id === longestId ? <Badge tone="warning">Longest</Badge> : null}
                    </div>

                    <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.02rem' }}>
                      <Link to={`/route/${route.id}`}>{route.title}</Link>
                    </h3>

                    <p className="small muted" style={{ margin: 0 }}>
                      <Ruler size={13} aria-hidden="true" /> {(metres / 1000).toFixed(1)} km
                      {'  ·  '}
                      <Clock size={13} aria-hidden="true" /> {formatMinutes(minutes)} {pace.phrase}
                      {measured ? '' : ' (estimated)'}
                    </p>
                  </div>
                </div>

                <AccessibilityIcons tags={route.accessibility} />
              </Card>
            </li>
          ))}
        </ul>
      )}

      <p className="tiny muted" style={{ margin: 0 }}>
        Times cover walking only. They do not include stopping to look at anything, which on an
        art walk is most of the point.
      </p>
    </div>
  );
}
