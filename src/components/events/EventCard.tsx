import { format } from 'date-fns';
import { Check, Euro, MapPin, Users, Video } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { ClickableCard } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ExampleBadge } from '@/components/ui/ExampleBadge';
import { SafeImage } from '@/components/ui/Shared';
import { countGoing, isPast } from '@/services/eventService';
import { eventCategoryLabel, formatEuros, formatEventDate } from '@/lib/format';
import type { NightEvent } from '@/types';

interface Props {
  event: NightEvent;
  onSelect: () => void;
  compact?: boolean;
  /** Position in the list — drives the staggered entrance. */
  index?: number;
}

export function EventCard({ event, onSelect, compact, index }: Props) {
  const rsvpCounts = useAppStore((s) => s.rsvpCounts);
  const rsvps = useAppStore((s) => s.rsvps);
  const user = useAppStore((s) => s.user);

  const going = countGoing(rsvpCounts, event.id);
  const mine = rsvps.some(
    (r) => r.user_id === user?.id && r.event_id === event.id && r.rsvp_status === 'going',
  );
  const start = new Date(event.start_time);

  return (
    <ClickableCard
      onSelect={onSelect}
      flush
      label={`Open event: ${event.title}`}
      index={index}
    >
      <div className="event-card" style={{ padding: '0.6rem' }}>
        {compact ? (
          <div className="event-card__date" aria-hidden="true">
            <span className="event-card__day">{format(start, 'd')}</span>
            <span className="event-card__mon">{format(start, 'MMM')}</span>
          </div>
        ) : (
          <SafeImage src={event.image_url} alt="" className="event-card__thumb" />
        )}

        <div className="grow stack stack--xs" style={{ gap: '0.25rem', minWidth: 0 }}>
          <div className="row" style={{ gap: '0.35rem' }}>
            <Badge tone="pink">{eventCategoryLabel(event.category)}</Badge>
            <ExampleBadge show={event.is_example} />
            {event.is_virtual ? (
              <Badge tone="teal" icon={<Video size={10} />}>
                Online
              </Badge>
            ) : null}
            {mine ? (
              <Badge tone="success" icon={<Check size={10} />}>
                Going
              </Badge>
            ) : null}
            {isPast(event) ? <Badge tone="neutral">Finished</Badge> : null}
          </div>

          <strong className="truncate" style={{ display: 'block' }}>
            {event.title}
          </strong>

          <span className="tiny muted">{formatEventDate(event.start_time, event.end_time)}</span>

          <div className="row tiny muted" style={{ gap: '0.75rem' }}>
            {event.address ? (
              <span className="row truncate" style={{ gap: '0.2rem', maxWidth: '18ch' }}>
                <MapPin size={11} aria-hidden="true" />
                {event.address}
              </span>
            ) : null}
            <span className="row" style={{ gap: '0.2rem' }}>
              <Users size={11} aria-hidden="true" />
              {event.capacity != null ? `${going} / ${event.capacity}` : `${going} going`}
            </span>
            <span className="row" style={{ gap: '0.2rem' }}>
              <Euro size={11} aria-hidden="true" />
              {formatEuros(event.cost_euros)}
            </span>
          </div>
        </div>
      </div>
    </ClickableCard>
  );
}
