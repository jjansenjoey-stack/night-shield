import { useEffect, useMemo, useRef, useState } from 'react';
import { Compass, Footprints, Ruler, ShieldCheck, Timer } from 'lucide-react';
import { useAppStore, loadOnboardingPreference } from '@/store/appStore';
import { ClickableCard } from '@/components/ui/Card';
import { ExampleBadge } from '@/components/ui/ExampleBadge';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingBlock } from '@/components/ui/LoadingSpinner';
import { AccessibilityIcons, SafeImage, SafetyPill } from '@/components/ui/Shared';
import { DetailModal } from '@/components/details/DetailModal';
import { NightCachesSection } from '@/components/map/NightCachesSection';
import { routeToMapItem } from '@/services/api';
import { sortByPreference } from '@/services/routeService';
import { hasEnoughReports } from '@/services/feedbackService';
import { summariseProgress } from '@/services/cacheService';
import { routeTypeLabel } from '@/lib/format';
import type { MentalityPreference, RouteType } from '@/types';

const TYPE_TONES: Record<RouteType, 'teal' | 'pink' | 'warning'> = {
  safe: 'teal',
  exploration: 'pink',
  art_walk: 'warning',
};

/** Prompt 39 — routes, ordered by the mentality someone told us about. */
export function ExplorePage() {
  const data = useAppStore((s) => s.data);
  const loading = useAppStore((s) => s.dataLoading);
  const user = useAppStore((s) => s.user);
  const safety = useAppStore((s) => s.data?.safety);
  const setSelectedItem = useAppStore((s) => s.setSelectedItem);
  const caches = useAppStore((s) => s.data?.caches) ?? [];
  const finds = useAppStore((s) => s.cacheFinds);
  const [tab, setTab] = useState<'routes' | 'caches'>('routes');

  const stored = user?.onboarding_preference ?? loadOnboardingPreference();
  const [preference, setPreference] = useState<MentalityPreference>(stored ?? 'both');
  // The profile arrives after first paint, so the initialiser above almost
  // always runs before we know the user's stated preference. Adopt it when it
  // lands — but only until they pick something else on this screen.
  const touched = useRef(false);
  useEffect(() => {
    if (touched.current || !stored) return;
    setPreference(stored);
  }, [stored]);

  const progress = summariseProgress(caches, finds);

  const routes = useMemo(
    () => sortByPreference(data?.routes ?? [], preference),
    [data?.routes, preference],
  );

  if (loading && !data) return <LoadingBlock label="Loading routes…" />;

  return (
    <div className="page">
      <h1 className="page__title" style={{ fontSize: '1.8rem' }}>
        Explore
      </h1>
      <p className="page__lede">
        Walks put together by residents and the Inclusivity Department, and eight small things in
        the city worth going to look at.
      </p>

      <div className="tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'routes'}
          className={`tab${tab === 'routes' ? ' is-active' : ''}`}
          onClick={() => setTab('routes')}
        >
          Routes ({routes.length})
        </button>
        <button
          role="tab"
          aria-selected={tab === 'caches'}
          className={`tab${tab === 'caches' ? ' is-active' : ''}`}
          onClick={() => setTab('caches')}
        >
          Night Caches ({progress.found}/{progress.total})
        </button>
      </div>

      {tab === 'caches' ? (
        <NightCachesSection caches={caches} finds={finds} onOpen={setSelectedItem} />
      ) : (
        <>
      <div className="row" style={{ marginBottom: '1.25rem' }} role="group" aria-label="Route ordering">
        <button
          className={`chip${preference === 'vigilant' ? ' is-active' : ''}`}
          data-tone="teal"
          onClick={() => { touched.current = true; setPreference('vigilant'); }}
          aria-pressed={preference === 'vigilant'}
        >
          <ShieldCheck size={13} aria-hidden="true" />
          Safe routes first
        </button>
        <button
          className={`chip${preference === 'explorer' ? ' is-active' : ''}`}
          onClick={() => { touched.current = true; setPreference('explorer'); }}
          aria-pressed={preference === 'explorer'}
        >
          <Compass size={13} aria-hidden="true" />
          Exploration first
        </button>
        <button
          className={`chip${preference === 'both' ? ' is-active' : ''}`}
          onClick={() => { touched.current = true; setPreference('both'); }}
          aria-pressed={preference === 'both'}
        >
          Show everything
        </button>
      </div>

      {routes.length === 0 ? (
        <EmptyState
          icon={<Footprints size={24} />}
          title="No routes yet"
          message="Routes appear here as soon as the first one is published."
        />
      ) : (
        <div className="grid grid--2">
          {routes.map((route, cardIndex) => {
            const summary = safety?.get(route.id);
            return (
              <ClickableCard
                key={route.id}
                flush
                label={`Open route: ${route.title}`}
                index={cardIndex}
                onSelect={() => setSelectedItem(routeToMapItem(route))}
              >
                <SafeImage
                  src={route.stops[0]?.image_url ?? null}
                  alt=""
                  style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }}
                />
                <div style={{ padding: '0.85rem' }}>
                  <div className="row" style={{ marginBottom: '0.4rem' }}>
                    <Badge tone={TYPE_TONES[route.type]}>{routeTypeLabel(route.type)}</Badge>
                    <ExampleBadge show={route.is_example} />
                    {hasEnoughReports(summary) && summary ? (
                      <SafetyPill summary={summary} />
                    ) : null}
                  </div>

                  <h3 style={{ fontSize: '1.05rem', marginBottom: '0.25rem' }}>{route.title}</h3>
                  {route.description ? (
                    <p className="small muted" style={{ marginBottom: '0.5rem' }}>
                      {route.description}
                    </p>
                  ) : null}

                  <div className="row tiny muted" style={{ gap: '0.9rem', marginBottom: '0.5rem' }}>
                    <span className="row" style={{ gap: '0.2rem' }}>
                      <Ruler size={11} aria-hidden="true" />
                      {route.distance_km} km
                    </span>
                    <span className="row" style={{ gap: '0.2rem' }}>
                      <Timer size={11} aria-hidden="true" />
                      {route.estimated_time_minutes} min
                    </span>
                    <span>
                      {route.stops.length} stop{route.stops.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <AccessibilityIcons tags={route.accessibility.slice(0, 3)} />
                </div>
              </ClickableCard>
            );
          })}
        </div>
      )}
        </>
      )}

      <DetailModal />
    </div>
  );
}
