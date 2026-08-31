import { beforeEach, describe, expect, it } from 'vitest';

import { localProvider, resetLocalDatabase } from './localProvider';
import { addPoints, getPoints, isoWeek, POINTS } from './pointsService';
import { cancelEnrolment, enrolInCourse, getCourses } from './courseService';
import { claimAttendance, getEvents, setRsvp } from './eventService';
import {
  getCaches,
  isWithinFindRange,
  logCacheFind,
  metresAway,
} from './cacheService';
import {
  buildBoard,
  collectPlacement,
  currentPlacement,
  getPlacements,
  getSpots,
  logPlacementFind,
  placeArt,
} from './routeArtService';
import {
  ATTENDANCE_POINTS_MAX,
  ATTENDANCE_POINTS_MIN,
  CACHE_FIND_RADIUS_M,
  eventAttendancePoints,
  type Placement,
} from '@/types';

/*
 * The rules that decide what a contribution is worth, and what stops the same
 * one being banked twice.
 *
 * Every case here is a defect that actually shipped and was caught by hand in a
 * browser console. That is the reason the file exists: hand-testing found four
 * of these, and hand-testing is not repeatable. If one of these ever goes red,
 * someone is about to be able to buy a course for free — or to be locked out of
 * buying one at all.
 *
 * The suite runs against the local provider. Where a rule also lives in SQL the
 * comment says so, because a guard in one backend is not a guard.
 */

const USER = 'seed-user-organizer';

beforeEach(() => {
  resetLocalDatabase();
});

describe('the award ledger', () => {
  it('pays for a contribution once, however many times it is reported', async () => {
    const start = await getPoints(USER);

    await addPoints(USER, 'submit_feedback', 'inst-lochal-loom');
    const afterFirst = await getPoints(USER);
    expect(afterFirst).toBe(start + POINTS.submit_feedback);

    await addPoints(USER, 'submit_feedback', 'inst-lochal-loom');
    await addPoints(USER, 'submit_feedback', 'inst-lochal-loom');
    expect(await getPoints(USER)).toBe(afterFirst);
  });

  it('pays again for a different subject', async () => {
    await addPoints(USER, 'submit_feedback', 'inst-lochal-loom');
    const afterFirst = await getPoints(USER);

    await addPoints(USER, 'submit_feedback', 'inst-spoorpark-lightline');
    expect(await getPoints(USER)).toBe(afterFirst + POINTS.submit_feedback);
  });

  /*
   * The brick. POINTS[reason] was undefined, `balance += undefined` is NaN, and
   * NaN loses every comparison — so the account could never afford anything
   * again, silently and permanently.
   */
  it('refuses an unknown reason and leaves the balance untouched', async () => {
    const start = await getPoints(USER);

    await expect(
      // Deliberately not a PointsReason: this is what a stale caller sends.
      addPoints(USER, 'free_money' as never, 'anything'),
    ).rejects.toThrow(/unknown points reason/i);

    const after = await getPoints(USER);
    expect(after).toBe(start);
    expect(Number.isFinite(after)).toBe(true);
  });

  it('pays the walking reward once a week, and ignores a forged week', async () => {
    const start = await getPoints(USER);

    await addPoints(USER, 'walk_art_route', 'route-two-weeks-only', isoWeek());
    expect(await getPoints(USER)).toBe(start + POINTS.walk_art_route);

    // Same week again: nothing.
    await addPoints(USER, 'walk_art_route', 'route-two-weeks-only', isoWeek());
    // A caller naming its own window would otherwise uncap itself. The backend
    // picks the period; this argument is not trusted.
    await addPoints(USER, 'walk_art_route', 'route-two-weeks-only', '2099-W01');

    expect(await getPoints(USER)).toBe(start + POINTS.walk_art_route);
  });

  it('keeps each route on its own weekly allowance', async () => {
    const start = await getPoints(USER);
    await addPoints(USER, 'walk_art_route', 'route-two-weeks-only', isoWeek());
    await addPoints(USER, 'walk_art_route', 'route-dwaalgebied-art', isoWeek());
    expect(await getPoints(USER)).toBe(start + POINTS.walk_art_route * 2);
  });

  it('never lets walking out-earn taking part', () => {
    // 52 weeks of walking one route against a fortnightly place-and-collect.
    const walkingAYear = POINTS.walk_art_route * 52;
    const participatingAYear = (POINTS.place_art + POINTS.collect_art) * 26;
    expect(participatingAYear).toBeGreaterThan(walkingAYear * 5);
  });
});

