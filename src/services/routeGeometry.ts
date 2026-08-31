import { cacheGet, cacheSet } from '@/lib/idb';
import type { LatLng } from '@/types';

/**
 * Snapping route lines to actual footpaths.
 *
 * A route is stored as a handful of stops. Drawing a line straight from one to
 * the next is quick but wrong: it cuts through buildings, crosses the ring road
 * where there is no crossing, and makes a 3.6 km walk look like 2.8 km of
 * diagonals. This asks a router for the real pedestrian geometry between the
 * stops and draws that instead.
 *
 * The router is FOSSGIS's public OSRM instance on its *foot* profile. Keyless,
 * like the basemap — the app deliberately has no API keys in it, because the
 * bundle is public and anything in it is public too. The driving profile is not
 * a substitute: for the LocHal → Spoorpark leg it returns 2.5 km of one-way
 * streets against 1.0 km on foot.
 *
 * Results are cached indefinitely and keyed by the coordinates themselves, so
 * the network is asked once per route shape and an edited stop invalidates on
 * its own. Every failure path returns null and the caller keeps its straight
 * lines: a map with slightly wrong lines beats no map.
 */

const FOOT_ROUTER = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot/';

/** OSRM rejects very long waypoint lists; no route here comes close. */
const MAX_WAYPOINTS = 25;

export interface SnappedPath {
  points: LatLng[];
  /** Metres along the walking network, which is the honest distance. */
  distanceM: number;
  /** Seconds at OSRM's walking pace. */
  durationS: number;
}

/** Small non-cryptographic digest, enough to key a cache entry. */
function digest(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function cacheKey(points: LatLng[]): string {
  // Five decimal places is about a metre — finer than the stops are placed.
  const shape = points
    .map((p) => `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`)
    .join('|');
  return `ns.footpath.v1.${digest(shape)}`;
}

/*
 * Answers already known this session, and requests still in the air.
 *
 * Both matter. The memory cache saves an IndexedDB read on every render, and
 * the in-flight map means concurrent callers asking for the same shape share
 * one request — which is also what makes this survive React StrictMode, where
 * every effect is mounted, torn down and mounted again. Deduping in the
 * component instead would let the first mount start the request, the teardown
 * discard it, and the second mount skip it as "already asked", so the answer
 * would never arrive.
 */
const memory = new Map<string, SnappedPath>();
const inFlight = new Map<string, Promise<SnappedPath | null>>();

export async function snapToFootpaths(points: LatLng[]): Promise<SnappedPath | null> {
  if (points.length < 2 || points.length > MAX_WAYPOINTS) return null;

  const key = cacheKey(points);

  const known = memory.get(key);
  if (known) return known;

  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = fetchSnapped(points, key);
  inFlight.set(key, request);
  try {
    return await request;
  } finally {
    inFlight.delete(key);
  }
}

async function fetchSnapped(points: LatLng[], key: string): Promise<SnappedPath | null> {
  // Cache first, deliberately. The pavements of Tilburg do not move, and this
  // is someone else's free service.
  try {
    const cached = await cacheGet<SnappedPath>(key);
    if (cached?.value?.points?.length) {
      memory.set(key, cached.value);
      return cached.value;
    }
  } catch {
    /* no IndexedDB (private window, blocked storage) — just fetch */
  }

  const coords = points.map((p) => `${p.longitude},${p.latitude}`).join(';');

  try {
    const response = await fetch(
      `${FOOT_ROUTER}${coords}?overview=full&geometries=geojson`,
      { headers: { Accept: 'application/json' } },
    );
    if (!response.ok) return null;

    const json = (await response.json()) as {
      code?: string;
      routes?: Array<{
        distance?: number;
        duration?: number;
        geometry?: { coordinates?: Array<[number, number]> };
      }>;
    };

    const route = json.routes?.[0];
    const line = route?.geometry?.coordinates;
    if (json.code !== 'Ok' || !line?.length) return null;

    const snapped: SnappedPath = {
      points: line.map(([longitude, latitude]) => ({ latitude, longitude })),
      distanceM: Math.round(route?.distance ?? 0),
      durationS: Math.round(route?.duration ?? 0),
    };

    memory.set(key, snapped);
    void cacheSet(key, snapped).catch(() => null);
    return snapped;
  } catch {
    // Offline, blocked, rate-limited, or the service is down. The caller falls
    // back to straight lines, which is what it was drawing before anyway.
    return null;
  }
}
