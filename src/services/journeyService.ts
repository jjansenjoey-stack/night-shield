import { getProvider } from './dataProvider';
import { JOURNEY_STAGES, type JourneyStage, type UserJourney } from '@/types';

export const STAGE_LABELS: Record<JourneyStage, string> = {
  discovered: 'Discover',
  explored: 'Explore',
  participated: 'Participate',
  connected: 'Connect',
  contributed: 'Contribute',
  grown: 'Grow',
  belonged: 'Belong',
};

export const STAGE_BLURBS: Record<JourneyStage, string> = {
  discovered: 'You found Night Shield and opened the map.',
  explored: 'You walked a route or visited a place you had not been to.',
  participated: 'You showed up to something — an event, a workshop, a walk.',
  connected: 'You came back to a place, or met people there.',
  contributed: 'You added something: a report, a photo, a place.',
  grown: 'Others are using what you contributed.',
  belonged: 'This is your city, and the map has your fingerprints on it.',
};

export async function initializeJourney(userId: string): Promise<UserJourney> {
  const provider = await getProvider();
  return provider.initializeJourney(userId);
}

export async function getUserJourneyProgress(userId: string): Promise<UserJourney | null> {
  const provider = await getProvider();
  return provider.getUserJourneyProgress(userId);
}

export async function advanceStage(userId: string, stage: JourneyStage): Promise<UserJourney> {
  const provider = await getProvider();
  return provider.advanceStage(userId, stage);
}

/** Stages reached so far, in order. */
export function completedStages(journey: UserJourney | null): JourneyStage[] {
  if (!journey) return [];
  return JOURNEY_STAGES.filter((stage) => Boolean(journey[`${stage}_at` as keyof UserJourney]));
}

export function journeyProgress(journey: UserJourney | null): number {
  return completedStages(journey).length / JOURNEY_STAGES.length;
}

/**
 * Only ever move forward — advancing to a stage already behind the user is a
 * no-op, so revisiting the map does not reset someone's progress.
 */
export async function advanceIfAhead(
  userId: string,
  stage: JourneyStage,
  journey: UserJourney | null,
): Promise<UserJourney | null> {
  const reached = completedStages(journey);
  if (reached.includes(stage)) return journey;
  return advanceStage(userId, stage);
}