describe('workshop places', () => {
  it('debits exactly the cost, and refunds exactly the cost', async () => {
    const courses = await getCourses();
    const affordable = courses.sort((a, b) => a.points_cost - b.points_cost)[0];
    const start = await getPoints(USER);

    await enrolInCourse(USER, affordable.id);
    expect(await getPoints(USER)).toBe(start - affordable.points_cost);

    await cancelEnrolment(USER, affordable.id);
    expect(await getPoints(USER)).toBe(start);
  });

  it('does not charge twice for the same place', async () => {
    const courses = await getCourses();
    const affordable = courses.sort((a, b) => a.points_cost - b.points_cost)[0];

    await enrolInCourse(USER, affordable.id);
    const afterFirst = await getPoints(USER);

    await enrolInCourse(USER, affordable.id).catch(() => null);
    expect(await getPoints(USER)).toBe(afterFirst);
  });

  it('refuses a place the balance cannot cover', async () => {
    const balance = await getPoints(USER);
    const courses = await getCourses();
    const tooDear = courses.find((c) => c.points_cost > balance);
    expect(tooDear, 'the seed needs a course nobody can afford yet').toBeTruthy();

    await expect(enrolInCourse(USER, tooDear!.id)).rejects.toThrow(/more points/i);
    expect(await getPoints(USER)).toBe(balance);
  });
});

describe('night cache finds', () => {
  it('treats the radius as inclusive, and the metre outside it as outside', async () => {
    const [cache] = await getCaches();
    const at = (dLat: number) => ({
      latitude: cache.location.latitude + dLat,
      longitude: cache.location.longitude,
    });

    // Sweep across the boundary rather than trusting one hand-picked offset.
    for (let metres = 55; metres <= 65; metres += 1) {
      const from = at(metres / 111_320);
      const measured = metresAway(cache, from);
      expect(measured).not.toBeNull();
      expect(isWithinFindRange(cache, from)).toBe(measured! <= CACHE_FIND_RADIUS_M);
    }
  });

  /*
   * NaN fails every comparison, so `metres > 60` was false and a garbage
   * coordinate logged a find from anywhere on earth. The SQL had the same hole
   * via NULL, which is likewise not greater than 60.
   */
  it.each([
    ['NaN', { latitude: Number.NaN, longitude: Number.NaN }],
    ['Infinity', { latitude: Number.POSITIVE_INFINITY, longitude: 0 }],
    ['non-numeric', { latitude: 'here' as unknown as number, longitude: 'there' as unknown as number }],
  ])('refuses a find with %s coordinates', async (_label, at) => {
    const [cache] = await getCaches();
    const start = await getPoints(USER);

    await expect(logCacheFind(USER, cache, 'visited', at)).rejects.toThrow();
    expect(await getPoints(USER)).toBe(start);
  });

  it('refuses a find with no location at all', async () => {
    const [cache] = await getCaches();
    await expect(logCacheFind(USER, cache, 'visited', null)).rejects.toThrow(/location/i);
  });

  it('pays for a find once', async () => {
    const [cache] = await getCaches();
    const start = await getPoints(USER);

    await logCacheFind(USER, cache, 'visited', cache.location);
    const afterFind = await getPoints(USER);
    expect(afterFind).toBe(start + cache.points);

    await logCacheFind(USER, cache, 'visited', cache.location);
    expect(await getPoints(USER)).toBe(afterFind);
  });
});

