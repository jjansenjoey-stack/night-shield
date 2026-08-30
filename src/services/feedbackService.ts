import { getProvider } from './dataProvider';
import type { Feedback, FeedbackKind, SafetySummary, TimeOfDay } from '@/types';

/** Below this many reports we show nothing rather than a misleading score. */
export const MIN_REPORTS_FOR_SCORE = 3;

export async function submitFeedback(input: {
  userId: string | null;
  locationId: string;
  timeOfDay: TimeOfDay;
  safetyPerception: number;
  comment?: string | null;
  isAnonymous?: boolean;
  /** 'event' ratings are kept out of the map's safety scores. */
  kind?: FeedbackKind;
}): Promise<Feedback> {
  const provider = await getProvider();
  return provider.submitFeedback({
    user_id: input.isAnonymous === false ? input.userId : null,
    location_id: input.locationId,
    kind: input.kind ?? 'safety',
    time_of_day: input.timeOfDay,
    safety_perception: input.safetyPerception,
    comment: input.comment ?? null,
    is_anonymous: input.isAnonymous ?? true,
  });
}

export async function getFeedbackForLocation(locationId: string): Promise<Feedback[]> {
  const provider = await getProvider();
  return provider.getFeedbackForLocation(locationId);
}

export async function getAllFeedback(): Promise<Feedback[]> {
  const provider = await getProvider();
  return provider.getAllFeedback();
}

/**
 * Roll raw reports up into one summary per location (prompt 37).
 *
 * Only 'safety' rows count. A five-star review of a screenprinting workshop is
 * not a statement about whether the street outside feels safe.
 */
export function summariseFeedback(rows: Feedback[]): Map<string, SafetySummary> {
  const byLocation = new Map<string, Feedback[]>();
  for (const row of rows) {
    if (row.kind !== 'safety') continue;
    const list = byLocation.get(row.location_id);
    if (list) list.push(row);
    else byLocation.set(row.location_id, [row]);
  }

  const summaries = new Map<string, SafetySummary>();
  for (const [locationId, list] of byLocation) {
    const total = list.reduce((sum, r) => sum + r.safety_perception, 0);
    const night = list.filter((r) => r.time_of_day === 'night');
    const nightTotal = night.reduce((sum, r) => sum + r.safety_perception, 0);
    summaries.set(locationId, {
      locationId,
      average: total / list.length,
      count: list.length,
      nightAverage: night.length >= MIN_REPORTS_FOR_SCORE ? nightTotal / night.length : null,
      nightCount: night.length,
    });
  }
  return summaries;
}

/** Only surface a score once enough people have reported. */
export function hasEnoughReports(summary: SafetySummary | undefined): boolean {
  return Boolean(summary && summary.count >= MIN_REPORTS_FOR_SCORE);
}

export type SafetyBand = 'low' | 'medium' | 'high';

export function safetyBand(score: number): SafetyBand {
  if (score < 2.5) return 'low';
  if (score < 3.5) return 'medium';
  return 'high';
}

/** Colour *and* a word — colour is never the only signal (prompt 45). */
export const SAFETY_BAND_META: Record<SafetyBand, { color: string; label: string }> = {
  low: { color: '#ef476f', label: 'Often feels unsafe' },
  medium: { color: '#ffd166', label: 'Mixed reports' },
  high: { color: '#06d6a0', label: 'Usually feels safe' },
};

/** Aggregate trend over time. */
export function getSafetyTrends(rows: Feedback[], days = 30) {
  const cutoff = Date.now() - days * 86400000;
  const buckets = new Map<string, { total: number; count: number }>();
  for (const row of rows) {
    if (new Date(row.created_at).getTime() < cutoff) continue;
    const day = row.created_at.slice(0, 10);
    const bucket = buckets.get(day) ?? { total: 0, count: 0 };
    bucket.total += row.safety_perception;
    bucket.count += 1;
    buckets.set(day, bucket);
  }
  return [...buckets.entries()]
    .map(([day, b]) => ({ day, average: b.total / b.count, reports: b.count }))
    .sort((a, b) => a.day.localeCompare(b.day));
}
