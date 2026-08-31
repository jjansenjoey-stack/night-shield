import { beforeEach, describe, expect, it } from 'vitest';

import { resetLocalDatabase } from './localProvider';
import { addPoints, getPoints, isoWeek, POINTS } from './pointsService';
import { cancelEnrolment, enrolInCourse, getCourses } from './courseService';
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
  placeArt,
} from './routeArtService';
import { CACHE_FIND_RADIUS_M, type Placement } from '@/types';

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