describe('two weeks only', () => {
  it('holds one live piece per spot', async () => {
    const board = buildBoard(await getSpots(), await getPlacements());
    const taken = board.find((entry) => !entry.free);
    expect(taken, 'the seed needs an occupied spot').toBeTruthy();

    await expect(
      placeArt(USER, taken!.spot.id, {
        title: 'Squeeze in',
        description: null,
        materials: null,
        image_url: null,
      }),
    ).rejects.toThrow(/first/i);
  });

  it('holds one live piece per person, and pays for placing and collecting', async () => {
    const board = buildBoard(await getSpots(), await getPlacements());
    const free = board.filter((entry) => entry.free);
    expect(free.length).toBeGreaterThan(1);

    const start = await getPoints(USER);
    await placeArt(USER, free[0].spot.id, {
      title: 'A test piece',
      description: null,
      materials: null,
      image_url: null,
    });
    expect(await getPoints(USER)).toBe(start + POINTS.place_art);

    // Eight spots and no per-person limit lets one enthusiast hold the route.
    await expect(
      placeArt(USER, free[1].spot.id, {
        title: 'And another',
        description: null,
        materials: null,
        image_url: null,
      }),
    ).rejects.toThrow(/already have a piece/i);

    const mine = currentPlacement(await getPlacements(), USER);
    expect(mine).toBeTruthy();

    await collectPlacement(USER, mine!.id);
    const afterCollect = await getPoints(USER);
    expect(afterCollect).toBe(start + POINTS.place_art + POINTS.collect_art);

    // A second tap is a no-op, not an error and not a second payment.
    await collectPlacement(USER, mine!.id);
    expect(await getPoints(USER)).toBe(afterCollect);
  });

  /*
   * The place/collect loop.
   *
   * Both awards used to be keyed on the placement id, and every new placement
   * has a new one — so place, collect, place, collect on a single spot paid its
   * full 14 + 6 every lap and never repeated a ledger key. Six laps took a few
   * seconds and paid 120; the dearest course in the catalogue costs 200.
   *
   * The week is the limit now, so the whole route is worth 20 once and then
   * nothing until Monday.
   */
  it('pays for placing and collecting once a week, however many laps you run', async () => {
    const spots = await getSpots();
    const start = await getPoints(USER);

    for (let lap = 0; lap < 5; lap += 1) {
      const live = new Set(
        (await getPlacements()).filter((p) => p.status === 'live').map((p) => p.spot_id),
      );
      const free = spots.find((spot) => !live.has(spot.id));
      expect(free, `lap ${lap} needs a free spot`).toBeTruthy();

      const made = await placeArt(USER, free!.id, {
        title: `lap ${lap}`,
        description: null,
        materials: null,
        image_url: null,
      });
      await collectPlacement(USER, made.id);
    }

    expect(await getPoints(USER)).toBe(start + POINTS.place_art + POINTS.collect_art);
  });

  it('refuses to collect someone else’s piece', async () => {
    const someoneElse = (await getPlacements()).find((p) => p.user_id !== USER);
    expect(someoneElse).toBeTruthy();
    await expect(collectPlacement(USER, someoneElse!.id)).rejects.toThrow(/not yours/i);
  });

  /*
   * Expiry is derived from collect_by at read time rather than swept by a job,
   * so an overdue piece frees its spot the moment the deadline passes — which
   * is what a walker would find if they went and looked.
   */
  it('frees a spot the moment its piece is overdue', async () => {
    const spots = await getSpots();
    const spot = spots[0];

    const overdue: Placement = {
      id: 'test-overdue',
      spot_id: spot.id,
      user_id: 'someone',
      maker_name: 'Someone',
      title: 'Left too long',
      description: null,
      materials: null,
      image_url: null,
      placed_at: new Date(Date.now() - 20 * 86_400_000).toISOString(),
      collect_by: new Date(Date.now() - 6 * 86_400_000).toISOString(),
      status: 'live',
      collected_at: null,
    };

    const board = buildBoard([spot], [overdue]);
    expect(board[0].free).toBe(true);
    expect(board[0].live).toBeNull();
    // It is still part of the spot's history, not deleted.
    expect(board[0].history).toHaveLength(1);
  });

  it('keeps a piece that is still inside its fortnight', async () => {
    const spots = await getSpots();
    const spot = spots[0];

    const live: Placement = {
      id: 'test-live',
      spot_id: spot.id,
      user_id: 'someone',
      maker_name: 'Someone',
      title: 'Still out',
      description: null,
      materials: null,
      image_url: null,
      placed_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      collect_by: new Date(Date.now() + 12 * 86_400_000).toISOString(),
      status: 'live',
      collected_at: null,
    };

    const board = buildBoard([spot], [live]);
    expect(board[0].free).toBe(false);
    expect(board[0].live?.id).toBe('test-live');
    expect(board[0].daysLeft).toBe(12);
  });
});

