import { getProvider } from './dataProvider';
import { distanceKm } from '@/lib/geo';
import type {
  EventCategory,
  EventRsvp,
  LatLng,
  NightEvent,
  RsvpCounts,
  RsvpStatus,
} from '@/types';

export interface EventFilters {
  search?: string;
  categories?: EventCategory[];
  from?: Date | null;
  to?: Date | null;
  accessibility?: string[];
  maxDistanceKm?: number | null;
  origin?: LatLng | null;
  /** 'free' | 'under10' | 'paid' */
  cost?: 'free' | 'under10' | 'paid' | null;
  includePast?: boolean;
}

export async function getEvents(filters: EventFilters = {}): Promise<NightEvent[]> {
  const provider = await getProvider();
  const rows = await provider.getEvents();
  return applyEventFilters(rows, filters);
}

export function applyEventFilters(rows: NightEvent[], filters: EventFilters): NightEvent[] {
  const search = filters.search?.trim().toLowerCase();
  const now = Date.now();

  return rows
    .filter((row) => {
      const start = new Date(row.start_time).getTime();
      const end = new Date(row.end_time).getTime();

      if (!filters.includePast && end < now) return false;
      if (filters.from && end < filters.from.getTime()) return false;
      if (filters.to && start > filters.to.getTime()) return false;
      if (filters.categories?.length && !filters.categories.includes(row.category)) return false;

      if (filters.accessibility?.length) {
        if (!filters.accessibility.every((tag) => row.accessibility.includes(tag))) return false;
      }

      if (filters.cost === 'free' && row.cost_euros > 0) return false;
      if (filters.cost === 'under10' && row.cost_euros >= 10) return false;
      if (filters.cost === 'paid' && row.cost_euros === 0) return false;

      if (filters.maxDistanceKm != null && filters.origin) {
        // Virtual events have no location and are never distance-filtered out.
        if (row.location && distanceKm(filters.origin, row.location) > filters.maxDistanceKm) {
          return false;
        }
      }

      if (search) {
        const haystack = [row.title, row.description, row.category, row.organizer_name, row.address]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    })
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
}

export async function getEventById(id: string): Promise<NightEvent | null> {
  const provider = await getProvider();
  return provider.getEventById(id);
}

export async function createEvent(
  data: Omit<NightEvent, 'id' | 'created_at'>,
): Promise<NightEvent> {
  const provider = await getProvider();
  return provider.createEvent(data);
}

export async function updateEvent(id: string, patch: Partial<NightEvent>): Promise<NightEvent> {
  const provider = await getProvider();
  return provider.updateEvent(id, patch);
}

export async function deleteEvent(id: string): Promise<void> {
  const provider = await getProvider();
  return provider.deleteEvent(id);
}

// ---- RSVPs (prompt 48) ----------------------------------------------------

export async function getRsvpsForEvent(eventId: string): Promise<EventRsvp[]> {
  const provider = await getProvider();
  return provider.getRsvpsForEvent(eventId);
}

export async function getRsvpsForUser(userId: string): Promise<EventRsvp[]> {
  const provider = await getProvider();
  return provider.getRsvpsForUser(userId);
}

/**
 * Public attendance numbers. Not derived from a row listing — under RLS a
 * citizen can only see their own RSVPs, so counting rows would report every
 * event as empty.
 */
export async function getRsvpCounts(): Promise<Map<string, RsvpCounts>> {
  const provider = await getProvider();
  return provider.getRsvpCounts();
}

export async function getEventJoinUrl(eventId: string): Promise<string | null> {
  const provider = await getProvider();
  return provider.getEventJoinUrl(eventId);
}

export async function setRsvp(
  userId: string,
  eventId: string,
  status: RsvpStatus,
): Promise<EventRsvp> {
  const provider = await getProvider();
  return provider.setRsvp(userId, eventId, status);
}

export async function cancelRsvp(userId: string, eventId: string): Promise<void> {
  const provider = await getProvider();
  return provider.removeRsvp(userId, eventId);
}

export function countGoing(counts: Map<string, RsvpCounts>, eventId: string): number {
  return counts.get(eventId)?.going ?? 0;
}

export function isPast(event: NightEvent): boolean {
  return new Date(event.end_time).getTime() < Date.now();
}

export function spotsLeft(event: NightEvent, going: number): number | null {
  if (event.capacity == null) return null;
  return Math.max(0, event.capacity - going);
}

/** Validation shared by the create and edit forms (prompt 50). */
export function validateEvent(input: {
  title: string;
  start_time: string;
  end_time: string;
  is_virtual: boolean;
  virtual_url: string | null;
  location: LatLng | null;
  capacity: number | null;
  cost_euros: number;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.title.trim()) errors.title = 'Give the event a title.';
  if (!input.start_time) errors.start_time = 'Pick a start date and time.';
  if (!input.end_time) errors.end_time = 'Pick an end date and time.';

  if (input.start_time && input.end_time) {
    const start = new Date(input.start_time).getTime();
    const end = new Date(input.end_time).getTime();
    if (end <= start) errors.end_time = 'The event has to end after it starts.';
    if (start < Date.now()) errors.start_time = 'Events have to start in the future.';
  }

  if (input.is_virtual) {
    if (!input.virtual_url?.trim()) errors.virtual_url = 'Add the link people should join.';
  } else if (!input.location) {
    errors.location = 'Pick a location on the map.';
  }

  if (input.capacity != null && input.capacity < 1) errors.capacity = 'Capacity has to be at least 1.';
  if (input.cost_euros < 0) errors.cost_euros = 'Cost cannot be negative.';

  return errors;
}

/** Build a .ics file so an RSVP can be added to a device calendar (prompt 49). */
export function toIcs(event: NightEvent): string {
  const stamp = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const escape = (s: string) => s.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  const where = event.is_virtual ? (event.virtual_url ?? '') : (event.address ?? '');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Night Shield//Tilburg//EN',
    'BEGIN:VEVENT',
    `UID:${event.id}@night-shield.tilburg.nl`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(event.start_time)}`,
    `DTEND:${stamp(event.end_time)}`,
    `SUMMARY:${escape(event.title)}`,
    `DESCRIPTION:${escape(event.description ?? '')}`,
    `LOCATION:${escape(where)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
