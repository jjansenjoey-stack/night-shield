import { getProvider } from './dataProvider';
import type { Badge } from '@/types';

/*
 * What each contribution is worth.
 *
 * Deliberately small. A workshop place is meant to represent weeks of actually
 * turning up in the city, not one busy evening — so the cheapest course costs
 * roughly a first weekend of taking part, and the priciest costs a season.
 * Earning and prices are tuned together; changing one without the other breaks
 * the ladder. Kept in one place so it stays tunable.
 */
export const POINTS = {
  submit_feedback: 4,
  rsvp_event: 2,
  attend_event: 8,
  event_feedback: 6,
  submit_content: 10,
  complete_route: 12,
  save_first_item: 2,
  /*
   * Two Weeks Only. Placing is the largest single award on the board because it
   * is the most work — you make something, carry it across town and fix it
   * down. Collecting is worth real points too, and that is deliberate: without
   * it the route slowly turns into fly-tipping with a nicer name.
   */
  place_art: 14,
  collect_art: 6,
  /*
   * Walking an art route again, once a week at most.
   *
   * Deliberately the smallest award on the board. Walking the changing route a
   * second time is a real experience — the work in the spots has moved on — but
   * it costs nothing to do and must never become a way to farm the currency.
   * One a week caps it at 52 a year against 364 for placing, so participating
   * stays worth roughly seven times more than looking.
   *
   * The first completion of any route still pays complete_route; this is only
   * for coming back.
   */
  walk_art_route: 1,
  /*
   * Finding a hidden piece someone else left. Small: the walk is the reward,
   * and it must never be worth more than making the thing in the first place.
   */
  find_art: 3,
} as const;

export type PointsReason = keyof typeof POINTS;

export const BADGES = {
  first_steps: 'First Steps',
  night_walker: 'Night Walker',
  local_voice: 'Local Voice',
  regular: 'Regular',
  contributor: 'Contributor',
  connector: 'Connector',
} as const;

/**
 * What the points are proposed to be spendable on, beyond workshop places.
 *
 * None of these are built: nothing in the app draws a route for you, opens
 * RSVPs a day early, runs an open call or seats anybody at a round table.
 * They are the argument the concept is making about what a city could offer,
 * and the profile says so rather than announcing them as unlocked — a demo
 * that quietly promises a seat at a municipal table is making a claim it
 * cannot keep. Workshop places are the one reward that genuinely works, and
 * they are on the Workshops page.
 */
export const REWARD_TIERS = [
  { points: 20, name: 'Route creator', detail: 'Draw and publish your own route.' },
  { points: 60, name: 'Early access', detail: 'RSVP to workshops a day before they open.' },
  { points: 130, name: 'Guest curator', detail: 'Pitch an installation for the next open call.' },
  { points: 250, name: 'City partner', detail: 'A seat at the quarterly Inclusivity round table.' },
] as const;

/**
 * Award the points for one contribution.
 *
 * `subjectId` is the thing being earned against — the event, the route, the
 * location. It is what makes the award idempotent: rating the same place
 * twice, or re-walking one route, pays once. Without it a user could sit on a
 * button and buy any workshop in the catalogue in a minute.
 *
 * The amount is deliberately NOT passed. On Supabase the price list lives in
 * award_points_for() and the client only names a reason, so a forged request
 * cannot ask for more than the action is worth.
 */
export async function addPoints(
  userId: string,
  reason: PointsReason,
  subjectId?: string | null,
  period?: string | null,
): Promise<number> {
  const provider = await getProvider();
  return provider.awardPoints(userId, reason, subjectId ?? null, period ?? null);
}

/**
 * The ISO week a date falls in, as "2026-W36".
 *
 * Used as the `period` on repeatable awards: the same contribution pays once
 * per week rather than once ever. ISO weeks start on Monday and belong to the
 * year containing their Thursday, which is why the year is taken from the
 * adjusted date rather than from the input.
 */
export function isoWeek(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Shift to the Thursday of this week; that is what names the ISO year.
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export async function getPoints(userId: string): Promise<number> {
  const provider = await getProvider();
  return provider.getPoints(userId);
}

export async function awardBadge(userId: string, badgeName: string): Promise<Badge | null> {
  const provider = await getProvider();
  return provider.awardBadge(userId, badgeName);
}

export async function getUserRewards(userId: string) {
  const provider = await getProvider();
  const [points, badges] = await Promise.all([
    provider.getPoints(userId),
    provider.getBadges(userId),
  ]);
  return {
    points,
    badges,
    unlocked: REWARD_TIERS.filter((tier) => points >= tier.points),
    next: REWARD_TIERS.find((tier) => points < tier.points) ?? null,
  };
}

/** Which experiences a balance has unlocked. */
export function unlockExperience(points: number, experienceType: string): boolean {
  const tier = REWARD_TIERS.find((t) => t.name === experienceType);
  return tier ? points >= tier.points : false;
}
