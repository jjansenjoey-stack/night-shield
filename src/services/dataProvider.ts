import type { PointsReason } from './pointsService';
import type {
  Badge,
  CommunitySubmission,
  Course,
  Enrolment,
  DiscoveryRoute,
  EventRsvp,
  Feedback,
  FindMethod,
  Installation,
  LatLng,
  NightCache,
  CacheFind,
  ItemType,
  JourneyStage,
  NightEvent,
  Placement,
  PlacementFind,
  RouteSpot,
  RsvpCounts,
  RsvpStatus,
  SavedItem,
  SubmissionType,
  ThirdSpace,
  UserJourney,
  UserProfile,
} from '@/types';
import { isSupabaseConfigured } from './supabaseConfig';

/**
 * The single seam between the UI and its backend.
 *
 * Two implementations satisfy it: `supabaseProvider` (real Postgres + Auth)
 * and `localProvider` (seeded data in localStorage). Services never import a
 * concrete provider — they go through `getProvider()` below, so switching
 * backends is a matter of filling in .env.
 */
export interface DataProvider {
  readonly kind: 'supabase' | 'local';

  // ---- auth -------------------------------------------------------------
  signUp(email: string, password: string): Promise<UserProfile>;
  signIn(email: string, password: string): Promise<UserProfile>;
  signOut(): Promise<void>;
  getCurrentUser(): Promise<UserProfile | null>;
  requestPasswordReset(email: string): Promise<void>;
  updatePassword(newPassword: string): Promise<void>;
  updateProfile(userId: string, patch: Partial<UserProfile>): Promise<UserProfile>;

  // ---- installations ----------------------------------------------------
  getInstallations(): Promise<Installation[]>;
  getInstallationById(id: string): Promise<Installation | null>;
  createInstallation(data: Omit<Installation, 'id' | 'created_at'>): Promise<Installation>;
  updateInstallation(id: string, patch: Partial<Installation>): Promise<Installation>;
  deleteInstallation(id: string): Promise<void>;

  // ---- routes -----------------------------------------------------------
  getRoutes(): Promise<DiscoveryRoute[]>;
  getRouteById(id: string): Promise<DiscoveryRoute | null>;
  createRoute(data: Omit<DiscoveryRoute, 'id' | 'created_at'>): Promise<DiscoveryRoute>;
  updateRoute(id: string, patch: Partial<DiscoveryRoute>): Promise<DiscoveryRoute>;
  deleteRoute(id: string): Promise<void>;

  // ---- events -----------------------------------------------------------
  getEvents(): Promise<NightEvent[]>;
  getEventById(id: string): Promise<NightEvent | null>;
  createEvent(data: Omit<NightEvent, 'id' | 'created_at'>): Promise<NightEvent>;
  updateEvent(id: string, patch: Partial<NightEvent>): Promise<NightEvent>;
  deleteEvent(id: string): Promise<void>;

  // ---- third spaces -----------------------------------------------------
  getThirdSpaces(): Promise<ThirdSpace[]>;
  getThirdSpaceById(id: string): Promise<ThirdSpace | null>;
  createThirdSpace(data: Omit<ThirdSpace, 'id' | 'created_at'>): Promise<ThirdSpace>;
  updateThirdSpace(id: string, patch: Partial<ThirdSpace>): Promise<ThirdSpace>;

  // ---- saved items ------------------------------------------------------
  getUserSavedItems(userId: string): Promise<SavedItem[]>;
  saveItem(userId: string, itemType: ItemType, itemId: string): Promise<SavedItem>;
  unsaveItem(userId: string, itemType: ItemType, itemId: string): Promise<void>;

  // ---- feedback ---------------------------------------------------------
  submitFeedback(data: Omit<Feedback, 'id' | 'created_at'>): Promise<Feedback>;
  getAllFeedback(): Promise<Feedback[]>;
  getFeedbackForLocation(locationId: string): Promise<Feedback[]>;

  // ---- points & badges --------------------------------------------------
  /**
   * Award the points for one contribution and return the new balance.
   *
   * Takes a reason rather than an amount, and a subject to be idempotent
   * against, so the same contribution can never be banked twice.
   */
  awardPoints(
    userId: string,
    reason: PointsReason,
    subjectId: string | null,
    /**
     * Makes an award repeatable per period instead of once ever — an ISO week
     * for the walking reward. Null means once ever, which is the default for
     * everything else.
     */
    period: string | null,
  ): Promise<number>;
  getPoints(userId: string): Promise<number>;
  awardBadge(userId: string, badgeName: string): Promise<Badge | null>;
  getBadges(userId: string): Promise<Badge[]>;

