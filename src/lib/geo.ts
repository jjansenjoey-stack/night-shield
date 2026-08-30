import type { LatLng } from '@/types';

const EARTH_RADIUS_KM = 6371;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in kilometres. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function formatDistance(km: number | null): string {
  if (km === null || Number.isNaN(km)) return '—';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

/** Rough walking time at 4.8 km/h. */
export function walkingMinutes(km: number): number {
  return Math.max(1, Math.round((km / 4.8) * 60));
}

export function formatWalkTime(km: number | null): string {
  if (km === null) return '—';
  return `${walkingMinutes(km)} min walk`;
}

/** Bounding box around a set of points, padded a little. */
export function boundsOf(points: LatLng[], pad = 0.004) {
  if (points.length === 0) return null;
  let minLat = points[0].latitude;
  let maxLat = points[0].latitude;
  let minLng = points[0].longitude;
  let maxLng = points[0].longitude;
  for (const p of points) {
    minLat = Math.min(minLat, p.latitude);
    maxLat = Math.max(maxLat, p.latitude);
    minLng = Math.min(minLng, p.longitude);
    maxLng = Math.max(maxLng, p.longitude);
  }
  return [
    [minLng - pad, minLat - pad],
    [maxLng + pad, maxLat + pad],
  ] as [[number, number], [number, number]];
}

/** Deep-link into whatever maps app the device has. */
export function directionsUrl(to: LatLng, from?: LatLng | null): string {
  const dest = `${to.latitude},${to.longitude}`;
  const origin = from ? `&origin=${from.latitude},${from.longitude}` : '';
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}${origin}&travelmode=walking`;
}

/** Turn-by-turn deep link through every stop of a route. */
export function routeDirectionsUrl(stops: LatLng[]): string {
  if (stops.length === 0) return 'https://www.google.com/maps';
  const destination = stops[stops.length - 1];
  const waypoints = stops
    .slice(0, -1)
    .map((s) => `${s.latitude},${s.longitude}`)
    .join('|');
  const wp = waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : '';
  return `https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}${wp}&travelmode=walking`;
}
