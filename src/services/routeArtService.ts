import { getProvider } from './dataProvider';
import {
  daysUntilCollection,
  effectivePlacementStatus,
  PLACEMENT_DAYS,
  type LatLng,
  type Placement,
  type PlacementFind,
  type RouteSpot,
} from '@/types';

/**
 * Two Weeks Only — the changing route.
 *
 * Eight fixed spots on a loop through the city. Anyone can put a small piece
 * of work in a free one and earn points for it; two weeks later they have to
 * come back and take it home, or the municipality clears the spot for the next
 * person. The spots never move, so someone who walks the route regularly finds
 * different work in the same places every fortnight.
 *
 * The whole mechanic hangs on the deadline being honoured, which is why
 * collecting is worth points as well as placing.
 */

export const CHANGING_ROUTE_ID = 'route-two-weeks-only';

export { PLACEMENT_DAYS };

/** A spot with whatever is in it right now, if anything. */
export interface SpotBoardEntry {
  spot: RouteSpot;
  /** The piece currently on show. Null when the spot is free. */
  live: Placement | null;
  /** Past pieces, newest first — what this spot has held before. */
  history: Placement[];
  free: boolean;
  /** Days until the live piece is due back. Null when the spot is free. */
  daysLeft: number | null;
}

/**
 * How urgent the collection is, for colour and copy.
 *
 * `overdue` never appears on a live piece: once the deadline passes the piece
 * counts as removed and the spot reads as free, which is exactly what a walker
 * would find if they went and looked.
 */
export type Urgency = 'fresh' | 'due_soon' | 'due_now';

export function urgencyOf(daysLeft: number): Urgency {
  if (daysLeft <= 1) return 'due_now';
  if (daysLeft <= 4) return 'due_soon';
  return 'fresh';
}

export async function getSpots(routeId = CHANGING_ROUTE_ID): Promise<RouteSpot[]> {
  const provider = await getProvider();
  return provider.getRouteSpots(routeId);
}

export async function getPlacements(routeId = CHANGING_ROUTE_ID): Promise<Placement[]> {
  const provider = await getProvider();
  return provider.getPlacements(routeId);
}

/**
 * Build the board: every spot, what is in it, and what has been in it.
 *
 * `now` is a parameter rather than read inside, so the whole board is judged
 * against one instant. Calling new Date() per row means a piece can be live in
 * one column and expired in the next when the clock ticks mid-render.
 */
export function buildBoard(
  spots: RouteSpot[],
  placements: Placement[],
  now: Date = new Date(),
): SpotBoardEntry[] {
  const bySpot = new Map<string, Placement[]>();
  for (const placement of placements) {
    const list = bySpot.get(placement.spot_id);
    if (list) list.push(placement);
    else bySpot.set(placement.spot_id, [placement]);
  }

  return spots
    .slice()
    .sort((a, b) => a.number - b.number)
    .map((spot) => {
      const all = (bySpot.get(spot.id) ?? [])
        .slice()
        .sort((a, b) => Date.parse(b.placed_at) - Date.parse(a.placed_at));

      const live = all.find((p) => effectivePlacementStatus(p, now) === 'live') ?? null;

      return {
        spot,
        live,
        history: all.filter((p) => p !== live),
        free: live === null,
        daysLeft: live ? daysUntilCollection(live, now) : null,
      };
    });
}

/** Everything the signed-in person has out or has had out, newest first. */
export function myPlacements(placements: Placement[], userId: string | null): Placement[] {
  if (!userId) return [];
  return placements
    .filter((p) => p.user_id === userId)
    .sort((a, b) => Date.parse(b.placed_at) - Date.parse(a.placed_at));
}

/** The piece you currently have out, if any. Only one is allowed at a time. */
export function currentPlacement(
  placements: Placement[],
  userId: string | null,
  now: Date = new Date(),
): Placement | null {
  if (!userId) return null;
  return (
    placements.find(
      (p) => p.user_id === userId && effectivePlacementStatus(p, now) === 'live',
    ) ?? null
  );
}

export async function placeArt(
  userId: string,
  spotId: string,
  input: {
    title: string;
    description: string | null;
    materials: string | null;
    image_url: string | null;
    /** Set to hide the piece until somebody finds it. */
    hunt_clue?: string | null;
  },
): Promise<Placement> {
  const provider = await getProvider();
  return provider.placeArt(userId, spotId, { hunt_clue: null, ...input });
}

/**
 * Log finding a hidden piece. Returns the new points balance.
 *
 * The distance is checked by the backend against the spot, the same way a
 * cache find is.
 */
export async function logPlacementFind(
  userId: string,
  placementId: string,
  at: LatLng | null,
): Promise<number> {
  const provider = await getProvider();
  return provider.logPlacementFind(userId, placementId, at);
}

export async function getPlacementFinds(userId: string): Promise<PlacementFind[]> {
  const provider = await getProvider();
  return provider.getPlacementFinds(userId);
}

/** Everything ever placed, newest first — the gallery's source. */
export function galleryEntries(placements: Placement[]): Placement[] {
  return [...placements].sort((a, b) => Date.parse(b.placed_at) - Date.parse(a.placed_at));
}

export async function collectPlacement(
  userId: string,
  placementId: string,
): Promise<Placement> {
  const provider = await getProvider();
  return provider.collectPlacement(userId, placementId);
}
