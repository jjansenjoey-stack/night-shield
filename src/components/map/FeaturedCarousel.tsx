import { Sparkles } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { ClickableCard } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { SafeImage } from '@/components/ui/Shared';
import { eventToMapItem } from '@/services/api';
import { isPast } from '@/services/eventService';
import { formatEventDate } from '@/lib/format';

/** Prompt 57 — "Featured this week" strip above the map. */
export function FeaturedCarousel() {
  const data = useAppStore((s) => s.data);
  const setSelectedItem = useAppStore((s) => s.setSelectedItem);
  const setMapCenter = useAppStore((s) => s.setMapCenter);

  const featured = (data?.events ?? []).filter((e) => e.is_featured && !isPast(e)).slice(0, 3);
  if (featured.length === 0) return null;

  return (
    <section aria-label="Featured this week">
      <p
        className="tiny"
        style={{
          margin: '0 0 0.3rem 0.35rem',
          color: 'var(--accent2)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        <Sparkles size={11} style={{ verticalAlign: '-1px' }} aria-hidden="true" /> Featured this
        week
      </p>

      <div className="carousel">
        {featured.map((event) => (
          <ClickableCard
            key={event.id}
            flush
            label={`Open event: ${event.title}`}
            onSelect={() => {
              const item = eventToMapItem(event);
              if (item) {
                setMapCenter(item.location, 16);
                setSelectedItem(item);
              }
            }}
          >
            <SafeImage
              src={event.image_url}
              alt=""
              style={{ width: '100%', height: 96, objectFit: 'cover', display: 'block' }}
            />
            <div style={{ padding: '0.6rem' }}>
              <Badge tone="pink">{formatEventDate(event.start_time)}</Badge>
              <strong className="truncate" style={{ display: 'block', marginTop: '0.3rem' }}>
                {event.title}
              </strong>
              <span className="tiny muted truncate" style={{ display: 'block' }}>
                {event.is_virtual ? 'Online' : (event.address ?? 'Tilburg')}
              </span>
            </div>
          </ClickableCard>
        ))}
      </div>
    </section>
  );
}
