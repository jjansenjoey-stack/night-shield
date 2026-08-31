/** Shared domain types for Night Shield. */

export type Role = 'citizen' | 'contributor' | 'organizer' | 'admin';

export type MentalityPreference = 'vigilant' | 'explorer' | 'both';

export type ItemType = 'installation' | 'route' | 'event' | 'third_space' | 'cache';

export type ModerationStatus = 'pending' | 'approved' | 'rejected';

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  pronouns: string | null;
  avatar_url: string | null;
  role: Role;
  onboarding_preference: MentalityPreference | null;
  accessibility_needs: string[];
  points: number;
  created_at: string;
}

export interface Installation {
  id: string;
  title: string;
  artist: string | null;
  description: string | null;
  location: LatLng;
  address: string | null;
  images: string[];
  category: string | null;
  is_temporary: boolean;
  status: 'active' | 'removed';
  accessibility: string[];
  created_by: string | null;
  moderation_status: ModerationStatus;
  created_at: string;
}

export type RouteType = 'safe' | 'exploration' | 'art_walk';

export interface RouteStop {
  order: number;
  title: string;
  note: string;
  image_url?: string;
  location: LatLng;
}

export interface DiscoveryRoute {
  id: string;
  title: string;
  description: string | null;
  type: RouteType;
  distance_km: number;
  estimated_time_minutes: number;
  start_location: LatLng;
  end_location: LatLng;
  stops: RouteStop[];
  accessibility: string[];
  created_by: string | null;
  moderation_status: ModerationStatus;
  created_at: string;
}

export type EventCategory = 'workshop' | 'art_talk' | 'social' | 'nightlife';

export interface NightEvent {
  id: string;
  title: string;
  description: string | null;
  category: EventCategory;
  location: LatLng | null;
  address: string | null;
  start_time: string;
  end_time: string;
  capacity: number | null;
  cost_euros: number;
  organizer_id: string | null;
  organizer_name: string | null;
  image_url: string | null;
  accessibility: string[];
  is_virtual: boolean;
  virtual_url: string | null;
  is_featured: boolean;
  /**
   * What turning up is worth, when the organizer wants to set it by hand.
   * Left unset, it is derived from how long the event runs — see
   * eventAttendancePoints(). Optional so the seed does not have to name it
   * seventeen times.
   */
  points_reward?: number | null;
  /**
   * Read out at the door so people can claim the attendance points. Never
   * reaches the browser on the real backend — the same treatment as cache
   * answers, and for the same reason: a code the client can read is not proof
   * of anything.
   */
  attendance_code?: string | null;
  updated_at: string | null;
  created_at: string;
}

/** Attendance is never worth less than this, or more. */
export const ATTENDANCE_POINTS_MIN = 4;
export const ATTENDANCE_POINTS_MAX = 14;

/**
 * What turning up to an event is worth.
 *
 * Longer and harder is worth more, but the ceiling is deliberately low: an
 * evening at a workshop should not out-earn making a piece of work and
 * carrying it across the city, which pays 14. Two points an hour on top of a
 * base of four puts a one-hour talk at 6 and a full-day session at the cap.
 *
 * An explicit points_reward wins, clamped to the same range so an organizer
 * cannot print currency by typing a big number into a form.
 */
export function eventAttendancePoints(event: {
  start_time: string;
  end_time: string;
  points_reward?: number | null;
}): number {
  const clamp = (n: number) =>
    Math.max(ATTENDANCE_POINTS_MIN, Math.min(ATTENDANCE_POINTS_MAX, Math.round(n)));

  if (typeof event.points_reward === 'number' && Number.isFinite(event.points_reward)) {
    return clamp(event.points_reward);
  }

  const hours = (Date.parse(event.end_time) - Date.parse(event.start_time)) / 3_600_000;
  if (!Number.isFinite(hours) || hours <= 0) return ATTENDANCE_POINTS_MIN;

  return clamp(ATTENDANCE_POINTS_MIN + hours * 2);
}

