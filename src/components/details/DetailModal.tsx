import { useAppStore } from '@/store/appStore';
import { distanceKm } from '@/lib/geo';
import { LocationDetailModal } from './LocationDetailModal';
import { RouteDetailModal } from './RouteDetailModal';
import { EventDetailModal } from './EventDetailModal';
import { CacheDetailModal } from './CacheDetailModal';
import type { DiscoveryRoute, NightCache, NightEvent } from '@/types';

/**
 * One place decides which detail sheet a selection opens, so every surface —
 * map marker, nearby list, search result, calendar — behaves the same way.
 */
export function DetailModal() {
  const item = useAppStore((s) => s.selectedItem);
  const setSelectedItem = useAppStore((s) => s.setSelectedItem);
  const userLocation = useAppStore((s) => s.userLocation);

  if (!item) return null;

  const close = () => setSelectedItem(null);
  const distance = userLocation ? distanceKm(userLocation, item.location) : null;

  if (item.type === 'route') {
    return <RouteDetailModal route={item.raw as DiscoveryRoute} onClose={close} />;
  }
  if (item.type === 'event') {
    return <EventDetailModal event={item.raw as NightEvent} distance={distance} onClose={close} />;
  }
  if (item.type === 'cache') {
    return <CacheDetailModal cache={item.raw as NightCache} onClose={close} />;
  }
  return <LocationDetailModal item={item} distance={distance} onClose={close} />;
}
