import type { Role, UserProfile } from '@/types';

/** Prompt 17 — role-based capabilities. Higher roles inherit everything below them. */
export type Action =
  | 'browse'
  | 'rsvp'
  | 'save_item'
  | 'submit_feedback'
  | 'submit_content'
  | 'create_event'
  | 'edit_own_event'
  | 'view_analytics'
  | 'moderate'
  | 'manage_featured';

const ROLE_RANK: Record<Role, number> = {
  citizen: 0,
  contributor: 1,
  organizer: 2,
  admin: 3,
};

const MIN_ROLE_FOR: Record<Action, Role> = {
  browse: 'citizen',
  rsvp: 'citizen',
  save_item: 'citizen',
  submit_feedback: 'citizen',
  submit_content: 'contributor',
  create_event: 'organizer',
  edit_own_event: 'organizer',
  view_analytics: 'organizer',
  moderate: 'admin',
  manage_featured: 'admin',
};

export function canUserPerformAction(
  user: Pick<UserProfile, 'role'> | null,
  action: Action,
): boolean {
  // Guests get read-only access (prompt 20).
  if (!user) return action === 'browse';
  return ROLE_RANK[user.role] >= ROLE_RANK[MIN_ROLE_FOR[action]];
}

export function isAtLeast(user: Pick<UserProfile, 'role'> | null, role: Role): boolean {
  if (!user) return false;
  return ROLE_RANK[user.role] >= ROLE_RANK[role];
}

const ROLE_LABELS: Record<Role, string> = {
  citizen: 'Citizen',
  contributor: 'Contributor',
  organizer: 'Organizer',
  admin: 'Admin',
};

export const roleLabel = (role: Role) => ROLE_LABELS[role];

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  citizen: 'Browse everything, RSVP to events and share how a place feels.',
  contributor: 'Everything a citizen can do, plus submitting art and third spaces.',
  organizer: 'Everything a contributor can do, plus creating and running events.',
  admin: 'Full access, including the moderation queue and featured content.',
};
