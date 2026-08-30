import { Brush, CalendarDays, Coffee, MapPin, Route as RouteIcon, Search, X } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useFilteredItems } from '@/hooks/useFilteredItems';
import { useGeolocation } from '@/hooks/useGeolocation';
import { formatDistance } from '@/lib/geo';
import { itemTypeLabel } from '@/lib/format';
import { SafeImage, SafetyPill } from '@/components/ui/Shared';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import type { ItemType } from '@/types';

const TYPE_ICONS: Record<ItemType, typeof Brush> = {
  installation: Brush,
  event: CalendarDays,
  route: RouteIcon,
  third_space: Coffee,
  cache: Search,
};

/** Prompt 38 — the map as a list, for people who would rather read than pan. */
export function NearbySidebar() {
  const open = useAppStore((s) => s.nearbyOpen);
  const setOpen = useAppStore((s) => s.setNearbyOpen);
  const setSelectedItem = useAppStore((s) => s.setSelectedItem);
  const setMapCenter = useAppStore((s) => s.setMapCenter);
  const data = useAppStore((s) => s.data);
  const { items } = useFilteredItems();
  const { userLocation, locationDenied, request } = useGeolocation();

  return (
    <aside
      className={`nearby${open ? ' is-open' : ''}`}
      aria-label="Nearby locations"
      aria-hidden={!open}
      {...(!open ? { inert: '' as unknown as boolean } : {})}
    >
      <div className="nearby__head">
        <div>
          <h3 style={{ margin: 0 }}>Nearby</h3>
          <p className="tiny muted" style={{ margin: 0 }}>
            {userLocation
              ? `${items.length} places, closest first`
              : `${items.length} places, from the map centre`}
          </p>
        </div>
        <button className="modal__close" onClick={() => setOpen(false)} aria-label="Close nearby list">
          <X size={17} />
        </button>
      </div>

      {!userLocation && !locationDenied ? (
        <div style={{ padding: '0 1rem 0.5rem' }}>
          <Button variant="text" size="sm" block icon={<MapPin size={14} />} onClick={request}>
            Use my location for real distances
          </Button>
        </div>
      ) : null}

      {locationDenied ? (
        <p className="tiny muted" style={{ padding: '0 1rem' }}>
          Location is off, so distances are measured from the centre of the map.
        </p>
      ) : null}

      <div className="nearby__list">
        {items.length === 0 ? (
          <EmptyState
            title="Nothing matches those filters"
            message="Try widening the distance, or clearing a filter or two."
          />
        ) : null}

        {items.map((item) => {
          const Icon = TYPE_ICONS[item.type];
          const summary = data?.safety.get(item.id);

          return (
            <button
              key={`${item.type}-${item.id}`}
              className="list-row"
              onClick={() => {
                setMapCenter(item.location, 16);
                setSelectedItem(item);
                if (window.innerWidth < 900) setOpen(false);
              }}
            >
              {item.image ? (
                <SafeImage src={item.image} alt="" className="list-row__thumb" />
              ) : (
                <span className="list-row__thumb" aria-hidden="true">
                  <Icon size={18} />
                </span>
              )}

              <span className="grow">
                <span className="list-row__title truncate" style={{ display: 'block' }}>
                  {item.title}
                </span>
                <span className="list-row__meta">
                  {itemTypeLabel(item.type)}
                  {item.distance != null ? ` · ${formatDistance(item.distance)}` : ''}
                </span>
              </span>

              {summary && summary.count >= 3 ? <SafetyPill summary={summary} /> : null}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
