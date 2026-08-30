import { useMemo } from 'react';
import {
  DISTANCE_BAND_KM,
  useAppStore,
  type DistanceBand,
  type TimeFilter,
} from '@/store/appStore';
import { toMapItems } from '@/services/api';
import { distanceKm } from '@/lib/geo';
import type { ItemType, LatLng, MapItem, NightEvent } from '@/types';

/** Stable identity so the memo below does not recompute on every render. */
const NO_NEEDS: string[] = [];

export interface DecoratedItem extends MapItem {
  distance: number | null;
}

function withinDistance(band: DistanceBand, km: number | null): boolean {
  if (band === 'any' || km === null) return true;
  if (band === 'near') return km <= (DISTANCE_BAND_KM.near ?? 1);
  if (band === 'mid') return km > (DISTANCE_BAND_KM.near ?? 1) && km <= (DISTANCE_BAND_KM.mid ?? 3);
  // 'far' is a lower bound: everything past the mid band.
  return km > (DISTANCE_BAND_KM.mid ?? 3);
}

function matchesTime(filter: TimeFilter, item: MapItem): boolean {
  if (filter === 'any') return true;
  // Only events carry a time; everything else stays visible.
  if (item.type !== 'event') return true;

  const event = item.raw as NightEvent;
  const start = new Date(event.start_time);
  const end = new Date(event.end_time);
  const now = new Date();

  if (filter === 'now') return start <= now && end >= now;

  const hour = start.getHours();
  if (filter === 'evening') return hour >= 17 && hour < 20;
  return hour >= 20 || hour < 4;
}

/**
 * One place where every filter in the app is applied (prompt 35), so the map,
 * the nearby list and the result count can never disagree.
 */
export function useFilteredItems(): {
  items: DecoratedItem[];
  total: number;
  origin: LatLng | null;
} {
  const data = useAppStore((s) => s.data);
  const activeTypes = useAppStore((s) => s.activeTypes);
  const accessibilityFilters = useAppStore((s) => s.accessibilityFilters);
  const distanceBand = useAppStore((s) => s.distanceBand);
  const timeFilter = useAppStore((s) => s.timeFilter);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const userLocation = useAppStore((s) => s.userLocation);
  const mapCenter = useAppStore((s) => s.mapCenter);
  const layers = useAppStore((s) => s.prefs.layers);
  // The needs someone recorded on their profile, used to order results.
  const accessNeeds = useAppStore((s) => s.user?.accessibility_needs) ?? NO_NEEDS;

  return useMemo(() => {
    if (!data) return { items: [], total: 0, origin: userLocation };

    // Layer toggles (prompt 44) and filter chips (prompt 35) intersect.
    const visibleTypes = activeTypes.filter((t: ItemType) => layers[t]);
    const all = toMapItems(data, visibleTypes);
    const origin = userLocation ?? mapCenter;
    const query = searchQuery.trim().toLowerCase();

    const decorated: DecoratedItem[] = all.map((item) => ({
      ...item,
      distance: origin ? distanceKm(origin, item.location) : null,
    }));

    const filtered = decorated.filter((item) => {
      if (!withinDistance(distanceBand, item.distance)) return false;
      if (!matchesTime(timeFilter, item)) return false;

      if (accessibilityFilters.length) {
        if (!accessibilityFilters.every((tag) => item.accessibility.includes(tag))) return false;
      }

      if (query) {
        const haystack = `${item.title} ${item.subtitle ?? ''}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });

    /*
     * Distance first, but a place that meets every access need the user told us
     * about is lifted above one that does not. Nothing is hidden — someone who
     * needs step-free access simply should not have to scroll past six places
     * that do not have it.
     */
    const meetsNeeds = (item: DecoratedItem) =>
      accessNeeds.length > 0 && accessNeeds.every((tag) => item.accessibility.includes(tag));

    filtered.sort((a, b) => {
      const byNeeds = Number(meetsNeeds(b)) - Number(meetsNeeds(a));
      if (byNeeds !== 0) return byNeeds;
      return (a.distance ?? Infinity) - (b.distance ?? Infinity);
    });

    return { items: filtered, total: decorated.length, origin: userLocation };
  }, [
    data,
    activeTypes,
    accessibilityFilters,
    distanceBand,
    timeFilter,
    searchQuery,
    userLocation,
    mapCenter,
    layers,
    accessNeeds,
  ]);
}