/*
 * Finding somebody else's hidden piece. This is the newest way to earn and the
 * only one with no test until now, which is exactly the combination that goes
 * wrong quietly: the guards were confirmed by hand in a console and nothing
 * would have noticed if an edit removed them.
 *
 * The distance check is the same shape as the Night Cache one and fails the
 * same way — a non-finite coordinate loses every comparison, so without a
 * finiteness check first, `metres > 60` is false and the find is logged from
 * anywhere at all.
 */
describe('finding a hidden piece', () => {
  async function hidden() {
    const spots = await getSpots();
    const piece = (await getPlacements()).find((p) => p.hunt_clue && p.status === 'live');
    expect(piece, 'the seed needs a hidden piece').toBeTruthy();
    const spot = spots.find((s) => s.id === piece!.spot_id);
    expect(spot, 'the hidden piece needs a spot that still exists').toBeTruthy();
    return { piece: piece!, spot: spot! };
  }

  it.each([
    ['NaN', { latitude: Number.NaN, longitude: Number.NaN }],
    ['Infinity', { latitude: Number.POSITIVE_INFINITY, longitude: 0 }],
    [
      'non-numeric',
      { latitude: 'here' as unknown as number, longitude: 'there' as unknown as number },
    ],
  ])('refuses a find with %s coordinates', async (_label, at) => {
    const { piece } = await hidden();
    const start = await getPoints(USER);

    await expect(logPlacementFind(USER, piece.id, at)).rejects.toThrow();
    expect(await getPoints(USER)).toBe(start);
  });

  it('refuses a find with no location at all', async () => {
    const { piece } = await hidden();
    await expect(logPlacementFind(USER, piece.id, null)).rejects.toThrow(/location/i);
  });

  it('refuses a find from outside the radius', async () => {
    const { piece, spot } = await hidden();
    const start = await getPoints(USER);

    // Amsterdam. Far enough that no rounding argument saves it.
    await expect(
      logPlacementFind(USER, piece.id, { latitude: 52.3676, longitude: 4.9041 }),
    ).rejects.toThrow(/away/i);
    expect(await getPoints(USER)).toBe(start);
    expect(spot.location).toBeTruthy();
  });

  it('pays for a find once, and never for your own piece', async () => {
    const { piece, spot } = await hidden();
    const start = await getPoints(USER);

    await logPlacementFind(USER, piece.id, spot.location);
    const afterFind = await getPoints(USER);
    expect(afterFind).toBe(start + POINTS.find_art);

    // Going back a second time is a no-op, not a second payment.
    await logPlacementFind(USER, piece.id, spot.location);
    expect(await getPoints(USER)).toBe(afterFind);

    // Hiding something and then "finding" it would pay for both halves.
    const free = buildBoard(await getSpots(), await getPlacements()).filter((e) => e.free);
    expect(free.length).toBeGreaterThan(0);
    await placeArt(USER, free[0].spot.id, {
      title: 'Mine to find',
      description: null,
      materials: null,
      image_url: null,
      hunt_clue: 'Behind the thing',
    });
    const ownPiece = currentPlacement(await getPlacements(), USER);
    expect(ownPiece).toBeTruthy();
    await expect(
      logPlacementFind(USER, ownPiece!.id, free[0].spot.location),
    ).rejects.toThrow(/hid this one/i);
  });
});

/*
 * Adding something to the map.
 *
 * The award used to fire the instant the form was sent, keyed on the new
 * submission id — so every submission was a fresh ledger key and ten more
 * points, whatever was in it, and the moderator queue was the only thing that
 * ever saw the contents. Twenty pieces of nonsense bought the dearest course in
 * the catalogue.
 *
 * Approval is what pays now, which is also what the submitter is told.
 */
describe('adding something to the map', () => {
  const ADMIN = 'seed-user-admin';
  const payload = { title: 'A wall', location: { latitude: 51.56, longitude: 5.08 } };

  it('pays nothing for submitting, however many you send', async () => {
    const start = await getPoints(USER);

    for (let i = 0; i < 5; i += 1) {
      await localProvider.submitContent('installation', USER, 'Tester', {
        ...payload,
        title: `A wall ${i}`,
      });
    }

    expect(await getPoints(USER)).toBe(start);
  });

  it('pays the submitter once when a moderator approves, and nothing for rejecting', async () => {
    const start = await getPoints(USER);
    const kept = await localProvider.submitContent('installation', USER, 'Tester', payload);
    const binned = await localProvider.submitContent('installation', USER, 'Tester', payload);

    await localProvider.approveSubmission(kept.id, ADMIN);
    const afterApproval = await getPoints(USER);
    expect(afterApproval).toBe(start + POINTS.submit_content);

    // Approving the same one again is a no-op, not a second payment.
    await localProvider.approveSubmission(kept.id, ADMIN);
    expect(await getPoints(USER)).toBe(afterApproval);

    await localProvider.rejectSubmission(binned.id, ADMIN, 'not suitable');
    expect(await getPoints(USER)).toBe(afterApproval);
  });
});