  // ---- rsvps ------------------------------------------------------------
  getRsvpsForUser(userId: string): Promise<EventRsvp[]>;
  getRsvpsForEvent(eventId: string): Promise<EventRsvp[]>;
  /**
   * Public attendance numbers, keyed by event id.
   *
   * Deliberately *not* derived from a row listing: RLS only lets someone see
   * their own RSVPs, so counting rows client-side would report 0 going for
   * everyone else. Backed by an aggregate view.
   */
  getRsvpCounts(): Promise<Map<string, RsvpCounts>>;
  setRsvp(userId: string, eventId: string, status: RsvpStatus): Promise<EventRsvp>;
  removeRsvp(userId: string, eventId: string): Promise<void>;
  /** The join link for a virtual event — only for people who are going. */
  getEventJoinUrl(eventId: string): Promise<string | null>;
  /**
   * Claims the attendance points for an event, using the code given out at it.
   *
   * The code is the proof, and it is checked by the backend against a column
   * the client never receives. Everything else is checked there too: that the
   * event has actually started, and that the claimant said they were going.
   * Returns the new balance.
   */
  claimAttendance(userId: string, eventId: string, code: string): Promise<number>;

  // ---- night caches -----------------------------------------------------
  getCaches(): Promise<NightCache[]>;
  getCacheFinds(userId: string): Promise<CacheFind[]>;
  getCacheFindCounts(): Promise<Map<string, number>>;
  /**
   * Logs a find and awards the points for it.
   *
   * Both proofs are checked by the backend, never by the caller: `at` is the
   * reporter's position for a physical find and the distance is re-measured
   * server-side, and `answer` is compared against a column the client never
   * receives. A client that simply asserts "I am here" or "I got it right"
   * must not be believed.
   */
  logCacheFind(
    userId: string,
    cacheId: string,
    method: FindMethod,
    at: LatLng | null,
    answer: string | null,
  ): Promise<CacheFind>;

  // ---- two weeks only: art placed on the changing route -----------------
  getRouteSpots(routeId: string): Promise<RouteSpot[]>;
  /** Every placement for the route, including collected and expired ones. */
  getPlacements(routeId: string): Promise<Placement[]>;
  /**
   * Claims a free spot and records the piece.
   *
   * Whether the spot is actually free is decided by the backend, not the
   * caller: two people can tap "place here" on the same spot at once, and a
   * client that was told the spot was empty a minute ago is not evidence.
   */
  placeArt(
    userId: string,
    spotId: string,
    data: {
      title: string;
      description: string | null;
      materials: string | null;
      image_url: string | null;
      /** Set to hide the piece until somebody finds it. */
      hunt_clue: string | null;
    },
  ): Promise<Placement>;
  /**
   * Logs finding somebody else's hidden piece.
   *
   * The distance is measured by the backend against the spot, exactly as a
   * cache find is — a client saying "I am here" is not evidence of anything.
   */
  logPlacementFind(userId: string, placementId: string, at: LatLng | null): Promise<number>;
  /** Which hidden pieces this person has already found. */
  getPlacementFinds(userId: string): Promise<PlacementFind[]>;
  /** Marks your own piece as taken home, and pays for doing it. */
  collectPlacement(userId: string, placementId: string): Promise<Placement>;

  // ---- grow: courses bought with points ---------------------------------
  getCourses(): Promise<Course[]>;
  getEnrolments(userId: string): Promise<Enrolment[]>;
  getEnrolmentCounts(): Promise<Map<string, number>>;
  /**
   * Takes the place and debits the points, atomically.
   *
   * The balance and the remaining capacity are both checked by the backend —
   * a client that has been told "you can afford this" is not evidence that it
   * can, and two people can tap the last place at the same moment.
   */
  enrolInCourse(userId: string, courseId: string): Promise<Enrolment>;
  /** Refunds the points if the course has not started yet. */
  cancelEnrolment(userId: string, courseId: string): Promise<void>;

  // ---- community submissions -------------------------------------------
  submitContent(
    type: SubmissionType,
    submittedBy: string,
    submitterName: string | null,
    content: Record<string, unknown>,
  ): Promise<CommunitySubmission>;
  getPendingSubmissions(): Promise<CommunitySubmission[]>;
  getSubmissionsByUser(userId: string): Promise<CommunitySubmission[]>;
  approveSubmission(id: string, moderatorId: string): Promise<CommunitySubmission>;
  rejectSubmission(id: string, moderatorId: string, notes: string): Promise<CommunitySubmission>;

  // ---- journey ----------------------------------------------------------
  initializeJourney(userId: string): Promise<UserJourney>;
  getUserJourneyProgress(userId: string): Promise<UserJourney | null>;
  advanceStage(userId: string, stage: JourneyStage): Promise<UserJourney>;
}

let cached: DataProvider | null = null;

/**
 * Resolves the active provider once, lazily. Imported dynamically so the
 * Supabase bundle is only pulled in when it's actually configured.
 */
export async function getProvider(): Promise<DataProvider> {
  if (cached) return cached;
  // Static import: supabaseConfig only reads env vars, so it costs nothing.
  // The *providers* below are the expensive part, and those stay dynamic.
  if (isSupabaseConfigured) {
    const { supabaseProvider } = await import('./supabaseProvider');
    cached = supabaseProvider;
  } else {
    const { localProvider } = await import('./localProvider');
    cached = localProvider;
  }
  return cached;
}

/** Test/debug hook — lets a caller force one provider. */
export function setProvider(provider: DataProvider | null) {
  cached = provider;
}
