import { getProvider } from './dataProvider';
import type { Badge } from '@/types';

/** What each contribution is worth. Kept in one place so it stays tunable. */
export const POINTS = {
  submit_feedback: 10,
  rsvp_event: 5,
  attend_event: 20,
  event_feedback: 15,
  submit_content: 25,
  complete_route: 30,
  save_first_item: 5,
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

/** Rewards unlocked by points balance. */
export const REWARD_TIERS = [
  { points: 50, name: 'Route creator', detail: 'Draw and publish your own route.' },
  { points: 150, name: 'Early access', detail: 'RSVP to workshops a day before they open.' },
  { points: 300, name: 'Guest curator', detail: 'Pitch an installation for the next open call.' },
  { points: 500, name: 'City partner', detail: 'A seat at the quarterly Inclusivity round table.' },
] as const;

export async function addPoints(userId: string, reason: PointsReason): Promise<number> {
  const provider = await getProvider();
  return provider.addPoints(userId, POINTS[reason]);
}

export async function addRawPoints(userId: string, points: number): Promise<number> {
  const provider = await getProvider();
  return provider.addPoints(userId, points);
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
