import { Sparkles } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { eventToMapItem } from '@/services/api';
import { isPast } from '@/services/eventService';
import { formatEventDate } from '@/lib/format';
import { ExampleBadge } from '@/components/ui/ExampleBadge';

/**
 * "Featured this week", as a strip along the bottom of the map.
 *
 * It used to be three full image cards stacked under the search bar and the
 * filter chips, which took about a hundred and eighty pixels off the top of the
 * map — on a phone that is most of the city gone, to advertise three events.
 *
 * The map is the page. Controls belong over it; content does not. So this is
 * now one scrollable row of small pills pinned to the bottom, out of the way of
 * both the toolbar and the two floating buttons on the right, and it costs
 * about forty pixels. Tapping one still centres the map and opens the event,
 * which was always the point of it.
 */
export function FeaturedCarousel() {
  const data = useAppStore((s) => s.data);
  const setSelectedItem = useAppStore((s) => s.setSelectedItem);
  const setMapCenter = useAppStore((s) => s.setMapCenter);

  const featured = (data?.events ?? []).filter((e) => e.is_featured && !isPast(e)).slice(0, 4);
  if (featured.length === 0) return null;

  return (
    <section className="featured-strip" aria-label="Featured this week">
      <span className="featured-strip__label">
        <Sparkles size={11} aria-hidden="true" />
        This week
      </span>

      <div className="featured-strip__scroll">
        {featured.map((event) => (
          <button
            key={event.id}
            type="button"
            className="featured-pill"
            onClick={() => {
              const item = eventToMapItem(event);
              if (item) {
                setMapCenter(item.location, 16);
                setSelectedItem(item);
              }
            }}
          >
            <span className="featured-pill__when">
              {formatEventDate(event.start_time, event.end_time)}
            </span>
            <span className="featured-pill__what">
              {event.title}
              <ExampleBadge show={event.is_example} iconOnly />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