export type ThirdSpaceType = 'cafe' | 'library' | 'park' | 'community_centre' | 'studio';

export interface ThirdSpace {
  id: string;
  name: string;
  type: ThirdSpaceType;
  description: string | null;
  location: LatLng;
  address: string | null;
  hours_open: string | null;
  cost: string | null;
  accessibility: string[];
  image_url: string | null;
  created_by: string | null;
  created_at: string;
}

export interface SavedItem {
  id: string;
  user_id: string;
  item_type: ItemType;
  item_id: string;
  saved_at: string;
}

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

/**
 * A safety report and a post-event rating are both 1–5, but they mean
 * different things. Only 'safety' rows feed the map's safety scores.
 */
export type FeedbackKind = 'safety' | 'event';

export interface Feedback {
  id: string;
  user_id: string | null;
  location_id: string;
  kind: FeedbackKind;
  time_of_day: TimeOfDay;
  safety_perception: number; // 1-5
  comment: string | null;
  is_anonymous: boolean;
  created_at: string;
}

export interface RsvpCounts {
  going: number;
  interested: number;
}

// ---- Night Caches ---------------------------------------------------------

export type CacheDifficulty = 'easy' | 'medium' | 'hard';

/**
 * A small hidden marker somewhere in Tilburg — a detail of the city most
 * people walk past. Found by standing next to it, or by answering a question
 * about it from home.
 */
export interface NightCache {
  id: string;
  title: string;
  /** Shown before the find: enough to look for it, not enough to skip looking. */
  hint: string;
  /** Revealed once found — why this detail is here at all. */
  story: string;
  location: LatLng;
  area: string;
  difficulty: CacheDifficulty;
  points: number;
  image_url: string | null;
  accessibility: string[];
  /** True when the spot is only worth visiting after dark. */
  night_only: boolean;
  /** Answered from the photo and hint, for people who cannot make the trip. */
  question: string;
  /** Compared case- and whitespace-insensitively. */
  answers: string[];
  created_at: string;
}

export type FindMethod = 'visited' | 'answered';

export interface CacheFind {
  id: string;
  user_id: string;
  cache_id: string;
  method: FindMethod;
  found_at: string;
}

/** How close you have to be for the app to accept a physical find, in metres. */
export const CACHE_FIND_RADIUS_M = 60;

/** Answering from home is worth this share of the full reward. */
export const REMOTE_FIND_RATIO = 0.4;

export const remoteCachePoints = (points: number) =>
  Math.max(2, Math.round(points * REMOTE_FIND_RATIO));

// ---- Grow: courses you buy with points, not money -------------------------

export type CourseFormat = 'class' | 'certificate' | 'masterclass';
export type CourseLevel = 'beginner' | 'some_experience' | 'any';

/**
 * A paid artistic course whose price is points rather than euros.
 *
 * The point of the whole scheme: these normally cost real money, which is the
 * quietest way a city keeps its own cultural education for people who already
 * have it. Here they are bought with points earned by turning up — reporting a
 * street, walking a route, finding a cache, coming to an event. Participation
 * is the currency.
 */
export interface Course {
  id: string;
  title: string;
  provider: string;
  description: string;
  /** What you actually walk away holding, if anything. */
  certificate: string | null;
  format: CourseFormat;
  discipline: string;
  level: CourseLevel;
  points_cost: number;
  /** The open-market price, shown so the exchange is legible. */
  cash_cost_euros: number;
  sessions: number;
  hours_total: number;
  starts_on: string;
  location: LatLng | null;
  address: string | null;
  image_url: string | null;
  accessibility: string[];
  capacity: number;
  materials_included: boolean;
  created_at: string;
}

export type EnrolmentStatus = 'reserved' | 'completed' | 'cancelled';

export interface Enrolment {
  id: string;
  user_id: string;
  course_id: string;
  status: EnrolmentStatus;
  points_spent: number;
  enrolled_at: string;
}

