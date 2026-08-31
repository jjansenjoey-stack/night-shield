import type { DataProvider } from './dataProvider';
import {
  SEED_ADMIN_ID,
  seedCaches,
  seedCourses,
  seedEvents,
  seedFeedback,
  seedInstallations,
  seedPlacements,
  seedRouteSpots,
  seedRoutes,
  seedThirdSpaces,
  seedUsers,
} from './seed';
import type {
  Badge,
  CommunitySubmission,
  DiscoveryRoute,
  EventRsvp,
  Feedback,
  Installation,
  JourneyStage,
  NightEvent,
  Course,
  Enrolment,
  NightCache,
  Placement,
  RouteSpot,
  CacheFind,
  RsvpCounts,
  RsvpStatus,
  SavedItem,
  SubmissionType,
  ThirdSpace,
  UserJourney,
  UserProfile,

} from '@/types';
import {
  CACHE_FIND_RADIUS_M,
  effectivePlacementStatus,
  PLACEMENT_DAYS,
  remoteCachePoints,
} from '@/types';
import { distanceKm } from '@/lib/geo';
import { isoWeek, POINTS } from './pointsService';


/**
 * Local, offline implementation of DataProvider.
 *
 * DEV ONLY. It exists so the app is runnable before a Supabase project is
 * wired up. Credentials are stored in localStorage with a non-cryptographic
 * digest — this is not, and must not be used as, real authentication.
 * Set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY to switch to real auth.
 */

const STORAGE_KEY = 'ns.localdb.v1';
const SESSION_KEY = 'ns.localsession.v1';

interface StoredUser extends UserProfile {
  password_digest: string;
}

interface Database {
  users: StoredUser[];
  installations: Installation[];
  routes: DiscoveryRoute[];
  events: NightEvent[];
  thirdSpaces: ThirdSpace[];
  saved: SavedItem[];
  feedback: Feedback[];
  badges: Badge[];
  rsvps: EventRsvp[];
  submissions: CommunitySubmission[];
  journeys: UserJourney[];
  caches: NightCache[];
  courses: Course[];
  enrolments: Enrolment[];
  cacheFinds: CacheFind[];
  /**
   * One row per points award, keyed by what it was earned against. Mirrors the
   * point_awards table in migration 0003 — it is what stops the same
   * contribution being banked twice.
   */
  pointAwards: PointAward[];
  routeSpots: RouteSpot[];
  placements: Placement[];
}

interface PointAward {
  user_id: string;
  reason: string;
  /** The event, route or location earned against; null for one-per-account. */
  subject_id: string | null;
  /** Set when the award repeats per period (an ISO week) rather than once. */
  period: string | null;
  amount: number;
  created_at: string;
}

