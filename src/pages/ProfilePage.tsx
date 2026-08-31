import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award,
  Brush,
  CalendarDays,
  Coffee,
  GraduationCap,
  Heart,
  Pencil,
  Route as RouteIcon,
  Search,
  Settings,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { EditProfileModal } from '@/components/profile/EditProfileModal';
import { DetailModal } from '@/components/details/DetailModal';
import { EventCard } from '@/components/events/EventCard';
import { Card, Section } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Avatar } from '@/components/ui/Shared';
import { LoadingBlock } from '@/components/ui/LoadingSpinner';

import { getUserRewards, REWARD_TIERS } from '@/services/pointsService';
import { eventToMapItem, routeToMapItem, installationToMapItem, thirdSpaceToMapItem } from '@/services/api';
import { completedStages, STAGE_BLURBS, STAGE_LABELS } from '@/services/journeyService';
import { isPast } from '@/services/eventService';
import { getSubmissionsByUser, SUBMISSION_TYPE_LABELS } from '@/services/submissionService';
import { roleLabel } from '@/lib/permissions';
import { relativeTime } from '@/lib/format';
import {
  JOURNEY_STAGES,
  type Badge as BadgeRow,
  type CommunitySubmission,
  type ItemType,
  type MapItem,
} from '@/types';

const TYPE_ICONS: Record<ItemType, typeof Brush> = {
  installation: Brush,
  route: RouteIcon,
  event: CalendarDays,
  third_space: Coffee,
  cache: Search,
};

