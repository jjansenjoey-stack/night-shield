import { format, formatDistanceToNowStrict, isSameDay, isToday, isTomorrow } from 'date-fns';
import type { EventCategory, ItemType, RouteType, ThirdSpaceType, TimeOfDay } from '@/types';

export function initialsOf(name: string | null, email: string): string {
  const source = (name ?? '').trim() || email;
  const parts = source.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function formatEuros(amount: number): string {
  if (amount === 0) return 'Free';
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount);
}

export function formatEventDate(startIso: string, endIso?: string): string {
  const start = new Date(startIso);
  const dayLabel = isToday(start)
    ? 'Today'
    : isTomorrow(start)
      ? 'Tomorrow'
      : format(start, 'EEE d MMM');
  const timeLabel = format(start, 'HH:mm');
  if (!endIso) return `${dayLabel} · ${timeLabel}`;
  const end = new Date(endIso);
  const endLabel = isSameDay(start, end) ? format(end, 'HH:mm') : format(end, 'd MMM HH:mm');
  return `${dayLabel} · ${timeLabel}–${endLabel}`;
}

export function relativeTime(iso: string): string {
  return `${formatDistanceToNowStrict(new Date(iso))} ago`;
}

export function durationLabel(startIso: string, endIso: string): string {
  const minutes = Math.round(
    (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000,
  );
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  installation: 'Art',
  cache: 'Night Cache',
  route: 'Route',
  event: 'Event',
  third_space: 'Third space',
};

export const itemTypeLabel = (t: ItemType) => ITEM_TYPE_LABELS[t];

const ROUTE_TYPE_LABELS: Record<RouteType, string> = {
  safe: 'Safe route',
  exploration: 'Exploration',
  art_walk: 'Art walk',
};

export const routeTypeLabel = (t: RouteType) => ROUTE_TYPE_LABELS[t];

const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  workshop: 'Workshop',
  art_talk: 'Art talk',
  social: 'Social',
  nightlife: 'Nightlife',
};

export const eventCategoryLabel = (c: EventCategory) => EVENT_CATEGORY_LABELS[c];

const THIRD_SPACE_LABELS: Record<ThirdSpaceType, string> = {
  cafe: 'Café',
  library: 'Library',
  park: 'Park',
  community_centre: 'Community centre',
  studio: 'Studio',
};

export const thirdSpaceLabel = (t: ThirdSpaceType) => THIRD_SPACE_LABELS[t];

const TIME_OF_DAY_LABELS: Record<TimeOfDay, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  night: 'Night (after 8 PM)',
};

export const timeOfDayLabel = (t: TimeOfDay) => TIME_OF_DAY_LABELS[t];

export function currentTimeOfDay(date = new Date()): TimeOfDay {
  const h = date.getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 20) return 'evening';
  return 'night';
}

/** Human label for the accessibility tags stored on records. */
const A11Y_LABELS: Record<string, string> = {
  wheelchair: 'Wheelchair accessible',
  parking: 'Parking nearby',
  quiet: 'Quiet space',
  pet_friendly: 'Pet friendly',
  hearing_loop: 'Hearing loop',
  service_animal: 'Service animals welcome',
  step_free: 'Step-free access',
  well_lit: 'Well lit at night',
  gender_neutral_toilets: 'Gender-neutral toilets',
};

export const a11yLabel = (tag: string) => A11Y_LABELS[tag] ?? tag.replace(/_/g, ' ');

export const A11Y_TAGS = Object.keys(A11Y_LABELS);
