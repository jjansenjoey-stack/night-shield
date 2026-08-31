import type { PostgrestError } from '@supabase/supabase-js';
import { requireSupabase } from './supabase';
import type { DataProvider } from './dataProvider';
import type {
  Badge,
  CommunitySubmission,
  Course,
  Enrolment,
  DiscoveryRoute,
  EventRsvp,
  Feedback,
  Installation,
  JourneyStage,
  LatLng,
  NightCache,
  NightEvent,
  Placement,
  PlacementFind,
  RouteSpot,
  CacheFind,
  RsvpCounts,
  SavedItem,
  SubmissionType,
  ThirdSpace,
  UserJourney,
  UserProfile,
} from '@/types';

/**
 * Supabase implementation of DataProvider.
 *
 * PostGIS `geography(Point, 4326)` columns are read through the `latitude` /
 * `longitude` generated columns declared in the migration, and written as
 * EWKT text, which Postgres casts on the way in.
 */

function fail(error: PostgrestError | null, what: string): never {
  throw new Error(`${what}: ${error?.message ?? 'unknown error'}`);
}

const toPoint = (p: LatLng | null | undefined): string | null =>
  p ? `SRID=4326;POINT(${p.longitude} ${p.latitude})` : null;

interface GeoRow {
  latitude: number | null;
  longitude: number | null;
}

function readPoint(row: GeoRow): LatLng | null {
  if (row.latitude === null || row.longitude === null) return null;
  return { latitude: row.latitude, longitude: row.longitude };
}

/** Rows come back with lat/lng split out; fold them back into `location`. */
function mapInstallation(row: Record<string, unknown> & GeoRow): Installation {
  const { latitude: _lat, longitude: _lng, ...rest } = row;
  return {
    ...(rest as unknown as Omit<Installation, 'location'>),
    location: readPoint(row) ?? { latitude: 0, longitude: 0 },
  };
}

function mapThirdSpace(row: Record<string, unknown> & GeoRow): ThirdSpace {
  const { latitude: _lat, longitude: _lng, ...rest } = row;
  return {
    ...(rest as unknown as Omit<ThirdSpace, 'location'>),
    location: readPoint(row) ?? { latitude: 0, longitude: 0 },
  };
}

function mapEvent(row: Record<string, unknown> & GeoRow): NightEvent {
  const { latitude: _lat, longitude: _lng, ...rest } = row;
  return {
    ...(rest as unknown as Omit<NightEvent, 'location' | 'virtual_url'>),
    location: readPoint(row),
    // Never selected. Fetched per-event through getEventJoinUrl() once the
    // caller has actually RSVP'd.
    virtual_url: null,
  };
}

interface RouteGeoRow {
  start_latitude: number | null;
  start_longitude: number | null;
  end_latitude: number | null;
  end_longitude: number | null;
}

function mapRoute(row: Record<string, unknown> & RouteGeoRow): DiscoveryRoute {
  const {
    start_latitude: sLat,
    start_longitude: sLng,
    end_latitude: eLat,
    end_longitude: eLng,
    ...rest
  } = row;
  return {
    ...(rest as unknown as Omit<DiscoveryRoute, 'start_location' | 'end_location'>),
    start_location: { latitude: sLat ?? 0, longitude: sLng ?? 0 },
    end_location: { latitude: eLat ?? 0, longitude: eLng ?? 0 },
  };
}

const INSTALLATION_COLS =
  'id, title, artist, description, address, images, category, is_temporary, status, accessibility, created_by, moderation_status, created_at, latitude, longitude';
const ROUTE_COLS =
  'id, title, description, type, distance_km, estimated_time_minutes, stops, accessibility, created_by, moderation_status, created_at, start_latitude, start_longitude, end_latitude, end_longitude';
// virtual_url is deliberately absent: the column is revoked from anon and
// authenticated, and read only through public.event_join_url().
const EVENT_COLS =
  'id, title, description, category, address, start_time, end_time, capacity, cost_euros, organizer_id, organizer_name, image_url, accessibility, is_virtual, is_featured, updated_at, created_at, latitude, longitude';