/** Prompts 5, 15, 16, 27, 29, 49 — the profile tab. */
export function ProfilePage() {
  const navigate = useNavigate();
  const user = useAppStore((s) => s.user);
  const data = useAppStore((s) => s.data);
  const rsvps = useAppStore((s) => s.rsvps);
  const journey = useAppStore((s) => s.journey);
  const savedKeys = useAppStore((s) => s.savedKeys);
  const setSelectedItem = useAppStore((s) => s.setSelectedItem);

  const [editing, setEditing] = useState(false);
  const [eventTab, setEventTab] = useState<'upcoming' | 'past'>('upcoming');
  const [rewards, setRewards] = useState<{ points: number; badges: BadgeRow[] } | null>(null);
  const [submissions, setSubmissions] = useState<CommunitySubmission[]>([]);

  useEffect(() => {
    if (!user) return undefined;
    let live = true;

    void getUserRewards(user.id)
      .then((result) => live && setRewards({ points: result.points, badges: result.badges }))
      .catch(() => live && setRewards({ points: user.points, badges: [] }));

    // A moderator's rejection note is only useful if the person who submitted
    // it can actually read it.
    void getSubmissionsByUser(user.id)
      .then((rows) =>
        live &&
        setSubmissions(
          [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 10),
        ),
      )
      .catch(() => live && setSubmissions([]));

    return () => {
      live = false;
    };
  }, [user]);

  /*
   * Derived from the store rather than refetched.
   *
   * `toggleSaved` writes savedKeys optimistically and only then awaits the
   * server, so a refetch triggered by that same write would race it and could
   * come back with the pre-toggle list — leaving the section permanently out of
   * step with the heart the user just tapped. The store is already the source
   * of truth; this just resolves ids against the loaded city data.
   */
  const savedItems = useMemo<MapItem[] | null>(() => {
    if (!data) return null;

    const items: MapItem[] = [];
    for (const key of savedKeys) {
      const [type, id] = key.split(':');
      if (type === 'installation') {
        const found = data.installations.find((i) => i.id === id);
        if (found) items.push(installationToMapItem(found));
      } else if (type === 'route') {
        const found = data.routes.find((r) => r.id === id);
        if (found) items.push(routeToMapItem(found));
      } else if (type === 'third_space') {
        const found = data.thirdSpaces.find((t) => t.id === id);
        if (found) items.push(thirdSpaceToMapItem(found));
      } else if (type === 'event') {
        const found = data.events.find((e) => e.id === id);
        const item = found ? eventToMapItem(found) : null;
        if (item) items.push(item);
      }
    }
    return items;
  }, [data, savedKeys]);

  const myEvents = useMemo(() => {
    if (!user || !data) return { upcoming: [], past: [] };
    const goingIds = new Set(
      rsvps.filter((r) => r.user_id === user.id && r.rsvp_status === 'going').map((r) => r.event_id),
    );
    const mine = data.events.filter((e) => goingIds.has(e.id));
    return {
      upcoming: mine.filter((e) => !isPast(e)).sort((a, b) => a.start_time.localeCompare(b.start_time)),
      past: mine.filter(isPast).sort((a, b) => b.start_time.localeCompare(a.start_time)),
    };
  }, [user, data, rsvps]);

  if (!user) return <LoadingBlock label="Loading your profile…" />;

  const reached = completedStages(journey);
  const points = rewards?.points ?? user.points;
  const nextTier = REWARD_TIERS.find((tier) => points < tier.points) ?? null;
  const savedRoutes = savedItems?.filter((i) => i.type === 'route') ?? [];
  const savedOther = savedItems?.filter((i) => i.type !== 'route') ?? [];

  return (
    <div className="page">
      <header className="profile-header">
        <Avatar user={user} />
        <div className="grow" style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: '1.4rem', margin: 0 }}>
            {user.full_name ?? user.email.split('@')[0]}
          </h1>
          {user.pronouns ? (
            <p className="small" style={{ margin: 0, opacity: 0.85 }}>
              {user.pronouns}
            </p>
          ) : null}
          <p className="small truncate" style={{ margin: '0.15rem 0 0.4rem', opacity: 0.85 }}>
            {user.email}
          </p>
          <Badge tone="neutral">{roleLabel(user.role)}</Badge>
        </div>
        <div className="stack stack--xs" style={{ gap: '0.35rem' }}>
          <Button variant="text" size="sm" onClick={() => setEditing(true)} icon={<Pencil size={13} />}>
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/menu')}
            icon={<Settings size={13} />}
          >
            Settings
          </Button>
        </div>
      </header>

      <Section title="Your journey">
        <Card>
          <div className="journey" aria-hidden="true">
            {JOURNEY_STAGES.map((stage) => (
              <span
                key={stage}
                className={`journey__step${reached.includes(stage) ? ' is-done' : ''}`}
              />
            ))}
          </div>
          <p className="small" style={{ margin: '0.6rem 0 0.2rem' }}>
            <strong>
              {reached.length} of {JOURNEY_STAGES.length} —{' '}
              {STAGE_LABELS[journey?.current_stage ?? 'discovered']}
            </strong>
          </p>
          <p className="small muted" style={{ margin: 0 }}>
            {STAGE_BLURBS[journey?.current_stage ?? 'discovered']}
          </p>
        </Card>
      </Section>

      <Section title="Points &amp; rewards">
        <Card>
          <div className="row row--between" style={{ marginBottom: '0.6rem' }}>
            <span className="row" style={{ gap: '0.4rem' }}>
              <Trophy size={20} color="var(--warning)" aria-hidden="true" />
              <span className="stat__value">{points}</span>
              <span className="muted small">points</span>
            </span>
            {rewards?.badges.length ? (
              <span className="row" style={{ gap: '0.25rem' }}>
                {rewards.badges.map((badge) => (
                  <Badge key={badge.id} tone="warning" icon={<Award size={10} />}>
                    {badge.badge_name}
                  </Badge>
                ))}
              </span>
            ) : null}
          </div>

          <LinkButton
            to="/workshops"
            variant="secondary"
            size="sm"
            block
            icon={<GraduationCap size={14} />}
            className="small"
          >
            Redeem for a workshop
          </LinkButton>

          {nextTier ? (
            <>
              <div
                className="progress"
                role="img"
                aria-label={`${points} of ${nextTier.points} points towards ${nextTier.name}`}
              >
                <div
                  className="progress__fill"
                  style={{ width: `${Math.min(100, (points / nextTier.points) * 100)}%` }}
                />
              </div>
              <p className="tiny muted" style={{ margin: '0.4rem 0 0' }}>
                <Sparkles size={11} style={{ verticalAlign: '-1px' }} aria-hidden="true" />{' '}
                {nextTier.points - points} points to <strong>{nextTier.name}</strong> —{' '}
                {nextTier.detail}
              </p>
            </>
          ) : (
            <p className="tiny muted" style={{ margin: 0 }}>
              Every tier reached.
            </p>
          )}

          {/* These tiers are the concept's proposal, not working features. Saying
              so here is the difference between a demo and a promise nobody can
              keep — workshop places are the reward that actually works. */}
          <p className="tiny muted" style={{ margin: '0.6rem 0 0' }}>
            These tiers are part of the proposal, not yet built. The reward you can
            actually spend points on today is a workshop place.
          </p>
        </Card>
      </Section>

      <Section title="Saved routes">
        {savedItems === null ? (
          <LoadingBlock label="Loading saved routes…" />
        ) : savedRoutes.length === 0 ? (
          <EmptyState
            icon={<RouteIcon size={22} />}
            title="No saved routes yet"
            message="Save a route and it waits here for the night you need it."
            action={
              <LinkButton to="/explore" variant="text">
                Browse routes
              </LinkButton>
            }
          />
        ) : (
          <div className="stack stack--xs">
            {savedRoutes.map((item) => (
              <button key={item.id} className="list-row" onClick={() => setSelectedItem(item)}>
                <span className="list-row__thumb" aria-hidden="true">
                  <RouteIcon size={18} />
                </span>
                <span className="grow">
                  <span className="list-row__title" style={{ display: 'block' }}>
                    {item.title}
                  </span>
                  <span className="list-row__meta">{item.subtitle}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </Section>

      <Section title="My events">
        <div className="tabs" role="tablist">
          <button
            role="tab"
            aria-selected={eventTab === 'upcoming'}
            className={`tab${eventTab === 'upcoming' ? ' is-active' : ''}`}
            onClick={() => setEventTab('upcoming')}
          >
            Upcoming ({myEvents.upcoming.length})
          </button>
          <button
            role="tab"
            aria-selected={eventTab === 'past'}
            className={`tab${eventTab === 'past' ? ' is-active' : ''}`}
            onClick={() => setEventTab('past')}
          >
            Past ({myEvents.past.length})
          </button>
        </div>

        {myEvents[eventTab].length === 0 ? (
          <EmptyState
            icon={<CalendarDays size={22} />}
            title={eventTab === 'upcoming' ? 'Nothing in your diary' : 'Nothing here yet'}
            message={
              eventTab === 'upcoming'
                ? 'RSVP to something and it shows up here, ready to add to your calendar.'
                : 'Events you have been to will collect here.'
            }
            action={
              eventTab === 'upcoming' ? (
                <LinkButton to="/events" variant="text">
                  Browse events
                </LinkButton>
              ) : undefined
            }
          />
        ) : (
          <div className="stack stack--xs">
            {myEvents[eventTab].map((event) => {
              const item = eventToMapItem(event);
              return (
                <EventCard
                  key={event.id}
                  event={event}
                  compact
                  onSelect={() =>
                    setSelectedItem(
                      item ?? {
                        id: event.id,
                        type: 'event',
                        title: event.title,
                        subtitle: event.organizer_name,
                        location: { latitude: 0, longitude: 0 },
                        image: event.image_url,
                        accessibility: event.accessibility,
                        raw: event,
                      },
                    )
                  }
                />
              );
            })}
          </div>
        )}
      </Section>

      {submissions.length > 0 ? (
        <Section title="Your submissions">
          <div className="stack stack--xs">
            {submissions.map((submission) => {
              const content = submission.content as Record<string, unknown>;
              const name = (content.title ?? content.name ?? 'Untitled') as string;
              const tone =
                submission.moderation_status === 'approved'
                  ? 'success'
                  : submission.moderation_status === 'rejected'
                    ? 'error'
                    : 'warning';

              return (
                <Card key={submission.id}>
                  <div className="row row--between" style={{ marginBottom: '0.3rem' }}>
                    <strong className="truncate">{name}</strong>
                    <Badge tone={tone}>
                      {submission.moderation_status === 'pending'
                        ? 'Waiting for review'
                        : submission.moderation_status === 'approved'
                          ? 'Published'
                          : 'Not published'}
                    </Badge>
                  </div>
                  <p className="tiny muted" style={{ margin: 0 }}>
                    {SUBMISSION_TYPE_LABELS[submission.submission_type]} · sent{' '}
                    {relativeTime(submission.created_at)}
                  </p>
                  {/* Without this the moderator's note would go nowhere. */}
                  {submission.moderation_notes ? (
                    <p
                      className="small"
                      style={{
                        margin: '0.5rem 0 0',
                        borderLeft: '2px solid var(--error)',
                        paddingLeft: '0.6rem',
                      }}
                    >
                      {submission.moderation_notes}
                    </p>
                  ) : null}
                </Card>
              );
            })}
          </div>
        </Section>
      ) : null}

      <Section title="Saved places">
        {savedOther.length === 0 ? (
          <EmptyState
            icon={<Heart size={22} />}
            title="Nothing saved yet"
            message="Tap the heart on any place, artwork or event to keep it here."
            action={
              <LinkButton to="/discover" variant="text">
                Open the map
              </LinkButton>
            }
          />
        ) : (
          <div className="stack stack--xs">
            {savedOther.map((item) => {
              const Icon = TYPE_ICONS[item.type];
              return (
                <button
                  key={`${item.type}-${item.id}`}
                  className="list-row"
                  onClick={() => setSelectedItem(item)}
                >
                  <span className="list-row__thumb" aria-hidden="true">
                    <Icon size={18} />
                  </span>
                  <span className="grow">
                    <span className="list-row__title" style={{ display: 'block' }}>
                      {item.title}
                    </span>
                    <span className="list-row__meta">{item.subtitle}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </Section>

      <EditProfileModal open={editing} onClose={() => setEditing(false)} />
      <DetailModal />
    </div>
  );
}
