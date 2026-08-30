import { Accessibility, CheckCircle2, Compass, Moon, Trophy } from 'lucide-react';
import { ClickableCard } from '@/components/ui/Card';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { SafeImage } from '@/components/ui/Shared';
import { cacheToMapItem } from '@/services/api';
import { DIFFICULTY_LABELS, summariseProgress } from '@/services/cacheService';
import type { CacheFind, MapItem, NightCache } from '@/types';

interface Props {
  caches: NightCache[];
  finds: CacheFind[];
  onOpen: (item: MapItem) => void;
}

/**
 * The Night Caches list. Found ones keep their story visible; unfound ones show
 * only the hint, so the list is a hunt sheet rather than a spoiler.
 */
export function NightCachesSection({ caches, finds, onOpen }: Props) {
  const foundIds = new Map(finds.map((f) => [f.cache_id, f]));
  const progress = summariseProgress(caches, finds);

  if (caches.length === 0) {
    return (
      <EmptyState
        icon={<Compass size={24} />}
        title="No caches yet"
        message="The first set is being placed around the city."
      />
    );
  }

  return (
    <div className="stack">
      <Card>
        <div className="row row--between" style={{ marginBottom: '0.5rem' }}>
          <span className="row" style={{ gap: '0.4rem' }}>
            <Trophy size={18} color="var(--warning)" aria-hidden="true" />
            <span className="stat__value">
              {progress.found} / {progress.total}
            </span>
            <span className="muted small">found</span>
          </span>
          <span className="tiny muted">
            {progress.visited} in person · {progress.answered} from home
          </span>
        </div>
        <div
          className="progress"
          role="img"
          aria-label={`${progress.found} of ${progress.total} Night Caches found`}
        >
          <div
            className="progress__fill"
            style={{ width: `${(progress.found / Math.max(1, progress.total)) * 100}%` }}
          />
        </div>
        <p className="tiny muted" style={{ margin: '0.5rem 0 0' }}>
          <Accessibility size={12} style={{ verticalAlign: '-2px' }} aria-hidden="true" /> Every
          cache can be logged two ways — by going there, or by answering a question about it. Both
          count.
        </p>
      </Card>

      <div className="grid grid--2">
        {caches.map((cache, cardIndex) => {
          const find = foundIds.get(cache.id);
          return (
            <ClickableCard
              key={cache.id}
              flush
              label={`Open Night Cache: ${cache.title}`}
              index={cardIndex}
              onSelect={() => onOpen(cacheToMapItem(cache))}
            >
              <SafeImage
                src={cache.image_url}
                alt=""
                style={{
                  width: '100%',
                  height: 120,
                  objectFit: 'cover',
                  display: 'block',
                  // Unfound caches read as unclaimed.
                  filter: find ? 'none' : 'grayscale(0.7) brightness(0.7)',
                }}
              />
              <div style={{ padding: '0.85rem' }}>
                <div className="row" style={{ marginBottom: '0.4rem' }}>
                  <Badge tone="warning">{DIFFICULTY_LABELS[cache.difficulty]}</Badge>
                  <Badge tone="pink">{cache.points} pts</Badge>
                  {cache.night_only ? (
                    <Badge tone="teal" icon={<Moon size={10} />}>
                      After dark
                    </Badge>
                  ) : null}
                  {find ? (
                    <Badge tone="success" icon={<CheckCircle2 size={10} />}>
                      {find.method === 'visited' ? 'Visited' : 'Answered'}
                    </Badge>
                  ) : null}
                </div>

                <h3 style={{ fontSize: '1.05rem', marginBottom: '0.15rem' }}>{cache.title}</h3>
                <p className="tiny muted" style={{ marginBottom: '0.4rem' }}>
                  {cache.area}
                </p>
                <p className="small muted" style={{ margin: 0 }}>
                  {find ? cache.story : cache.hint}
                </p>
              </div>
            </ClickableCard>
          );
        })}
      </div>
    </div>
  );
}
