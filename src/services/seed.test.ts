import { describe, expect, it } from 'vitest';
import { seedEvents } from './seed';
import { A11Y_TAGS } from '@/lib/format';

const CATEGORIES = ['workshop', 'art_talk', 'social', 'nightlife'];

describe('seeded events', () => {
  it('are all marked as examples', () => {
    expect(seedEvents.every((e) => e.is_example === true)).toBe(true);
  });

  it('have unique ids and attendance codes', () => {
    expect(new Set(seedEvents.map((e) => e.id)).size).toBe(seedEvents.length);
    const codes = seedEvents.map((e) => e.attendance_code).filter(Boolean);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('fill the calendar through to New Year\'s Eve 2026', () => {
    const december = seedEvents.filter((e) => e.start_time.startsWith('2026-12'));
    expect(december.length).toBeGreaterThanOrEqual(8);
    const latest = seedEvents.map((e) => new Date(e.start_time)).sort((a, b) => +b - +a)[0];
    expect(latest.getFullYear()).toBe(2026);
    expect(latest.getMonth()).toBe(11);
    expect(latest.getDate()).toBe(31);
  });

  it('use only known categories and accessibility tags, and end after they start', () => {
    for (const e of seedEvents) {
      expect(CATEGORIES).toContain(e.category);
      for (const tag of e.accessibility) expect(A11Y_TAGS).toContain(tag);
      expect(new Date(e.end_time).getTime()).toBeGreaterThan(new Date(e.start_time).getTime());
      // A virtual event has no place on the map; a physical one must have one.
      expect(e.is_virtual ? e.location === null : e.location !== null).toBe(true);
    }
  });
});
