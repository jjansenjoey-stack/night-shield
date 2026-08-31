import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Compass, Eye, Search } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { SafeImage } from '@/components/ui/Shared';
import { ExampleBadge } from '@/components/ui/ExampleBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { galleryEntries } from '@/services/routeArtService';
import { effectivePlacementStatus, type Placement, type RouteSpot } from '@/types';

/**
 * Everything that has ever been on the changing route.
 *
 * The point of a route that empties itself every fortnight is that you miss
 * things. Somebody spends a weekend making something, it stands in the street
 * for two weeks, and then it goes home and is gone — and anybody who walked on
 * the wrong Tuesday never knew it existed.
 *
 * So the work outlives the fortnight here. It is a record for the makers, a
 * reason to come back for everyone else, and the clearest possible answer to
 * "what am I supposed to put in a spot?".
 */

type Filter = 'all' | 'now' | 'hunts';

export function ArtGallery({
  placements,
  spots,
}: {
  placements: Placement[];
  spots: RouteSpot[];
}) {
  const [filter, setFilter] = useState<Filter>('all');

  const spotNumber = useMemo(
    () => new Map(spots.map((s) => [s.id, s.number])),
    [spots],
  );

  // One instant for the whole list, so a piece cannot be live in one row and
  // expired in the next as the clock ticks mid-render.
  const now = useMemo(() => new Date(), [placements]);

  const entries = useMemo(() => {
    const all = galleryEntries(placements);
    if (filter === 'now') {
      return all.filter((p) => effectivePlacementStatus(p, now) === 'live');
    }
    if (filter === 'hunts') return all.filter((p) => Boolean(p.hunt_clue));
    return all;
  }, [placements, filter, now]);

  const liveCount = placements.filter(
    (p) => effectivePlacementStatus(p, now) === 'live',
  ).length;
  const huntCount = placements.filter((p) => Boolean(p.hunt_clue)).length;

  const FILTERS: Array<{ id: Filter; label: string; count: number }> = [
    { id: 'all', label: 'Everything ever', count: placements.length },
    { id: 'now', label: 'Out there now', count: liveCount },
    { id: 'hunts', label: 'Hidden', count: huntCount },
  ];

  return (
    <div className="stack stack--xs">
      <p className="small muted" style={{ margin: 0 }}>
        Every piece that has been on the route, including the ones that have gone home. If you
        walked past on the wrong week, this is what you missed.
      </p>

      <div className="row row--wrap" style={{ gap: '0.35rem' }} role="group" aria-label="Filter the gallery">
        {FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`chip${filter === option.id ? ' is-active' : ''}`}
            aria-pressed={filter === option.id}
            onClick={() => setFilter(option.id)}
          >
            {option.label}
            <span className="tiny" style={{ opacity: 0.75 }}>
              {option.count}
            </span>
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          message="When somebody puts a piece on the route, it appears here — and stays here after they take it home."
        />
      ) : (
        <div className="grid grid--2 gallery-grid">
          {entries.map((piece, index) => {
            const status = effectivePlacementStatus(piece, now);
            const number = spotNumber.get(piece.spot_id);

            return (
              <Card
                key={piece.id}
                className="card-enter gallery-card"
                style={{ '--i': Math.min(index, 12) } as React.CSSProperties}
              >
                <SafeImage
                  src={piece.image_url}
                  alt={`${piece.title}, by ${piece.maker_name ?? 'an anonymous maker'}`}
                  className="gallery-card__image"
                />

                <div className="row row--wrap" style={{ gap: '0.3rem', marginTop: '0.6rem' }}>
                  {status === 'live' ? <Badge tone="teal">Out there now</Badge> : null}
                  {status === 'collected' ? <Badge tone="neutral">Taken home</Badge> : null}
                  {status === 'removed' ? <Badge tone="neutral">Cleared</Badge> : null}
                  {piece.hunt_clue ? (
                    <Badge tone="pink" icon={<Search size={12} />}>
                      Hidden
                    </Badge>
                  ) : null}
                  {number ? <Badge tone="warning">Spot {number}</Badge> : null}
                  <ExampleBadge show={piece.is_example} />
                </div>

                <h3 style={{ margin: '0.5rem 0 0.15rem', fontSize: '1rem' }}>{piece.title}</h3>
                <p className="tiny muted" style={{ margin: 0 }}>
                  {piece.maker_name ?? 'Anonymous'} · {format(new Date(piece.placed_at), 'd MMM')}
                  {piece.materials ? ` · ${piece.materials}` : ''}
                </p>

                {piece.description ? (
                  <p className="small" style={{ margin: '0.5rem 0 0' }}>
                    {piece.description}
                  </p>
                ) : null}

                {piece.find_count ? (
                  <p className="tiny" style={{ margin: '0.5rem 0 0', color: 'var(--accent2)' }}>
                    <Eye size={12} aria-hidden="true" /> Found by {piece.find_count}{' '}
                    {piece.find_count === 1 ? 'person' : 'people'}
                  </p>
                ) : null}

                {piece.hunt_clue && status === 'live' ? (
                  <p className="tiny muted" style={{ margin: '0.4rem 0 0' }}>
                    <Compass size={12} aria-hidden="true" /> Clue: {piece.hunt_clue}
                  </p>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