describe('what turning up is worth', () => {
  const at = (hours: number) => ({
    start_time: '2026-09-01T19:00:00.000Z',
    end_time: new Date(Date.parse('2026-09-01T19:00:00.000Z') + hours * 3_600_000).toISOString(),
  });

  it('pays more for longer, between a floor and a ceiling', () => {
    expect(eventAttendancePoints(at(1))).toBe(6);
    expect(eventAttendancePoints(at(2))).toBe(8);
    expect(eventAttendancePoints(at(3))).toBe(10);
    // Long enough to hit the cap, and no further.
    expect(eventAttendancePoints(at(12))).toBe(ATTENDANCE_POINTS_MAX);
  });

  it('never pays less than the floor, even for nonsense durations', () => {
    expect(eventAttendancePoints(at(0))).toBe(ATTENDANCE_POINTS_MIN);
    expect(eventAttendancePoints({ start_time: 'not a date', end_time: 'nor this' })).toBe(
      ATTENDANCE_POINTS_MIN,
    );
  });

  /* An organizer types the reward into a form, so it has to be clamped. */
  it('clamps an organizer-set reward instead of trusting it', () => {
    expect(eventAttendancePoints({ ...at(2), points_reward: 9999 })).toBe(ATTENDANCE_POINTS_MAX);
    expect(eventAttendancePoints({ ...at(2), points_reward: -50 })).toBe(ATTENDANCE_POINTS_MIN);
    expect(eventAttendancePoints({ ...at(2), points_reward: 11 })).toBe(11);
  });

  it('never lets an evening out-earn making something', () => {
    expect(ATTENDANCE_POINTS_MAX).toBeLessThanOrEqual(POINTS.place_art);
  });
});

describe('claiming attendance', () => {
  const started = async () => {
    const events = await getEvents({ includePast: true });
    const event = events.find((e) => Date.parse(e.start_time) <= Date.now());
    expect(event, 'the seed needs an event that has already started').toBeTruthy();
    return event!;
  };

  it('refuses before the event has started, without revealing the code', async () => {
    const events = await getEvents({ includePast: true });
    const future = events.find((e) => Date.parse(e.start_time) > Date.now());
    expect(future).toBeTruthy();

    await setRsvp(USER, future!.id, 'going');
    await expect(
      claimAttendance(USER, future!.id, future!.attendance_code ?? 'anything'),
    ).rejects.toThrow(/given out at the event/i);
  });

  it('refuses someone who never said they were going', async () => {
    const event = await started();
    await expect(claimAttendance(USER, event.id, event.attendance_code ?? 'x')).rejects.toThrow(
      /RSVP as going/i,
    );
  });

  it('refuses the wrong code', async () => {
    const event = await started();
    await setRsvp(USER, event.id, 'going');
    const before = await getPoints(USER);

    await expect(claimAttendance(USER, event.id, 'DEFINITELY-NOT-IT')).rejects.toThrow(/not right/i);
    expect(await getPoints(USER)).toBe(before);
  });

  it('pays what the event is worth, once', async () => {
    const event = await started();
    await setRsvp(USER, event.id, 'going');
    const before = await getPoints(USER);
    const worth = eventAttendancePoints(event);

    await claimAttendance(USER, event.id, event.attendance_code!);
    expect(await getPoints(USER)).toBe(before + worth);

    // Claiming again is a no-op, not a second payment and not an error.
    await claimAttendance(USER, event.id, event.attendance_code!);
    expect(await getPoints(USER)).toBe(before + worth);
  });

  it('ignores spacing and case in the code', async () => {
    const event = await started();
    await setRsvp(USER, event.id, 'going');
    const before = await getPoints(USER);

    const messy = ` ${event.attendance_code!.toLowerCase().split('').join(' ')} `;
    await claimAttendance(USER, event.id, messy);
    expect(await getPoints(USER)).toBeGreaterThan(before);
  });
});
