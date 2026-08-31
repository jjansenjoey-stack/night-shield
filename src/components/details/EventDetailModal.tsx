import { useEffect, useMemo, useState } from 'react';
import {
  CalendarPlus,
  Check,
  Clock,
  Euro,
  Flag,
  Heart,
  MapPin,
  Pencil,
  Share2,
  Users,
  Video,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useToast } from '@/components/ui/Toast';
import { Modal, ModalCloseButton } from '@/components/ui/Modal';
import { AnchorButton, Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { AccessibilityIcons, ImageCarousel } from '@/components/ui/Shared';
import { Card } from '@/components/ui/Card';
import { EventFeedbackForm } from '@/components/events/EventFeedbackForm';
import { EventForm } from '@/components/events/EventForm';
import {
  cancelRsvp,
  claimAttendance,
  countGoing,
  getEventJoinUrl,
  isPast,
  setRsvp,
  spotsLeft,
  toIcs,
} from '@/services/eventService';
import { addPoints, POINTS } from '@/services/pointsService';
import { fetchCurrentUser } from '@/services/authService';
import { canUserPerformAction } from '@/lib/permissions';
import { directionsUrl, formatDistance } from '@/lib/geo';
import { durationLabel, eventCategoryLabel, formatEuros, formatEventDate } from '@/lib/format';
import { eventAttendancePoints, type NightEvent } from '@/types';

interface Props {
  event: NightEvent;
  distance?: number | null;
  onClose: () => void;
}

/** Prompts 47, 48, 51, 55, 56, 58 — the full event sheet. */
export function EventDetailModal({ event, distance, onClose }: Props) {
  const user = useAppStore((s) => s.user);
  const rsvps = useAppStore((s) => s.rsvps);
  const rsvpCounts = useAppStore((s) => s.rsvpCounts);
  const refreshRsvps = useAppStore((s) => s.refreshRsvps);
  const refreshData = useAppStore((s) => s.refreshData);
  const isSaved = useAppStore((s) => s.isSaved);
  const toggleSaved = useAppStore((s) => s.toggleSaved);
  const userLocation = useAppStore((s) => s.userLocation);
  const markJourney = useAppStore((s) => s.markJourney);
  const toast = useToast();

  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  // Fetched rather than read off the event: the column is revoked at database
  // level, so the link only exists for someone who is actually going.
  const [joinUrl, setJoinUrl] = useState<string | null>(null);

  const going = countGoing(rsvpCounts, event.id);
  const left = spotsLeft(event, going);
  const full = left === 0;
  const past = isPast(event);
  const saved = isSaved('event', event.id);

  const myRsvp = useMemo(
    () => rsvps.find((r) => r.user_id === user?.id && r.event_id === event.id) ?? null,
    [rsvps, user?.id, event.id],
  );
  const isGoing = myRsvp?.rsvp_status === 'going';
  const canEdit =
    user &&
    (user.role === 'admin' ||
      (event.organizer_id === user.id && canUserPerformAction(user, 'edit_own_event')));

  const icsHref = useMemo(
    () => `data:text/calendar;charset=utf-8,${encodeURIComponent(toIcs(event))}`,
    [event],
  );

  useEffect(() => {
    if (!event.is_virtual || !isGoing) {
      setJoinUrl(null);
      return undefined;
    }
    let live = true;
    getEventJoinUrl(event.id)
      .then((url) => live && setJoinUrl(url))
      .catch(() => live && setJoinUrl(null));
    return () => {
      live = false;
    };
  }, [event.id, event.is_virtual, isGoing]);

  async function handleRsvp() {
    if (!user) {
      toast.show('Sign in to RSVP.', 'info', {
        label: 'Log in',
        onClick: () => window.location.assign('/login'),
      });
      return;
    }
    setBusy(true);
    try {
      if (isGoing) {
        await cancelRsvp(user.id, event.id);
        toast.success('RSVP cancelled.');
      } else {
        if (full) {
          toast.error('This event is full.');
          return;
        }
        await setRsvp(user.id, event.id, 'going');
        await addPoints(user.id, 'rsvp_event', event.id).catch(() => null);
        void markJourney('participated');
        toast.success(`You're on the list. +${POINTS.rsvp_event} points.`);
      }
      await refreshRsvps();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update your RSVP.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!user) {
      toast.show('Sign in to save events.', 'info', {
        label: 'Log in',
        onClick: () => window.location.assign('/login'),
      });
      return;
    }
    try {
      const nowSaved = await toggleSaved('event', event.id);
      toast.success(nowSaved ? 'Event saved.' : 'Removed from saved.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save that event.');
    }
  }

  async function handleShare() {
    // Prompt 56 — the referral marker lets us credit whoever brought someone in.
    const url = `${window.location.origin}/events?event=${event.id}${user ? `&ref=${user.id}` : ''}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: event.title, text: event.description ?? '', url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied.');
      }
    } catch {
      /* share sheet dismissed */
    }
  }

  if (editing) {
    return (
      <Modal open onClose={() => setEditing(false)} title="Edit event" wide>
        <EventForm
          initial={event}
          onSaved={async () => {
            await refreshData();
            setEditing(false);
            toast.success('Event updated.');
          }}
          onCancel={() => setEditing(false)}
        />
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      flushBody
      label={event.title}
      header={
        <div style={{ position: 'relative' }}>
          <ModalCloseButton onClose={onClose} />
          <ImageCarousel images={event.image_url ? [event.image_url] : []} alt={event.title} />
        </div>
      }
      footer={
        past ? (
          <>
            <Button variant="primary" onClick={() => setReviewing(true)}>
              How was it?
            </Button>
            <Button variant="ghost" onClick={handleShare} icon={<Share2 size={15} />}>
              Share
            </Button>
          </>
        ) : (
          <>
            <Button
              variant={isGoing ? 'secondary' : 'primary'}
              onClick={handleRsvp}
              loading={busy}
              disabled={!isGoing && full}
              icon={isGoing ? <Check size={15} /> : <Users size={15} />}
            >
              {isGoing ? 'Going — cancel RSVP' : full ? 'Event full' : 'RSVP to event'}
            </Button>
            <Button
              variant="text"
              onClick={handleSave}
              icon={<Heart size={15} fill={saved ? 'currentColor' : 'none'} />}
            >
              {saved ? 'Saved' : 'Save'}
            </Button>
            {isGoing ? (
              <AnchorButton
                href={icsHref}
                download={`${event.title.replace(/[^\w]+/g, '-').toLowerCase()}.ics`}
                target="_self"
                variant="ghost"
                icon={<CalendarPlus size={15} />}
              >
                Add to calendar
              </AnchorButton>
            ) : null}
            <Button variant="ghost" onClick={handleShare} icon={<Share2 size={15} />}>
              Share
            </Button>
          </>
        )
      }
    >
      <div className="stack" style={{ padding: '1rem' }}>
        <div>
          <div className="row" style={{ marginBottom: '0.35rem' }}>
            <Badge tone="pink">{eventCategoryLabel(event.category)}</Badge>
            {event.is_virtual ? <Badge tone="teal">Online</Badge> : null}
            {event.is_featured ? <Badge tone="warning">Featured</Badge> : null}
            {past ? <Badge tone="neutral">Finished</Badge> : null}
          </div>

          <h2 style={{ marginBottom: '0.2rem' }}>{event.title}</h2>
          {event.organizer_name ? (
            <p className="muted small">Hosted by {event.organizer_name}</p>
          ) : null}
        </div>

        <div className="row" style={{ gap: '1rem' }}>
          <span className="row small" style={{ gap: '0.3rem' }}>
            <Clock size={14} aria-hidden="true" />
            {formatEventDate(event.start_time, event.end_time)} ·{' '}
            {durationLabel(event.start_time, event.end_time)}
          </span>
          <span className="row small" style={{ gap: '0.3rem' }}>
            <Euro size={14} aria-hidden="true" />
            {formatEuros(event.cost_euros)}
          </span>
        </div>

        {event.description ? <p>{event.description}</p> : null}

        <AttendanceBlock event={event} isGoing={isGoing} />


        {event.capacity != null ? (
          <div className="stack stack--xs">
            <div className="row row--between small">
              <span>
                <strong>{going}</strong> / {event.capacity} attending
              </span>
              <span className="muted tiny">
                {left === 0 ? 'Full' : `${left} spot${left === 1 ? '' : 's'} left`}
              </span>
            </div>
            <div
              className="progress"
              role="img"
              aria-label={`${going} of ${event.capacity} places taken`}
            >
              <div
                className="progress__fill"
                style={{ width: `${Math.min(100, (going / event.capacity) * 100)}%` }}
              />
            </div>
          </div>
        ) : (
          <p className="small muted">{going} people going · no capacity limit</p>
        )}

        {event.is_virtual ? (
          <div className="card" style={{ background: 'rgba(0,217,255,0.08)' }}>
            <div className="row row--between">
              <span className="row small" style={{ gap: '0.4rem' }}>
                <Video size={15} aria-hidden="true" />
                This event happens online.
              </span>
              {isGoing && joinUrl ? (
                <AnchorButton href={joinUrl} variant="secondary" size="sm">
                  Join
                </AnchorButton>
              ) : (
                <span className="tiny muted">
                  {isGoing ? 'Fetching the link…' : 'RSVP to get the link'}
                </span>
              )}
            </div>
          </div>
        ) : (
          event.address && (
            <div>
              <p className="small row" style={{ gap: '0.3rem', marginBottom: '0.2rem' }}>
                <MapPin size={14} aria-hidden="true" />
                {event.address}
                {distance != null ? (
                  <span className="muted"> · {formatDistance(distance)} away</span>
                ) : null}
              </p>
              {event.location ? (
                <AnchorButton
                  href={directionsUrl(event.location, userLocation)}
                  variant="text"
                  size="sm"
                >
                  Get directions
                </AnchorButton>
              ) : null}
            </div>
          )
        )}

        {event.accessibility.length > 0 ? (
          <div>
            <h4 style={{ marginBottom: '0.35rem' }}>Getting in</h4>
            <AccessibilityIcons tags={event.accessibility} />
          </div>
        ) : null}

        {event.updated_at ? (
          <p className="tiny muted" style={{ margin: 0 }}>
            Last updated {new Date(event.updated_at).toLocaleString()}
          </p>
        ) : null}

        {reviewing ? (
          <>
            <hr className="divider" />
            <EventFeedbackForm event={event} onDone={() => setReviewing(false)} />
          </>
        ) : null}

        <div className="row row--between">
          <button
            className="link-btn muted tiny row"
            style={{ gap: '0.3rem' }}
            onClick={() =>
              toast.show('Thanks — the Inclusivity Department will look at this within 48 hours.')
            }
          >
            <Flag size={12} aria-hidden="true" />
            Report this event
          </button>

          {canEdit ? (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)} icon={<Pencil size={13} />}>
              Edit event
            </Button>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

/**
 * What turning up is worth, and how to claim it.
 *
 * Before the event: a promise, so the reward is visible when someone decides
 * whether to go. During and after: a box for the code the organizer reads out.
 *
 * The code is the proof of presence. Everything about the claim is checked by
 * the backend — that the event started, that you said you were going, and
 * whether the code is right — against a column the browser never receives.
 */
function AttendanceBlock({ event, isGoing }: { event: NightEvent; isGoing: boolean }) {
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const toast = useToast();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [claimed, setClaimed] = useState(false);

  const worth = eventAttendancePoints(event);
  const started = Date.parse(event.start_time) <= Date.now();

  if (!user) {
    return (
      <p className="small muted" style={{ margin: 0 }}>
        Turning up to this one is worth <strong>{worth} points</strong> once you have an account.
      </p>
    );
  }

  if (claimed) {
    return (
      <Card style={{ borderColor: 'var(--success)' }}>
        <p className="small" style={{ margin: 0 }}>
          Claimed — <strong>+{worth} points</strong> for turning up. Thanks for coming.
        </p>
      </Card>
    );
  }

  if (!started) {
    return (
      <p className="small muted" style={{ margin: 0 }}>
        Worth <strong>{worth} points</strong> if you turn up — {durationLabel(event.start_time, event.end_time)}{' '}
        of it. You will get a code on the night to claim them with.
      </p>
    );
  }

  if (!isGoing) {
    return (
      <p className="small muted" style={{ margin: 0 }}>
        Attendance points go to people who RSVP&rsquo;d as going.
      </p>
    );
  }

  async function claim() {
    if (!user) return;
    const entered = code.trim();
    if (!entered) {
      toast.error('Enter the code from the event.');
      return;
    }
    setBusy(true);
    try {
      await claimAttendance(user.id, event.id, entered);
      const fresh = await fetchCurrentUser();
      if (fresh) setUser(fresh);
      setClaimed(true);
      toast.success(`+${worth} points for turning up.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not claim that.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <p className="small" style={{ marginTop: 0, marginBottom: '0.5rem' }}>
        Here tonight? Enter the code to claim <strong>{worth} points</strong>.
      </p>
      <div className="row" style={{ gap: '0.4rem' }}>
        <input
          className="input grow"
          value={code}
          maxLength={16}
          placeholder="Code from the event"
          aria-label="Attendance code"
          onChange={(event_) => setCode(event_.target.value)}
        />
        <Button variant="primary" onClick={() => void claim()} disabled={busy}>
          {busy ? 'Checking…' : 'Claim'}
        </Button>
      </div>
    </Card>
  );
}
