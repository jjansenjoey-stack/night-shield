import { getProvider } from './dataProvider';
import type { Course, CourseFormat, Enrolment } from '@/types';

/**
 * Grow — spending points on artistic courses that otherwise cost money.
 *
 * The balance check happens on the server, not here. These helpers exist so the
 * UI can explain itself before someone taps a button, never as the gate.
 */

export async function getCourses(): Promise<Course[]> {
  const provider = await getProvider();
  return provider.getCourses();
}

export async function getEnrolments(userId: string): Promise<Enrolment[]> {
  const provider = await getProvider();
  return provider.getEnrolments(userId);
}

/** Places already taken, keyed by course id. */
export async function getEnrolmentCounts(): Promise<Map<string, number>> {
  const provider = await getProvider();
  return provider.getEnrolmentCounts();
}

export async function enrolInCourse(userId: string, courseId: string): Promise<Enrolment> {
  const provider = await getProvider();
  return provider.enrolInCourse(userId, courseId);
}

/** Cancelling before the start date returns the points. */
export async function cancelEnrolment(userId: string, courseId: string): Promise<void> {
  const provider = await getProvider();
  return provider.cancelEnrolment(userId, courseId);
}

// ---- Presentation helpers -------------------------------------------------

export const FORMAT_LABELS: Record<CourseFormat, string> = {
  class: 'Course',
  certificate: 'Certificate',
  masterclass: 'Masterclass',
};

export const LEVEL_LABELS = {
  beginner: 'No experience needed',
  some_experience: 'Some experience helps',
  any: 'Any level',
} as const;

export function placesLeft(course: Course, taken: number): number {
  return Math.max(0, course.capacity - taken);
}

export function isFull(course: Course, taken: number): boolean {
  return placesLeft(course, taken) === 0;
}

export function hasStarted(course: Course): boolean {
  return new Date(course.starts_on).getTime() < Date.now();
}

/** Cancellation is only fair to the provider while the course has not begun. */
export function canCancel(course: Course): boolean {
  return !hasStarted(course);
}

export function canAfford(course: Course, points: number): boolean {
  return points >= course.points_cost;
}

export function pointsShort(course: Course, points: number): number {
  return Math.max(0, course.points_cost - points);
}

/**
 * What the points are worth in euros for this course. Shown so people can see
 * that turning up in their own city is being valued at something real.
 */
export function euroValue(course: Course): number {
  return course.cash_cost_euros;
}

export interface CourseFilters {
  search?: string;
  formats?: CourseFormat[];
  disciplines?: string[];
  /** Only show what the given balance can actually buy. */
  affordableWith?: number | null;
  accessibility?: string[];
  includeStarted?: boolean;
}

export function applyCourseFilters(rows: Course[], filters: CourseFilters): Course[] {
  const search = filters.search?.trim().toLowerCase();

  return rows
    .filter((row) => {
      if (!filters.includeStarted && hasStarted(row)) return false;
      if (filters.formats?.length && !filters.formats.includes(row.format)) return false;
      if (filters.disciplines?.length && !filters.disciplines.includes(row.discipline)) {
        return false;
      }
      if (filters.affordableWith != null && row.points_cost > filters.affordableWith) {
        return false;
      }
      if (filters.accessibility?.length) {
        if (!filters.accessibility.every((tag) => row.accessibility.includes(tag))) return false;
      }
      if (search) {
        const haystack = [row.title, row.description, row.provider, row.discipline, row.certificate]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    })
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on));
}

export function disciplinesOf(courses: Course[]): string[] {
  return [...new Set(courses.map((c) => c.discipline))].sort();
}
