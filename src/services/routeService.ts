import { getProvider } from './dataProvider';
import { distanceKm } from '@/lib/geo';
import type { DiscoveryRoute, LatLng, MentalityPreference, RouteType } from '@/types';

export interface RouteFilters {
  search?: string;
  types?: RouteType[];
  accessibility?: string[];
  maxDistanceKm?: number | null;
  origin?: LatLng | null;
  /** Reorders results to match the mentality chosen at onboarding (prompt 39). */
  preference?: MentalityPreference | null;
}

export async function getRoutes(filters: RouteFilters = {}): Promise<DiscoveryRoute[]> {
  const provider = await getProvider();
  const rows = await provider.getRoutes();
  return applyRouteFilters(rows, filters);
}

export function applyRouteFilters(rows: DiscoveryRoute[], filters: RouteFilters): DiscoveryRoute[] {
  const search = filters.search?.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    if (filters.types?.length && !filters.types.includes(row.type)) return false;
    if (filters.accessibility?.length) {
      if (!filters.accessibility.every((tag) => row.accessibility.includes(tag))) return false;
    }
    if (filters.maxDistanceKm != null && filters.origin) {
      if (distanceKm(filters.origin, row.start_location) > filters.maxDistanceKm) return false;
    }
    if (search) {
      const haystack = [row.title, row.description, row.type]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  return sortByPreference(filtered, filters.preference ?? null);
}

/**
 * Prompt 39 — someone who told us they want clarity sees safe routes first;
 * someone who told us they like discovery sees exploration routes first.
 * Nothing is hidden either way, only reordered.
 */
export function sortByPreference(
  rows: DiscoveryRoute[],
  preference: MentalityPreference | null,
): DiscoveryRoute[] {
  if (!preference || preference === 'both') return rows;

  const rank = (type: RouteType): number => {
    if (preference === 'vigilant') return type === 'safe' ? 0 : type === 'art_walk' ? 1 : 2;
    return type === 'exploration' ? 0 : type === 'art_walk' ? 1 : 2;
  };

  return [...rows].sort((a, b) => rank(a.type) - rank(b.type));
}

export async function getRouteById(id: string): Promise<DiscoveryRoute | null> {
  const provider = await getProvider();
  return provider.getRouteById(id);
}

export async function createRoute(
  data: Omit<DiscoveryRoute, 'id' | 'created_at'>,
): Promise<DiscoveryRoute> {
  const provider = await getProvider();
  return provider.createRoute(data);
}

export async function updateRoute(
  id: string,
  patch: Partial<DiscoveryRoute>,
): Promise<DiscoveryRoute> {
  const provider = await getProvider();
  return provider.updateRoute(id, patch);
}

export async function deleteRoute(id: string): Promise<void> {
  const provider = await getProvider();
  return provider.deleteRoute(id);
}

/** Line colour for the polyline drawn on the map (prompt 33). */
export const ROUTE_LINE_COLORS: Record<RouteType, string> = {
  safe: '#00d9ff',
  exploration: '#ff006e',
  art_walk: '#ffd166',
};

/** All points of a route in walking order, for polylines and deep links. */
export function routePath(route: DiscoveryRoute): LatLng[] {
  const stops = [...route.stops].sort((a, b) => a.order - b.order).map((s) => s.location);
  if (stops.length >= 2) return stops;
  return [route.start_location, ...stops, route.end_location];
}