const THIRD_SPACE_COLS =
  'id, name, type, description, address, hours_open, cost, accessibility, image_url, created_by, created_at, latitude, longitude';
const CACHE_COLS =
  'id, title, hint, story, area, difficulty, points, image_url, accessibility, night_only, question, created_at, latitude, longitude';
const COURSE_COLS =
  'id, title, provider, description, certificate, format, discipline, level, points_cost, cash_cost_euros, sessions, hours_total, starts_on, address, image_url, accessibility, capacity, materials_included, created_at, latitude, longitude';
const FEEDBACK_COLS =
  'id, location_id, kind, time_of_day, safety_perception, comment, is_anonymous, created_at';

async function loadProfile(userId: string): Promise<UserProfile> {
  const sb = requireSupabase();
  const { data, error } = await sb.from('users').select('*').eq('id', userId).single();
  if (error) fail(error, 'Could not load profile');
  return data as UserProfile;
}

export const supabaseProvider: DataProvider = {
  kind: 'supabase',

  // ---- auth -------------------------------------------------------------

  async signUp(email, password) {
    const sb = requireSupabase();
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('Sign up did not return a user.');

    // The users row is created by a trigger (see migration 0001). Upsert as a
    // safety net so a project without the trigger still works.
    await sb
      .from('users')
      .upsert(
        { id: data.user.id, email: data.user.email, role: 'citizen' },
        { onConflict: 'id', ignoreDuplicates: true },
      );
    return loadProfile(data.user.id);
  },

  async signIn(email, password) {
    const sb = requireSupabase();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('Invalid email or password.');
    return loadProfile(data.user.id);
  },

  async signOut() {
    const { error } = await requireSupabase().auth.signOut();
    if (error) throw new Error(error.message);
  },

  async getCurrentUser() {
    const sb = requireSupabase();
    const { data } = await sb.auth.getUser();
    if (!data.user) return null;
    return loadProfile(data.user.id);
  },

  async requestPasswordReset(email) {
    const { error } = await requireSupabase().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw new Error(error.message);
  },

  async updatePassword(newPassword) {
    const { error } = await requireSupabase().auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
  },

  async updateProfile(userId, patch) {
    const sb = requireSupabase();
    const { data, error } = await sb.from('users').update(patch).eq('id', userId).select().single();
    if (error) fail(error, 'Could not save profile');
    return data as UserProfile;
  },

  // ---- installations ----------------------------------------------------

  async getInstallations() {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from('installations')
      .select(INSTALLATION_COLS)
      .eq('status', 'active')
      .eq('moderation_status', 'approved');
    if (error) fail(error, 'Could not load installations');
    return (data ?? []).map((r) => mapInstallation(r as never));
  },

  async getInstallationById(id) {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from('installations')
      .select(INSTALLATION_COLS)
      .eq('id', id)
      .maybeSingle();
    if (error) fail(error, 'Could not load installation');
    return data ? mapInstallation(data as never) : null;
  },

  async createInstallation(input) {
    const sb = requireSupabase();
    const { location, ...rest } = input;
    const { data, error } = await sb
      .from('installations')
      .insert({ ...rest, location: toPoint(location) })
      .select(INSTALLATION_COLS)
      .single();
    if (error) fail(error, 'Could not create installation');
    return mapInstallation(data as never);
  },

  async updateInstallation(id, patch) {
    const sb = requireSupabase();
    const { location, ...rest } = patch;
    const payload = location ? { ...rest, location: toPoint(location) } : rest;
    const { data, error } = await sb
      .from('installations')
      .update(payload)
      .eq('id', id)
      .select(INSTALLATION_COLS)
      .single();
    if (error) fail(error, 'Could not update installation');
    return mapInstallation(data as never);
  },

  async deleteInstallation(id) {
    const { error } = await requireSupabase().from('installations').delete().eq('id', id);
    if (error) fail(error, 'Could not delete installation');
  },

  // ---- routes -----------------------------------------------------------

  async getRoutes() {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from('routes')
      .select(ROUTE_COLS)
      .eq('moderation_status', 'approved');
    if (error) fail(error, 'Could not load routes');
    return (data ?? []).map((r) => mapRoute(r as never));
  },

  async getRouteById(id) {
    const sb = requireSupabase();
    const { data, error } = await sb.from('routes').select(ROUTE_COLS).eq('id', id).maybeSingle();
    if (error) fail(error, 'Could not load route');
    return data ? mapRoute(data as never) : null;
  },

  async createRoute(input) {
    const sb = requireSupabase();
    const { start_location, end_location, ...rest } = input;
    const { data, error } = await sb
      .from('routes')
      .insert({
        ...rest,
        start_location: toPoint(start_location),
        end_location: toPoint(end_location),
      })
      .select(ROUTE_COLS)
      .single();
    if (error) fail(error, 'Could not create route');
    return mapRoute(data as never);
  },

  async updateRoute(id, patch) {
    const sb = requireSupabase();
    const { start_location, end_location, ...rest } = patch;
    const payload: Record<string, unknown> = { ...rest };
    if (start_location) payload.start_location = toPoint(start_location);
    if (end_location) payload.end_location = toPoint(end_location);
    const { data, error } = await sb
      .from('routes')
      .update(payload)
      .eq('id', id)
      .select(ROUTE_COLS)
      .single();
    if (error) fail(error, 'Could not update route');
    return mapRoute(data as never);
  },

  async deleteRoute(id) {
    const { error } = await requireSupabase().from('routes').delete().eq('id', id);
    if (error) fail(error, 'Could not delete route');
  },

  // ---- events -----------------------------------------------------------

  async getEvents() {
    const sb = requireSupabase();
    const { data, error } = await sb.from('events').select(EVENT_COLS).order('start_time');
    if (error) fail(error, 'Could not load events');
    return (data ?? []).map((r) => mapEvent(r as never));
  },

  async getEventById(id) {
    const sb = requireSupabase();
    const { data, error } = await sb.from('events').select(EVENT_COLS).eq('id', id).maybeSingle();
    if (error) fail(error, 'Could not load event');
    return data ? mapEvent(data as never) : null;
  },

  async createEvent(input) {
    const sb = requireSupabase();
    const { location, ...rest } = input;
    const { data, error } = await sb
      .from('events')
      .insert({ ...rest, location: toPoint(location) })
      .select(EVENT_COLS)
      .single();
    if (error) fail(error, 'Could not create event');
    return mapEvent(data as never);
  },

  async updateEvent(id, patch) {
    const sb = requireSupabase();
    const { location, ...rest } = patch;
    const payload: Record<string, unknown> = { ...rest, updated_at: new Date().toISOString() };
    if (location !== undefined) payload.location = toPoint(location);
    const { data, error } = await sb
      .from('events')
      .update(payload)
      .eq('id', id)
      .select(EVENT_COLS)
      .single();
    if (error) fail(error, 'Could not update event');
    return mapEvent(data as never);
  },

  async deleteEvent(id) {
    const { error } = await requireSupabase().from('events').delete().eq('id', id);
    if (error) fail(error, 'Could not delete event');
  },

  // ---- third spaces -----------------------------------------------------

  async getThirdSpaces() {
    const sb = requireSupabase();
    const { data, error } = await sb.from('third_spaces').select(THIRD_SPACE_COLS);
    if (error) fail(error, 'Could not load third spaces');
    return (data ?? []).map((r) => mapThirdSpace(r as never));
  },

  async getThirdSpaceById(id) {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from('third_spaces')
      .select(THIRD_SPACE_COLS)
      .eq('id', id)
      .maybeSingle();
    if (error) fail(error, 'Could not load third space');
    return data ? mapThirdSpace(data as never) : null;
  },

  async createThirdSpace(input) {
    const sb = requireSupabase();
    const { location, ...rest } = input;
    const { data, error } = await sb
      .from('third_spaces')
      .insert({ ...rest, location: toPoint(location) })
      .select(THIRD_SPACE_COLS)
      .single();
    if (error) fail(error, 'Could not create third space');
    return mapThirdSpace(data as never);
  },

  async updateThirdSpace(id, patch) {
    const sb = requireSupabase();
    const { location, ...rest } = patch;
    const payload = location ? { ...rest, location: toPoint(location) } : rest;
    const { data, error } = await sb
      .from('third_spaces')
      .update(payload)
      .eq('id', id)
      .select(THIRD_SPACE_COLS)
      .single();
    if (error) fail(error, 'Could not update third space');
    return mapThirdSpace(data as never);
  },

  // ---- saved items ------------------------------------------------------

  async getUserSavedItems(userId) {
    const sb = requireSupabase();
    const { data, error } = await sb.from('user_saved').select('*').eq('user_id', userId);
    if (error) fail(error, 'Could not load saved items');
    return (data ?? []) as SavedItem[];
  },

  async saveItem(userId, itemType, itemId) {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from('user_saved')
      .upsert(
        { user_id: userId, item_type: itemType, item_id: itemId },
        { onConflict: 'user_id,item_type,item_id' },
      )
      .select()
      .single();
    if (error) fail(error, 'Could not save item');
    return data as SavedItem;
  },

  async unsaveItem(userId, itemType, itemId) {
    const { error } = await requireSupabase()
      .from('user_saved')
      .delete()
      .eq('user_id', userId)
      .eq('item_type', itemType)
      .eq('item_id', itemId);
    if (error) fail(error, 'Could not remove saved item');
  },

  // ---- feedback ---------------------------------------------------------

  async submitFeedback(input) {
    const sb = requireSupabase();
    // `public.feedback` is write-only to everyone but moderators, so an
    // `insert ... returning` would be rejected by RLS. The RPC inserts and
    // hands back the sanitised row, and decides anonymity server-side.
    const { data, error } = await sb.rpc('submit_feedback', {
      p_location_id: input.location_id,
      p_kind: input.kind,
      p_time_of_day: input.time_of_day,
      p_safety: input.safety_perception,
      p_comment: input.comment,
      p_anonymous: input.is_anonymous,
    });
    if (error) throw new Error(`Could not submit feedback: ${error.message}`);
    return { ...(data as object), user_id: null } as Feedback;
  },

  async getAllFeedback() {
    const sb = requireSupabase();
    // The view drops user_id, so aggregate safety data can be public.
    const { data, error } = await sb.from('feedback_public').select(FEEDBACK_COLS);
    if (error) fail(error, 'Could not load feedback');
    return (data ?? []).map((row) => ({ ...(row as object), user_id: null }) as Feedback);
  },

  async getFeedbackForLocation(locationId) {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from('feedback_public')
      .select(FEEDBACK_COLS)
      .eq('location_id', locationId);
    if (error) fail(error, 'Could not load feedback');
    return (data ?? []).map((row) => ({ ...(row as object), user_id: null }) as Feedback);
  },

  // ---- points & badges --------------------------------------------------

  async awardPoints(_userId, reason, subjectId, period) {
    const sb = requireSupabase();
    // No user id and no amount: the server reads the caller from the JWT and
    // looks the value up itself (award_points_for, migration 0003). Passing
    // either from here is what let a forged request mint its own currency.
    const { data, error } = await sb.rpc('award_points_for', {
      reason,
      subject: subjectId,
      period,
    });
    if (error) throw new Error(`Could not add points: ${error.message}`);
    return (data as number) ?? 0;
  },

  async getPoints(userId) {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from('user_points')
      .select('points_balance')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) fail(error, 'Could not load points');
    return (data?.points_balance as number) ?? 0;
  },

  async awardBadge(userId, badgeName) {
    const sb = requireSupabase();
    // user_badges has no INSERT policy on purpose — a badge you can grant
    // yourself is not a badge. This RPC is the only writer.
    const { data, error } = await sb.rpc('award_badge', {
      target_user: userId,
      badge: badgeName,
    });
    if (error) throw new Error(`Could not award badge: ${error.message}`);
    return (data as Badge) ?? null;
  },

  async getBadges(userId) {
    const sb = requireSupabase();
    const { data, error } = await sb.from('user_badges').select('*').eq('user_id', userId);
    if (error) fail(error, 'Could not load badges');
    return (data ?? []) as Badge[];
  },

  // ---- rsvps ------------------------------------------------------------

  async getRsvpsForUser(userId) {
    const sb = requireSupabase();
    const { data, error } = await sb.from('event_rsvps').select('*').eq('user_id', userId);
    if (error) fail(error, 'Could not load your RSVPs');
    return (data ?? []) as EventRsvp[];
  },

  async getRsvpsForEvent(eventId) {
    const sb = requireSupabase();
    const { data, error } = await sb.from('event_rsvps').select('*').eq('event_id', eventId);
    if (error) fail(error, 'Could not load RSVPs');
    return (data ?? []) as EventRsvp[];
  },

  async getRsvpCounts() {
    const sb = requireSupabase();
    // Reading event_rsvps directly would be filtered by RLS down to the
    // caller's own rows, so every event would look empty. The aggregate view
    // is readable by everyone and exposes counts without names.
    const { data, error } = await sb
      .from('event_rsvp_counts')
      .select('event_id, going, interested');
    if (error) fail(error, 'Could not load attendance');

    const counts = new Map<string, RsvpCounts>();
    for (const row of (data ?? []) as Array<{
      event_id: string;
      going: number | null;
      interested: number | null;
    }>) {
      counts.set(row.event_id, {
        going: Number(row.going ?? 0),
        interested: Number(row.interested ?? 0),
      });
    }
    return counts;
  },

  async getEventJoinUrl(eventId) {
    const sb = requireSupabase();
    // events.virtual_url is revoked at column level; this is the only reader,
    // and it checks for a 'going' RSVP first.
    const { data, error } = await sb.rpc('event_join_url', { event: eventId });
    if (error) throw new Error(`Could not get the join link: ${error.message}`);
    return (data as string | null) ?? null;
  },

  async claimAttendance(userId, eventId, code) {
    const sb = requireSupabase();
    void userId; // the server reads the claimant from the JWT
    // The code is compared against a column the client never receives, the
    // start time and the RSVP are checked there too, and the amount comes off
    // the event row. Nothing here is trusted.
    const { data, error } = await sb.rpc('claim_attendance', {
      target_event: eventId,
      given_code: code,
    });
    if (error) throw new Error(error.message);
    return (data as number) ?? 0;
  },

  async setRsvp(userId, eventId, status) {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from('event_rsvps')
      .upsert(
        { user_id: userId, event_id: eventId, rsvp_status: status },
        { onConflict: 'user_id,event_id' },
      )
      .select()
      .single();
    if (error) fail(error, 'Could not RSVP');
    return data as EventRsvp;
  },

  async removeRsvp(userId, eventId) {
    const { error } = await requireSupabase()
      .from('event_rsvps')
      .delete()
      .eq('user_id', userId)
      .eq('event_id', eventId);
    if (error) fail(error, 'Could not cancel RSVP');
  },

  // ---- night caches -----------------------------------------------------

  async getCaches() {
    const sb = requireSupabase();
    // caches_public, not caches — the base table holds the quiz answers.
    const { data, error } = await sb.from('caches_public').select(CACHE_COLS);
    if (error) fail(error, 'Could not load Night Caches');
    return (data ?? []).map((row) => {
      const { latitude: _lat, longitude: _lng, ...rest } = row as never as GeoRow &
        Record<string, unknown>;
      return {
        ...(rest as unknown as Omit<NightCache, 'location' | 'answers'>),
        location: readPoint(row as never) ?? { latitude: 0, longitude: 0 },
        answers: [], // never sent to the client; checked server-side
      } as NightCache;
    });
  },

  async getCacheFinds(userId) {
    const sb = requireSupabase();
    const { data, error } = await sb.from('cache_finds').select('*').eq('user_id', userId);
    if (error) fail(error, 'Could not load your finds');
    return (data ?? []) as CacheFind[];
  },

  async getCacheFindCounts() {
    const sb = requireSupabase();
    const { data, error } = await sb.from('cache_find_counts').select('cache_id, finds');
    if (error) fail(error, 'Could not load find counts');

    const counts = new Map<string, number>();
    for (const row of (data ?? []) as Array<{ cache_id: string; finds: number | null }>) {
      counts.set(row.cache_id, Number(row.finds ?? 0));
    }
    return counts;
  },

  async logCacheFind(userId, cacheId, method, at, answer) {
    const sb = requireSupabase();
    void userId; // the server uses auth.uid(), never a client-supplied id
    const { data, error } = await sb.rpc('log_cache_find', {
      target_cache: cacheId,
      method,
      at_latitude: at?.latitude ?? null,
      at_longitude: at?.longitude ?? null,
      given_answer: answer,
    });
    if (error) throw new Error(error.message);
    return data as CacheFind;
  },

  // ---- grow: courses bought with points ---------------------------------

  async getCourses() {
    const sb = requireSupabase();
    const { data, error } = await sb.from('courses').select(COURSE_COLS).order('starts_on');
    if (error) fail(error, 'Could not load courses');
    return (data ?? []).map((row) => {
      const { latitude: _lat, longitude: _lng, ...rest } = row as never as GeoRow &
        Record<string, unknown>;
      return {
        ...(rest as unknown as Omit<Course, 'location'>),
        location: readPoint(row as never),
      } as Course;
    });
  },

  async getEnrolments(userId) {
    const sb = requireSupabase();
    const { data, error } = await sb.from('enrolments').select('*').eq('user_id', userId);
    if (error) fail(error, 'Could not load your courses');
    return (data ?? []) as Enrolment[];
  },

  async getEnrolmentCounts() {
    const sb = requireSupabase();
    const { data, error } = await sb.from('enrolment_counts').select('course_id, taken');
    if (error) fail(error, 'Could not load course places');

    const counts = new Map<string, number>();
    for (const row of (data ?? []) as Array<{ course_id: string; taken: number | null }>) {
      counts.set(row.course_id, Number(row.taken ?? 0));
    }
    return counts;
  },

  async enrolInCourse(userId, courseId) {
    const sb = requireSupabase();
    void userId; // the server uses auth.uid()
    // One transaction checks the start date, the remaining capacity and the
    // balance, then debits and books. None of that is safe to split up.
    const { data, error } = await sb.rpc('enrol_in_course', { target_course: courseId });
    if (error) throw new Error(error.message);
    return data as Enrolment;
  },

  async cancelEnrolment(userId, courseId) {
    const sb = requireSupabase();
    void userId;
    const { error } = await sb.rpc('cancel_enrolment', { target_course: courseId });
    if (error) throw new Error(error.message);
  },

  // ---- two weeks only: art on the changing route -------------------------

  async getRouteSpots(routeId) {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from('route_spots')
      .select('id, route_id, number, label, hint, latitude, longitude, max_size_cm, accessibility')
      .eq('route_id', routeId)
      .order('number');
    if (error) throw new Error(`Could not load the spots: ${error.message}`);
    return (data ?? []).map((row) => ({
      id: row.id,
      route_id: row.route_id,
      number: row.number,
      label: row.label,
      hint: row.hint,
      location: { latitude: row.latitude, longitude: row.longitude },
      max_size_cm: row.max_size_cm,
      accessibility: row.accessibility ?? [],
    })) as RouteSpot[];
  },

  async getPlacements(routeId) {
    const sb = requireSupabase();
    // A view, not the table: it joins through route_spots so the filter can be
    // by route, and it leaves out anything a reader has no business seeing.
    const { data, error } = await sb
      .from('placements_public')
      .select(
        'id, spot_id, user_id, maker_name, title, description, materials, image_url, placed_at, collect_by, status, collected_at, hunt_clue, find_count',
      )
      .eq('route_id', routeId)
      .order('placed_at', { ascending: false });
    if (error) throw new Error(`Could not load what is out there: ${error.message}`);
    return (data ?? []) as Placement[];
  },

  async placeArt(userId, spotId, input) {
    const sb = requireSupabase();
    void userId; // the server uses auth.uid()
    // Occupancy, the one-piece-at-a-time rule and the deadline are all set
    // inside the function, under a row lock on the spot.
    const { data, error } = await sb.rpc('place_art', {
      target_spot: spotId,
      p_title: input.title,
      p_description: input.description,
      p_materials: input.materials,
      p_image_url: input.image_url,
      p_hunt_clue: input.hunt_clue,
    });
    if (error) throw new Error(error.message);
    return data as Placement;
  },

  async getPlacementFinds(userId) {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from('placement_finds')
      .select('id, placement_id, user_id, found_at')
      .eq('user_id', userId);
    if (error) throw new Error(`Could not load your finds: ${error.message}`);
    return (data ?? []) as PlacementFind[];
  },

  async logPlacementFind(userId, placementId, at) {
    const sb = requireSupabase();
    void userId; // the server reads the finder from the JWT
    // The distance is re-measured server-side against the spot's own geography.
    const { data, error } = await sb.rpc('log_placement_find', {
      target_placement: placementId,
      at_latitude: at?.latitude ?? null,
      at_longitude: at?.longitude ?? null,
    });
    if (error) throw new Error(error.message);
    return (data as number) ?? 0;
  },

  async collectPlacement(userId, placementId) {
    const sb = requireSupabase();
    void userId;
    const { data, error } = await sb.rpc('collect_placement', { target_placement: placementId });
    if (error) throw new Error(error.message);
    return data as Placement;
  },

  // ---- community submissions -------------------------------------------

  async submitContent(type: SubmissionType, submittedBy, submitterName, content) {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from('community_submissions')
      .insert({
        submission_type: type,
        submitted_by: submittedBy,
        submitter_name: submitterName,
        content,
      })
      .select()
      .single();
    if (error) fail(error, 'Could not submit');
    return data as CommunitySubmission;
  },

  async getPendingSubmissions() {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from('community_submissions')
      .select('*')
      .eq('moderation_status', 'pending')
      .order('created_at');
    if (error) fail(error, 'Could not load the moderation queue');
    return (data ?? []) as CommunitySubmission[];
  },

  async getSubmissionsByUser(userId) {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from('community_submissions')
      .select('*')
      .eq('submitted_by', userId);
    if (error) fail(error, 'Could not load your submissions');
    return (data ?? []) as CommunitySubmission[];
  },

  async approveSubmission(id, moderatorId) {
    const sb = requireSupabase();
    // Promotion into the live table happens in a DB function so it runs
    // atomically under the moderator's own privileges.
    const { data, error } = await sb.rpc('approve_submission', {
      submission: id,
      moderator: moderatorId,
    });
    if (error) throw new Error(`Could not approve: ${error.message}`);
    return data as CommunitySubmission;
  },

  async rejectSubmission(id, moderatorId, notes) {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from('community_submissions')
      .update({
        moderation_status: 'rejected',
        moderation_notes: notes,
        moderated_by: moderatorId,
        moderated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) fail(error, 'Could not reject submission');
    return data as CommunitySubmission;
  },

  // ---- journey ----------------------------------------------------------

  async initializeJourney(userId) {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from('user_journey')
      .upsert(
        { user_id: userId, current_stage: 'discovered', discovered_at: new Date().toISOString() },
        { onConflict: 'user_id', ignoreDuplicates: true },
      )
      .select()
      .maybeSingle();
    if (error) fail(error, 'Could not start journey');
    if (data) return data as UserJourney;

    const existing = await this.getUserJourneyProgress(userId);
    if (!existing) throw new Error('Could not start journey');
    return existing;
  },

  async getUserJourneyProgress(userId) {
    const sb = requireSupabase();
    const { data, error } = await sb
      .from('user_journey')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) fail(error, 'Could not load journey');
    return (data as UserJourney) ?? null;
  },

  async advanceStage(userId, stage: JourneyStage) {
    const sb = requireSupabase();
    const { data, error } = await sb.rpc('advance_journey_stage', {
      target_user: userId,
      stage_name: stage,
    });
    if (error) throw new Error(`Could not advance journey: ${error.message}`);
    return data as UserJourney;
  },
};