export interface SafetySummary {
  locationId: string;
  average: number;
  count: number;
  nightAverage: number | null;
  nightCount: number;
}

export interface Badge {
  id: string;
  user_id: string;
  badge_name: string;
  earned_at: string;
}

export type SubmissionType = 'installation' | 'event' | 'third_space';

export interface CommunitySubmission {
  id: string;
  submission_type: SubmissionType;
  submitted_by: string;
  submitter_name: string | null;
  content: Record<string, unknown>;
  moderation_status: ModerationStatus;
  moderation_notes: string | null;
  moderated_by: string | null;
  created_at: string;
  moderated_at: string | null;
}

export type JourneyStage =
  | 'discovered'
  | 'explored'
  | 'participated'
  | 'connected'
  | 'contributed'
  | 'grown'
  | 'belonged';

export const JOURNEY_STAGES: JourneyStage[] = [
  'discovered',
  'explored',
  'participated',
  'connected',
  'contributed',
  'grown',
  'belonged',
];

export interface UserJourney {
  user_id: string;
  current_stage: JourneyStage;
  discovered_at: string | null;
  explored_at: string | null;
  participated_at: string | null;
  connected_at: string | null;
  contributed_at: string | null;
  grown_at: string | null;
  belonged_at: string | null;
}

export type RsvpStatus = 'going' | 'interested' | 'not_going';

export interface EventRsvp {
  id: string;
  user_id: string;
  event_id: string;
  rsvp_status: RsvpStatus;
  rsvped_at: string;
}

/** Anything that can be rendered as a marker / list row / detail modal. */
export interface MapItem {
  id: string;
  type: ItemType;
  title: string;
  subtitle: string | null;
  location: LatLng;
  image: string | null;
  accessibility: string[];
  raw: Installation | DiscoveryRoute | NightEvent | ThirdSpace | NightCache;
}

// ---- The Changing Route: art placed by anyone, for two weeks --------------

/**
 * One fixed, numbered spot on the changing route.
 *
 * The spots never move — the art in them does. That is the whole idea: a
 * walker learns the route once and finds different work in the same places
 * every fortnight.
 */
export interface RouteSpot {
  id: string;
  route_id: string;
  number: number;
  /** Where exactly, in words, so it can be found in the dark. */
  label: string;
  /** What suits this spot — a ledge, a fence, a plinth. */
  hint: string;
  location: LatLng;
  /** Longest side, in centimetres. Keeps a "small installation" small. */
  max_size_cm: number;
  accessibility: string[];
}

export type PlacementStatus = 'live' | 'collected' | 'removed';

export interface Placement {
  id: string;
  spot_id: string;
  user_id: string;
  maker_name: string | null;
  title: string;
  description: string | null;
  materials: string | null;
  image_url: string | null;
  placed_at: string;
  /** placed_at + PLACEMENT_DAYS. After this the municipality clears the spot. */
  collect_by: string;
  status: PlacementStatus;
  collected_at: string | null;
}

/** How long a piece may stay before it has to be taken home. */
export const PLACEMENT_DAYS = 14;

/**
 * Expiry is derived, never stored.
 *
 * A scheduled job that flips rows to 'removed' is one more thing to run, to
 * monitor and to get wrong; and if it ever stops, expired work quietly stays
 * "live" forever. Reading the deadline at render time cannot drift.
 */
export function effectivePlacementStatus(
  placement: Placement,
  now: Date = new Date(),
): PlacementStatus {
  if (placement.status !== 'live') return placement.status;
  return new Date(placement.collect_by).getTime() < now.getTime() ? 'removed' : 'live';
}

/** Whole days left before collection is due. Negative once it is overdue. */
export function daysUntilCollection(placement: Placement, now: Date = new Date()): number {
  const ms = new Date(placement.collect_by).getTime() - now.getTime();
  return Math.ceil(ms / 86_400_000);
}
