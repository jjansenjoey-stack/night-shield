import { getProvider } from './dataProvider';
import { withCache } from '@/lib/idb';
import { getAllFeedback, summariseFeedback } from './feedbackService';
import { getInstallations } from './installationService';
import { getRoutes } from './routeService';
import { getThirdSpaces } from './thirdSpaceService';
import { getCaches } from './cacheService';
import type {
  DiscoveryRoute,
  Feedback,
  Installation,
  ItemType,
  MapItem,
  NightCache,
  NightEvent,
  SafetySummary,
  ThirdSpace,
} from '@/types';

/**
 * Aggregate loader for everything the Discover map needs, in one round trip.
 * Results are cached to IndexedDB so the app still renders offline (prompt 43).
 */

export interface CityData {
  installations: Installation[];
  routes: DiscoveryRoute[];
  events: NightEvent[];
  thirdSpaces: ThirdSpace[];
  feedback: Feedback[];
  caches: NightCache[];
}

export interface CityDataResult extends CityData {
  stale: boolean;
  cachedAt: string | null;
  safety: Map<string, SafetySummary>;
}

const CACHE_KEY = 'city-data-v1';

export async function fetchCityData(): Promise<CityDataResult> {
  const { value, stale, cachedAt } = await withCache<CityData>(CACHE_KEY, async () => {
    // Goes through the domain services rather than the provider directly, so
    // there is one code path per entity for the whole app.
    const [installations, routes, events, thirdSpaces, feedback, caches] = await Promise.all([
      getInstallations(),
      getRoutes(),
      (await getProvider()).getEvents(),
      getThirdSpaces(),
      getAllFeedback(),
      getCaches(),
    ]);
    return { installations, routes, events, thirdSpaces, feedback, caches };
  });

  return { ...value, stale, cachedAt, safety: summariseFeedback(value.feedback) };
}

// ---- MapItem projection ---------------------------------------------------

export function installationToMapItem(row: Installation): MapItem {
  return {
    id: row.id,
    type: 'installation',
    title: row.title,
    subtitle: row.artist,
    location: row.location,
    image: row.images[0] ?? null,
    accessibility: row.accessibility,
    raw: row,
  };
}

export function thirdSpaceToMapItem(row: ThirdSpace): MapItem {
  return {
    id: row.id,
    type: 'third_space',
    title: row.name,
    subtitle: row.hours_open,
    location: row.location,
    image: row.image_url,
    accessibility: row.accessibility,
    raw: row,
  };
}

export function routeToMapItem(row: DiscoveryRoute): MapItem {
  return {
    id: row.id,
    type: 'route',
    title: row.title,
    subtitle: `${row.distance_km} km · ${row.estimated_time_minutes} min`,
    location: row.start_location,
    image: row.stops[0]?.image_url ?? null,
    accessibility: row.accessibility,
    raw: row,
  };
}

export function eventToMapItem(row: NightEvent): MapItem | null {
  // Virtual events have nowhere to sit on a map.
  if (!row.location) return null;
  return {
    id: row.id,
    type: 'event',
    title: row.title,
    subtitle: row.organizer_name,
    location: row.location,
    image: row.image_url,
    accessibility: row.accessibility,
    raw: row,
  };
}

export function cacheToMapItem(row: NightCache): MapItem {
  return {
    id: row.id,
    type: 'cache',
    title: row.title,
    subtitle: row.area,
    location: row.location,
    image: row.image_url,
    accessibility: row.accessibility,
    raw: row,
  };
}

export function toMapItems(data: CityData, types: ItemType[]): MapItem[] {
  const items: MapItem[] = [];
  if (types.includes('installation')) {
    items.push(...data.installations.map(installationToMapItem));
  }
  if (types.includes('third_space')) {
    items.push(...data.thirdSpaces.map(thirdSpaceToMapItem));
  }
  if (types.includes('route')) {
    items.push(...data.routes.map(routeToMapItem));
  }
  if (types.includes('cache')) {
    items.push(...data.caches.map(cacheToMapItem));
  }
  if (types.includes('event')) {
    const now = Date.now();
    items.push(
      ...data.events
        .filter((e) => new Date(e.end_time).getTime() >= now)
        .map(eventToMapItem)
        .filter((i): i is MapItem => i !== null),
    );
  }
  return items;
}

/*
 * Prompt 10 asked for separate fetchLocations / fetchEvents / fetchRoutes
 * stubs. They collapsed into fetchCityData above once the map needed all four
 * entity types plus their safety scores in one cached round trip; the
 * per-entity functions live on in installationService, routeService,
 * eventService and thirdSpaceService, which is where filtering belongs.
 */