/** Deterministic non-cryptographic digest. Sufficient for a dev fixture only. */
function digest(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function freshDatabase(): Database {
  return {
    users: seedUsers.map(({ password, ...user }) => ({
      ...user,
      password_digest: digest(password),
    })),
    installations: [...seedInstallations],
    routes: [...seedRoutes],
    events: [...seedEvents],
    thirdSpaces: [...seedThirdSpaces],
    saved: [],
    feedback: [...seedFeedback],
    badges: [],
    rsvps: ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((s, i) => ({
      id: `rsvp-seed-${s}`,
      user_id: `seed-attendee-${s}`,
      event_id: i < 4 ? 'evt-screenprint' : 'evt-night-walk',
      rsvp_status: 'going' as RsvpStatus,
      rsvped_at: new Date(Date.now() - i * 86400000).toISOString(),
    })),
    submissions: [],
    journeys: [],
    caches: [...seedCaches],
    courses: [...seedCourses],
    enrolments: [],
    cacheFinds: [],
    pointAwards: [],
    routeSpots: [...seedRouteSpots],
    placements: [...seedPlacements],
  };
}

let db: Database | null = null;

function load(): Database {
  if (db) return db;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Database;
      /*
       * An earlier build could write NaN into a balance by awarding an unknown
       * reason. NaN loses every comparison, so the account silently could not
       * afford anything ever again. Repair on read rather than leaving it.
       */
      for (const row of parsed.users ?? []) {
        if (!Number.isFinite(row.points)) row.points = 0;
      }
      // Merge in any seed rows added since the snapshot was written.
      db = {
        ...freshDatabase(),
        ...parsed,
        installations: resyncSeed(
          mergeSeed(parsed.installations, seedInstallations),
          seedInstallations,
          ['images'],
        ),
        routes: resyncSeed(mergeSeed(parsed.routes, seedRoutes), seedRoutes, [
          'stops',
          'distance_km',
          'estimated_time_minutes',
        ]),
        events: resyncSeed(
          mergeSeed(parsed.events, seedEvents),
          seedEvents,
          ['image_url', 'start_time', 'end_time'],
          // An organizer who edited a seeded event keeps their version.
          (row) => Boolean(row.updated_at),
        ),
        thirdSpaces: resyncSeed(
          mergeSeed(parsed.thirdSpaces, seedThirdSpaces),
          seedThirdSpaces,
          ['image_url'],
        ),
        caches: resyncSeed(mergeSeed(parsed.caches, seedCaches), seedCaches, [
          'image_url',
          'points',
        ]),
        courses: resyncSeed(mergeSeed(parsed.courses, seedCourses), seedCourses, [
          'image_url',
          'starts_on',
          'points_cost',
        ]),
        // Snapshots written before `kind` existed hold safety reports with no
        // kind at all. Without this backfill they would be filtered out of the
        // safety summary and every score on the map would vanish.
        feedback: (parsed.feedback ?? []).map((row) => ({ ...row, kind: row.kind ?? 'safety' })),
        // Snapshots predating the award ledger have no such key at all.
        pointAwards: parsed.pointAwards ?? [],
        // The spots were renumbered into walking order, so an existing snapshot
        // has to take the new numbers, labels and positions.
        routeSpots: resyncSeed(mergeSeed(parsed.routeSpots, seedRouteSpots), seedRouteSpots, [
          'number',
          'label',
          'hint',
          'location',
          'max_size_cm',
          'accessibility',
        ]),
        // Only seeded rows are touched, so a real maker's photo is never
        // overwritten by this.
        placements: resyncSeed(
          mergeSeed(parsed.placements, seedPlacements),
          seedPlacements,
          // spot_id too: the spots were renumbered into walking order, and a
          // snapshot holding the old mapping shows work in the wrong place and
          // reports free spots as taken.
          ['image_url', 'spot_id'],
        ),
      };
      return db;
    }
  } catch (error) {
    /*
     * A snapshot we cannot read must not silently destroy someone's finds,
     * enrolments and saved places — which is exactly what starting fresh and
     * persisting over the top does. Park the original under a backup key first
     * so it is recoverable, and say so rather than failing quietly.
     */
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) localStorage.setItem(`${STORAGE_KEY}.recovered`, raw);
    } catch {
      /* storage is refusing writes; nothing further we can do */
    }
    console.warn(
      `Night Shield: could not read the local snapshot, starting from the seed. ` +
        `The previous data is kept at "${STORAGE_KEY}.recovered".`,
      error,
    );
  }
  db = freshDatabase();
  persist();
  return db;
}

function mergeSeed<T extends { id: string }>(stored: T[] | undefined, seeds: T[]): T[] {
  const rows = stored ? [...stored] : [];
  const ids = new Set(rows.map((r) => r.id));
  for (const seed of seeds) if (!ids.has(seed.id)) rows.push(seed);
  return rows;
}

/**
 * Re-sync the presentation fields of seeded rows from the current seed.
 *
 * A snapshot in localStorage freezes whatever the seed said on first run, which
 * goes stale in two ways: photographs swapped in the seed never reach an
 * existing browser, and event dates generated as "today + 2" stay pinned to
 * that first day until the calendar empties out.
 *
 * Only the listed fields are touched, and only on rows that came from the seed
 * — anything the user created keeps everything it has.
 */
