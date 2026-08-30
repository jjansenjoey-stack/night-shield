import { getProvider } from './dataProvider';
import { distanceKm } from '@/lib/geo';
import {
  CACHE_FIND_RADIUS_M,
  remoteCachePoints,
  type CacheFind,
  type LatLng,
  type NightCache,
} from '@/types';

/**
 * Night Caches — a geocaching layer over the city.
 *
 * Two ways to log a find, on purpose. Standing next to the thing is worth full
 * points. Answering the question from the photo and hint is worth fewer, and
 * exists so that a mobility limit, a travel budget, or simply not fancying that
 * street after dark never locks someone out of the game entirely.
 */

export const remotePoints = (cache: NightCache) => remoteCachePoints(cache.points);

export async function getCaches(): Promise<NightCache[]> {
  const provider = await getProvider();
  return provider.getCaches();
}

export async function getCacheFinds(userId: string): Promise<CacheFind[]> {
  const provider = await getProvider();
  return provider.getCacheFinds(userId);
}

/** How many people have found each cache, keyed by cache id. */
export async function getCacheFindCounts(): Promise<Map<string, number>> {
  const provider = await getProvider();
  return provider.getCacheFindCounts();
}

export async function logCacheFind(
  userId: string,
  cache: NightCache,
  method: 'visited' | 'answered',
  at: LatLng | null,
  answer: string | null = null,
): Promise<CacheFind> {
  const provider = await getProvider();
  return provider.logCacheFind(userId, cache.id, method, at, answer);
}

// ---- Local checks ---------------------------------------------------------
// The server re-checks both of these before it writes anything. These exist so
// the UI can enable the button and explain itself, not as the gate.

export function metresAway(cache: NightCache, from: LatLng | null): number | null {
  if (!from) return null;
  return Math.round(distanceKm(from, cache.location) * 1000);
}

export function isWithinFindRange(cache: NightCache, from: LatLng | null): boolean {
  const metres = metresAway(cache, from);
  return metres !== null && metres <= CACHE_FIND_RADIUS_M;
}

/*
 * There is deliberately no client-side answer check. On Supabase the `answers`
 * column never reaches the browser — a quiz whose answers ship to the client is
 * not a quiz — so the only place that can judge an answer is the backend. The
 * UI submits and reports whatever comes back.
 */

// ---- Progress -------------------------------------------------------------

export interface CacheProgress {
  found: number;
  total: number;
  visited: number;
  answered: number;
  pointsEarned: number;
}

export function summariseProgress(
  caches: NightCache[],
  finds: CacheFind[],
): CacheProgress {
  const byId = new Map(caches.map((c) => [c.id, c]));
  let visited = 0;
  let answered = 0;
  let pointsEarned = 0;

  for (const find of finds) {
    const cache = byId.get(find.cache_id);
    if (!cache) continue;
    if (find.method === 'visited') {
      visited += 1;
      pointsEarned += cache.points;
    } else {
      answered += 1;
      pointsEarned += remotePoints(cache);
    }
  }

  return { found: visited + answered, total: caches.length, visited, answered, pointsEarned };
}

export const DIFFICULTY_LABELS = {
  easy: 'Easy find',
  medium: 'Takes a look',
  hard: 'Properly hidden',
} as const;

/**
 * Badges the cache game can award. Checked after each find.
 */
export function badgesEarned(caches: NightCache[], finds: CacheFind[]): string[] {
  const progress = summariseProgress(caches, finds);
  const byId = new Map(caches.map((c) => [c.id, c]));
  const earned: string[] = [];

  if (progress.found >= 1) earned.push('First Find');
  if (progress.visited >= 5) earned.push('City Walker');
  if (progress.found >= caches.length && caches.length > 0) earned.push('Completionist');

  const foundNightOnly = finds.filter(
    (f) => f.method === 'visited' && byId.get(f.cache_id)?.night_only,
  ).length;
  if (foundNightOnly >= 2) earned.push('Night Owl');

  const foundHard = finds.filter(
    (f) => byId.get(f.cache_id)?.difficulty === 'hard',
  ).length;
  if (foundHard >= 2) earned.push('Sharp Eyes');

  return earned;
}