function resyncSeed<T extends { id: string }>(
  stored: T[],
  seeds: T[],
  fields: Array<keyof T>,
  skip?: (row: T) => boolean,
): T[] {
  const bySeed = new Map(seeds.map((s) => [s.id, s]));
  return stored.map((row) => {
    const seed = bySeed.get(row.id);
    if (!seed || skip?.(row)) return row;

    const patch: Partial<T> = {};
    for (const field of fields) patch[field] = seed[field];
    return { ...row, ...patch };
  });
}

function persist() {
  if (!db) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    /* storage full or blocked — the in-memory copy still works this session */
  }
}

/** Simulated latency so loading states are exercised in development. */
/*
 * Simulated latency so loading states get exercised in development. Skipped
 * under test: ninety milliseconds times a few hundred provider calls is a
 * minute of waiting to prove arithmetic.
 */
const LATENCY_MS = import.meta.env.MODE === 'test' ? 0 : 90;

const tick = <T>(value: T): Promise<T> =>
  LATENCY_MS === 0
    ? Promise.resolve(value)
    : new Promise((resolve) => setTimeout(() => resolve(value), LATENCY_MS));

function publicUser(user: StoredUser): UserProfile {
  const { password_digest: _digest, ...rest } = user;
  return rest;
}

function currentUserId(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function findUser(id: string): StoredUser {
  const user = load().users.find((u) => u.id === id);
  if (!user) throw new Error('User not found');
  return user;
}

export const localProvider: DataProvider = {
  kind: 'local',

  // ---- auth -------------------------------------------------------------

  async signUp(email, password) {
    const data = load();
    const normalized = email.trim().toLowerCase();
    if (data.users.some((u) => u.email.toLowerCase() === normalized)) {
      throw new Error('An account with this email already exists.');
    }
    if (password.length < 8) throw new Error('Password must be at least 8 characters.');

    const user: StoredUser = {
      id: uid('user'),
      email: normalized,
      full_name: null,
      pronouns: null,
      avatar_url: null,
      role: 'citizen',
      onboarding_preference: null,
      accessibility_needs: [],
      points: 0,
      created_at: new Date().toISOString(),
      password_digest: digest(password),
    };
    data.users.push(user);
    persist();
    localStorage.setItem(SESSION_KEY, user.id);
    return tick(publicUser(user));
  },

  async signIn(email, password) {
    const data = load();
    const user = data.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user || user.password_digest !== digest(password)) {
      throw new Error('Invalid email or password.');
    }
    localStorage.setItem(SESSION_KEY, user.id);
    return tick(publicUser(user));
  },

  async signOut() {
    localStorage.removeItem(SESSION_KEY);
    return tick(undefined);
  },

  async getCurrentUser() {
    const id = currentUserId();
    if (!id) return null;
    const user = load().users.find((u) => u.id === id);
    return user ? publicUser(user) : null;
  },

  async requestPasswordReset(email) {
    // Mirror Supabase: never reveal whether the address is registered.
    void email;
    return tick(undefined);
  },

  async updatePassword(newPassword) {
    const id = currentUserId();
    if (!id) throw new Error('Not signed in.');
    const user = findUser(id);
    user.password_digest = digest(newPassword);
    persist();
    return tick(undefined);
  },

  async updateProfile(userId, patch) {
    const user = findUser(userId);
    Object.assign(user, patch);
    persist();
    return tick(publicUser(user));
  },

  // ---- installations ----------------------------------------------------

  async getInstallations() {
    return tick(
      load().installations.filter(
        (i) => i.status === 'active' && i.moderation_status === 'approved',
      ),
    );
  },

  async getInstallationById(id) {
    return tick(load().installations.find((i) => i.id === id) ?? null);
  },

  async createInstallation(data) {
    const row: Installation = { ...data, id: uid('inst'), created_at: new Date().toISOString() };
    load().installations.push(row);
    persist();
    return tick(row);
  },

  async updateInstallation(id, patch) {
    const row = load().installations.find((i) => i.id === id);
    if (!row) throw new Error('Installation not found');
    Object.assign(row, patch);
    persist();
    return tick(row);
  },

  async deleteInstallation(id) {
    const data = load();
    data.installations = data.installations.filter((i) => i.id !== id);
    persist();
    return tick(undefined);
  },

  // ---- routes -----------------------------------------------------------

  async getRoutes() {
    return tick(load().routes.filter((r) => r.moderation_status === 'approved'));
  },

  async getRouteById(id) {
    return tick(load().routes.find((r) => r.id === id) ?? null);
  },

  async createRoute(data) {
    const row: DiscoveryRoute = {
      ...data,
      id: uid('route'),
      created_at: new Date().toISOString(),
    };
    load().routes.push(row);
    persist();
    return tick(row);
  },

  async updateRoute(id, patch) {
    const row = load().routes.find((r) => r.id === id);
    if (!row) throw new Error('Route not found');
    Object.assign(row, patch);
    persist();
    return tick(row);
  },

  async deleteRoute(id) {
    const data = load();
    data.routes = data.routes.filter((r) => r.id !== id);
    persist();
    return tick(undefined);
  },

  // ---- events -----------------------------------------------------------

  async getEvents() {
    return tick([...load().events]);
  },

  async getEventById(id) {
    return tick(load().events.find((e) => e.id === id) ?? null);
  },

  async createEvent(data) {
    const row: NightEvent = { ...data, id: uid('evt'), created_at: new Date().toISOString() };
    load().events.push(row);
    persist();
    return tick(row);
  },

  async updateEvent(id, patch) {
    const row = load().events.find((e) => e.id === id);
    if (!row) throw new Error('Event not found');
    Object.assign(row, patch, { updated_at: new Date().toISOString() });
    persist();
    return tick(row);
  },

  async deleteEvent(id) {
    const data = load();
    data.events = data.events.filter((e) => e.id !== id);
    persist();
    return tick(undefined);
  },

  // ---- third spaces -----------------------------------------------------

  async getThirdSpaces() {
    return tick([...load().thirdSpaces]);
  },

  async getThirdSpaceById(id) {
    return tick(load().thirdSpaces.find((t) => t.id === id) ?? null);
  },

  async createThirdSpace(data) {
    const row: ThirdSpace = { ...data, id: uid('ts'), created_at: new Date().toISOString() };
    load().thirdSpaces.push(row);
    persist();
    return tick(row);
  },

  async updateThirdSpace(id, patch) {
    const row = load().thirdSpaces.find((t) => t.id === id);
    if (!row) throw new Error('Third space not found');
    Object.assign(row, patch);
    persist();
    return tick(row);
  },

  // ---- saved items ------------------------------------------------------

  async getUserSavedItems(userId) {
    return tick(load().saved.filter((s) => s.user_id === userId));
  },

  async saveItem(userId, itemType, itemId) {
    const data = load();
    const existing = data.saved.find(
      (s) => s.user_id === userId && s.item_type === itemType && s.item_id === itemId,
    );
    if (existing) return tick(existing);
    const row: SavedItem = {
      id: uid('saved'),
      user_id: userId,
      item_type: itemType,
      item_id: itemId,
      saved_at: new Date().toISOString(),
    };
    data.saved.push(row);
    persist();
    return tick(row);
  },

  async unsaveItem(userId, itemType, itemId) {
    const data = load();
    data.saved = data.saved.filter(
      (s) => !(s.user_id === userId && s.item_type === itemType && s.item_id === itemId),
    );
    persist();
    return tick(undefined);
  },

  // ---- feedback ---------------------------------------------------------

  async submitFeedback(input) {
    const row: Feedback = { ...input, id: uid('fb'), created_at: new Date().toISOString() };
    load().feedback.push(row);
    persist();
    return tick(row);
  },

  async getAllFeedback() {
    return tick([...load().feedback]);
  },

  async getFeedbackForLocation(locationId) {
    return tick(load().feedback.filter((f) => f.location_id === locationId));
  },

  // ---- points & badges --------------------------------------------------

  async awardPoints(userId, reason, subjectId, period) {
    const db = load();
    const user = findUser(userId);

    /*
     * The window is decided here, not by the caller — same as
     * award_points_for() in migration 0005. A client free to name its own
     * period could pass a different string every call and turn a
     * once-a-week award into an unlimited one.
     */
    const effectivePeriod = reason === 'walk_art_route' ? isoWeek() : null;
    void period;

    // Same rule the server enforces: one award per user, reason, subject and
    // period. A repeat is a no-op that reports the balance, not an error — a
    // double tap should look like nothing happened, not like a failure.
    const already = db.pointAwards.some(
      (a) =>
        a.user_id === userId &&
        a.reason === reason &&
        a.subject_id === (subjectId ?? null) &&
        (a.period ?? null) === effectivePeriod,
    );
    if (already) return tick(user.points);

    /*
     * An unknown reason has to throw, exactly as award_points_for() does.
     *
     * Without this, POINTS[reason] is undefined, `user.points += undefined` is
     * NaN, and the balance is NaN from then on — every comparison against a
     * course price silently becomes false and the account is quietly bricked.
     * TypeScript cannot catch it: the reason arrives as a string from a caller
     * that may not be typed.
     */
    const amount = POINTS[reason];
    if (typeof amount !== 'number' || !Number.isFinite(amount)) {
      throw new Error(`Unknown points reason: ${reason}`);
    }

    db.pointAwards.push({
      user_id: userId,
      reason,
      subject_id: subjectId ?? null,
      period: effectivePeriod,
      amount,
      created_at: new Date().toISOString(),
    });
    user.points += amount;
    persist();
    return tick(user.points);
  },

  async getPoints(userId) {
    return tick(findUser(userId).points);
  },

  async awardBadge(userId, badgeName) {
    const data = load();
    if (data.badges.some((b) => b.user_id === userId && b.badge_name === badgeName)) {
      return tick(null);
    }
    const row: Badge = {
      id: uid('badge'),
      user_id: userId,
      badge_name: badgeName,
      earned_at: new Date().toISOString(),
    };
    data.badges.push(row);
    persist();
    return tick(row);
  },

  async getBadges(userId) {
    return tick(load().badges.filter((b) => b.user_id === userId));
  },

  // ---- rsvps ------------------------------------------------------------

  async getRsvpsForUser(userId) {
    return tick(load().rsvps.filter((r) => r.user_id === userId));
  },

  async getRsvpsForEvent(eventId) {
    return tick(load().rsvps.filter((r) => r.event_id === eventId));
  },

  async getRsvpCounts() {
    const counts = new Map<string, RsvpCounts>();
    for (const row of load().rsvps) {
      const entry = counts.get(row.event_id) ?? { going: 0, interested: 0 };
      if (row.rsvp_status === 'going') entry.going += 1;
      else if (row.rsvp_status === 'interested') entry.interested += 1;
      counts.set(row.event_id, entry);
    }
    return tick(counts);
  },

  async getEventJoinUrl(eventId) {
    const data = load();
    const event = data.events.find((e) => e.id === eventId);
    if (!event?.virtual_url) return tick(null);

    // Mirrors the server rule: organizer, admin, or someone who is going.
    const userId = currentUserId();
    if (!userId) return tick(null);

    const me = data.users.find((u) => u.id === userId);
    const going = data.rsvps.some(
      (r) => r.event_id === eventId && r.user_id === userId && r.rsvp_status === 'going',
    );
    if (event.organizer_id === userId || me?.role === 'admin' || going) {
      return tick(event.virtual_url);
    }
    return tick(null);
  },

  async setRsvp(userId, eventId, status) {
    const data = load();
    const existing = data.rsvps.find((r) => r.user_id === userId && r.event_id === eventId);
    if (existing) {
      existing.rsvp_status = status;
      existing.rsvped_at = new Date().toISOString();
      persist();
      return tick(existing);
    }
    const row: EventRsvp = {
      id: uid('rsvp'),
      user_id: userId,
      event_id: eventId,
      rsvp_status: status,
      rsvped_at: new Date().toISOString(),
    };
    data.rsvps.push(row);
    persist();
    return tick(row);
  },

  async removeRsvp(userId, eventId) {
    const data = load();
    data.rsvps = data.rsvps.filter((r) => !(r.user_id === userId && r.event_id === eventId));
    persist();
    return tick(undefined);
  },

  // ---- night caches -----------------------------------------------------

  async getCaches() {
    return tick([...load().caches]);
  },

  async getCacheFinds(userId) {
    return tick(load().cacheFinds.filter((f) => f.user_id === userId));
  },

  async getCacheFindCounts() {
    const counts = new Map<string, number>();
    for (const find of load().cacheFinds) {
      counts.set(find.cache_id, (counts.get(find.cache_id) ?? 0) + 1);
    }
    return tick(counts);
  },

  async logCacheFind(userId, cacheId, method, at, answer) {
    const data = load();
    const cache = data.caches.find((c) => c.id === cacheId);
    if (!cache) throw new Error('That cache is not on the map any more.');

    const existing = data.cacheFinds.find(
      (f) => f.user_id === userId && f.cache_id === cacheId,
    );
    if (existing) return tick(existing);

    // Mirrors log_cache_find() so both backends accept and reject the same
    // things. Here the check is local because there is no server to ask.
    if (method === 'visited') {
      if (!at) throw new Error('We need your location to confirm you are there.');

      /*
       * NaN fails every comparison, so `NaN > 60` is false and a garbage
       * coordinate walks straight past a naive range check — claim any cache
       * in the city from your sofa. The coordinates have to be proved good
       * before the distance means anything.
       */
      if (!Number.isFinite(at.latitude) || !Number.isFinite(at.longitude)) {
        throw new Error('We could not work out where you are.');
      }

      const metres = distanceKm(at, cache.location) * 1000;
      if (!Number.isFinite(metres)) {
        throw new Error('We could not work out where you are.');
      }
      if (metres > CACHE_FIND_RADIUS_M) {
        throw new Error(`You are still ${Math.round(metres)} m away.`);
      }
    } else {
      const normalise = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();
      const given = normalise(answer ?? '');
      if (!given) throw new Error('Have a guess first.');
      if (!cache.answers.some((candidate) => normalise(candidate) === given)) {
        throw new Error('Not quite — look at the photo again.');
      }
    }

    const row: CacheFind = {
      id: uid('find'),
      user_id: userId,
      cache_id: cacheId,
      method,
      found_at: new Date().toISOString(),
    };
    data.cacheFinds.push(row);

    const user = data.users.find((u) => u.id === userId);
    if (user) user.points += method === 'visited' ? cache.points : remoteCachePoints(cache.points);

    persist();
    return tick(row);
  },

  // ---- two weeks only: art on the changing route -------------------------

  async getRouteSpots(routeId) {
    return tick(
      load()
        .routeSpots.filter((s) => s.route_id === routeId)
        .sort((a, b) => a.number - b.number),
    );
  },

  async getPlacements(routeId) {
    const data = load();
    const spotIds = new Set(
      data.routeSpots.filter((s) => s.route_id === routeId).map((s) => s.id),
    );
    return tick(data.placements.filter((p) => spotIds.has(p.spot_id)));
  },

  async placeArt(userId, spotId, input) {
    const data = load();
    const spot = data.routeSpots.find((s) => s.id === spotId);
    if (!spot) throw new Error('That spot is not on the route any more.');

    const now = new Date();

    // Mirrors place_art() in migration 0004, so both backends refuse the same
    // things. Occupancy is decided here, not by whatever the client last saw.
    const occupied = data.placements.some(
      (p) => p.spot_id === spotId && effectivePlacementStatus(p, now) === 'live',
    );
    if (occupied) throw new Error('Someone got to that spot first. Try another one.');

    // One piece at a time. Eight spots and no limit means one enthusiast can
    // hold the whole route for a fortnight.
    const alreadyOut = data.placements.find(
      (p) => p.user_id === userId && effectivePlacementStatus(p, now) === 'live',
    );
    if (alreadyOut) {
      throw new Error('You already have a piece out. Collect it before placing another.');
    }

    const collectBy = new Date(now);
    collectBy.setDate(collectBy.getDate() + PLACEMENT_DAYS);

    const user = findUser(userId);
    const placement: Placement = {
      id: uid('place'),
      spot_id: spotId,
      user_id: userId,
      maker_name: user.full_name ?? null,
      title: input.title,
      description: input.description,
      materials: input.materials,
      image_url: input.image_url,
      placed_at: now.toISOString(),
      collect_by: collectBy.toISOString(),
      status: 'live',
      collected_at: null,
    };
    data.placements.push(placement);
    persist();

    await this.awardPoints(userId, 'place_art', placement.id, null);
    return tick(placement);
  },

  async collectPlacement(userId, placementId) {
    const data = load();
    const placement = data.placements.find((p) => p.id === placementId);
    if (!placement) throw new Error('We cannot find that piece.');
    if (placement.user_id !== userId) throw new Error('That is not yours to collect.');

    const status = effectivePlacementStatus(placement);
    if (status === 'collected') return tick(placement);
    if (status === 'removed') {
      throw new Error(
        'The two weeks are up, so the municipality has already cleared this spot.',
      );
    }

    placement.status = 'collected';
    placement.collected_at = new Date().toISOString();
    persist();

    await this.awardPoints(userId, 'collect_art', placement.id, null);
    return tick(placement);
  },

  // ---- grow: courses bought with points ---------------------------------

  async getCourses() {
    return tick([...load().courses]);
  },

  async getEnrolments(userId) {
    return tick(load().enrolments.filter((e) => e.user_id === userId));
  },

  async getEnrolmentCounts() {
    const counts = new Map<string, number>();
    for (const row of load().enrolments) {
      if (row.status === 'cancelled') continue;
      counts.set(row.course_id, (counts.get(row.course_id) ?? 0) + 1);
    }
    return tick(counts);
  },

  async enrolInCourse(userId, courseId) {
    const data = load();
    const course = data.courses.find((c) => c.id === courseId);
    if (!course) throw new Error('That course is no longer listed.');

    const existing = data.enrolments.find(
      (e) => e.user_id === userId && e.course_id === courseId && e.status !== 'cancelled',
    );
    if (existing) return tick(existing);

    // Same three checks the server makes, in the same order.
    if (new Date(course.starts_on).getTime() < Date.now()) {
      throw new Error('That course has already started.');
    }

    const taken = data.enrolments.filter(
      (e) => e.course_id === courseId && e.status !== 'cancelled',
    ).length;
    if (taken >= course.capacity) throw new Error('That course is full.');

    const user = findUser(userId);
    if (user.points < course.points_cost) {
      throw new Error(
        `You need ${course.points_cost - user.points} more points for this one.`,
      );
    }

    user.points -= course.points_cost;
    const row: Enrolment = {
      id: uid('enrol'),
      user_id: userId,
      course_id: courseId,
      status: 'reserved',
      points_spent: course.points_cost,
      enrolled_at: new Date().toISOString(),
    };
    data.enrolments.push(row);
    persist();
    return tick(row);
  },

  async cancelEnrolment(userId, courseId) {
    const data = load();
    const row = data.enrolments.find(
      (e) => e.user_id === userId && e.course_id === courseId && e.status !== 'cancelled',
    );
    if (!row) return tick(undefined);

    const course = data.courses.find((c) => c.id === courseId);
    if (course && new Date(course.starts_on).getTime() < Date.now()) {
      throw new Error('That course has started — talk to the provider directly.');
    }

    row.status = 'cancelled';
    // Refund, so a change of plan does not cost someone their points.
    const user = data.users.find((u) => u.id === userId);
    if (user) user.points += row.points_spent;

    persist();
    return tick(undefined);
  },

  // ---- community submissions -------------------------------------------

  async submitContent(type: SubmissionType, submittedBy, submitterName, content) {
    const row: CommunitySubmission = {
      id: uid('sub'),
      submission_type: type,
      submitted_by: submittedBy,
      submitter_name: submitterName,
      content,
      moderation_status: 'pending',
      moderation_notes: null,
      moderated_by: null,
      created_at: new Date().toISOString(),
      moderated_at: null,
    };
    load().submissions.push(row);
    persist();
    return tick(row);
  },

  async getPendingSubmissions() {
    return tick(load().submissions.filter((s) => s.moderation_status === 'pending'));
  },

  async getSubmissionsByUser(userId) {
    return tick(load().submissions.filter((s) => s.submitted_by === userId));
  },

  async approveSubmission(id, moderatorId) {
    const data = load();
    const row = data.submissions.find((s) => s.id === id);
    if (!row) throw new Error('Submission not found');
    row.moderation_status = 'approved';
    row.moderated_by = moderatorId;
    row.moderated_at = new Date().toISOString();

    // Promote the payload into the live table it belongs to.
    if (row.submission_type === 'installation') {
      data.installations.push({
        ...(row.content as unknown as Installation),
        id: uid('inst'),
        created_by: row.submitted_by,
        moderation_status: 'approved',
        created_at: new Date().toISOString(),
      });
    } else if (row.submission_type === 'third_space') {
      data.thirdSpaces.push({
        ...(row.content as unknown as ThirdSpace),
        id: uid('ts'),
        created_by: row.submitted_by,
        created_at: new Date().toISOString(),
      });
    } else if (row.submission_type === 'event') {
      data.events.push({
        ...(row.content as unknown as NightEvent),
        id: uid('evt'),
        organizer_id: row.submitted_by,
        created_at: new Date().toISOString(),
      });
    }
    persist();
    return tick(row);
  },

  async rejectSubmission(id, moderatorId, notes) {
    const row = load().submissions.find((s) => s.id === id);
    if (!row) throw new Error('Submission not found');
    row.moderation_status = 'rejected';
    row.moderation_notes = notes;
    row.moderated_by = moderatorId;
    row.moderated_at = new Date().toISOString();
    persist();
    return tick(row);
  },

  // ---- journey ----------------------------------------------------------

  async initializeJourney(userId) {
    const data = load();
    const existing = data.journeys.find((j) => j.user_id === userId);
    if (existing) return tick(existing);
    const row: UserJourney = {
      user_id: userId,
      current_stage: 'discovered',
      discovered_at: new Date().toISOString(),
      explored_at: null,
      participated_at: null,
      connected_at: null,
      contributed_at: null,
      grown_at: null,
      belonged_at: null,
    };
    data.journeys.push(row);
    persist();
    return tick(row);
  },

  async getUserJourneyProgress(userId) {
    return tick(load().journeys.find((j) => j.user_id === userId) ?? null);
  },

  async advanceStage(userId, stage: JourneyStage) {
    const data = load();
    let row = data.journeys.find((j) => j.user_id === userId);
    if (!row) row = await this.initializeJourney(userId);

    const column = `${stage}_at` as keyof UserJourney;
    if (!row[column]) {
      (row as unknown as Record<string, string>)[column] = new Date().toISOString();
    }
    row.current_stage = stage;
    persist();
    return tick(row);
  },
};

/** Exposed for the settings menu — wipes local data back to the seed. */
export function resetLocalDatabase() {
  db = freshDatabase();
  persist();
  localStorage.removeItem(SESSION_KEY);
}

export const SEED_ADMIN = SEED_ADMIN_ID;
