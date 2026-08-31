import { useMemo, useState } from 'react';
import {
  Accessibility,
  CheckCircle2,
  Compass,
  Footprints,
  Heart,
  Lightbulb,
  MapPin,
  Moon,
  Navigation,
  Trophy,
  Users,
} from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useToast } from '@/components/ui/Toast';
import { Modal, ModalCloseButton } from '@/components/ui/Modal';
import { AnchorButton, Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { AccessibilityIcons, Field, ImageCarousel } from '@/components/ui/Shared';
import {
  DIFFICULTY_LABELS,
  logCacheFind,
  metresAway,
  isWithinFindRange,
  remotePoints,
} from '@/services/cacheService';
import { awardBadge } from '@/services/pointsService';
import { badgesEarned } from '@/services/cacheService';
import { directionsUrl } from '@/lib/geo';
import { CACHE_FIND_RADIUS_M, type NightCache } from '@/types';
import { ExampleBadge } from '@/components/ui/ExampleBadge';

interface Props {
  cache: NightCache;
  onClose: () => void;
}

/**
 * A Night Cache.
 *
 * Two routes to a find, and the second one is not a consolation prize — it is
 * the reason someone who cannot walk to the Piushaven at midnight can still
 * play. Full points for being there, 40% for working it out.
 */
export function CacheDetailModal({ cache, onClose }: Props) {
  const user = useAppStore((s) => s.user);
  const finds = useAppStore((s) => s.cacheFinds);
  const findCounts = useAppStore((s) => s.cacheFindCounts);
  const caches = useAppStore((s) => s.data?.caches);
  const refreshCaches = useAppStore((s) => s.refreshCaches);
  const isSaved = useAppStore((s) => s.isSaved);
  const toggleSaved = useAppStore((s) => s.toggleSaved);
  const markJourney = useAppStore((s) => s.markJourney);
  const toast = useToast();

  // A live watch: the whole interaction is "am I close enough yet".
  const { userLocation, locationDenied, request } = useGeolocation({ watch: true });

  const [answer, setAnswer] = useState('');
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const myFind = useMemo(
    () => finds.find((f) => f.cache_id === cache.id) ?? null,
    [finds, cache.id],
  );
  const found = Boolean(myFind);
  const saved = isSaved('cache', cache.id);

  const metres = metresAway(cache, userLocation);
  const inRange = isWithinFindRange(cache, userLocation);
  const otherFinders = Math.max(0, (findCounts.get(cache.id) ?? 0) - (found ? 1 : 0));

  async function celebrate() {
    await refreshCaches();
    if (!user) return;

    void markJourney('explored');

    // Award anything the find just unlocked.
    const updated = [...finds, { cache_id: cache.id } as never];
    for (const badge of badgesEarned(caches ?? [], updated)) {
      await awardBadge(user.id, badge).catch(() => null);
    }
  }

  async function handleVisitedFind() {
    if (!user) {
      toast.show('Sign in to log finds and collect points.', 'info', {
        label: 'Log in',
        onClick: () => window.location.assign('/login'),
      });
      return;
    }
    setBusy(true);
    try {
      await logCacheFind(user.id, cache, 'visited', userLocation);
      toast.success(`Found it. +${cache.points} points.`);
      await celebrate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not log that find.');
    } finally {
      setBusy(false);
    }
  }

  async function handleAnsweredFind(event: React.FormEvent) {
    event.preventDefault();
    setAnswerError(null);

    if (!user) {
      toast.show('Sign in to log finds and collect points.', 'info', {
        label: 'Log in',
        onClick: () => window.location.assign('/login'),
      });
      return;
    }

    setBusy(true);
    try {
      // The backend judges the answer — on Supabase the answers never reach
      // the browser at all.
      await logCacheFind(user.id, cache, 'answered', null, answer);
      toast.success(`Correct. +${remotePoints(cache)} points.`);
      setAnswer('');
      await celebrate();
    } catch (error) {
      setAnswerError(error instanceof Error ? error.message : 'That is not it.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!user) {
      toast.show('Sign in to keep a list of caches to hunt.', 'info', {
        label: 'Log in',
        onClick: () => window.location.assign('/login'),
      });
      return;
    }
    try {
      const nowSaved = await toggleSaved('cache', cache.id);
      toast.success(nowSaved ? 'Added to your hunt list.' : 'Removed from your hunt list.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save that.');
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      flushBody
      label={`Night Cache: ${cache.title}`}
      header={
        <div style={{ position: 'relative' }}>
          <ModalCloseButton onClose={onClose} />
          <ImageCarousel images={cache.image_url ? [cache.image_url] : []} alt={cache.title} />
        </div>
      }
      footer={
        found ? (
          <>
            <Badge tone="success" icon={<CheckCircle2 size={11} />}>
              {myFind?.method === 'visited' ? 'Found in person' : 'Worked out from home'}
            </Badge>
            <AnchorButton
              href={directionsUrl(cache.location, userLocation)}
              variant="text"
              icon={<Navigation size={15} />}
            >
              Directions
            </AnchorButton>
          </>
        ) : (
          <>
            <Button
              variant="primary"
              onClick={handleVisitedFind}
              loading={busy}
              disabled={!inRange}
              icon={<Footprints size={15} />}
            >
              {inRange ? "I'm here — log the find" : 'Get closer to log it'}
            </Button>
            <Button
              variant={saved ? 'secondary' : 'text'}
              onClick={handleSave}
              icon={<Heart size={15} fill={saved ? 'currentColor' : 'none'} />}
            >
              {saved ? 'On your list' : 'Save for later'}
            </Button>
            <AnchorButton
              href={directionsUrl(cache.location, userLocation)}
              variant="ghost"
              icon={<Navigation size={15} />}
            >
              Directions
            </AnchorButton>
          </>
        )
      }
    >
      <div className="stack" style={{ padding: '1rem' }}>
        <div>
          <div className="row" style={{ marginBottom: '0.35rem' }}>
            <Badge tone="warning">{DIFFICULTY_LABELS[cache.difficulty]}</Badge>
            <ExampleBadge show={cache.is_example} />
            <Badge tone="pink" icon={<Trophy size={10} />}>
              {cache.points} points
            </Badge>
            {cache.night_only ? (
              <Badge tone="teal" icon={<Moon size={10} />}>
                Best after dark
              </Badge>
            ) : null}
            {found ? (
              <Badge tone="success" icon={<CheckCircle2 size={10} />}>
                Found
              </Badge>
            ) : null}
          </div>

          <h2 style={{ marginBottom: '0.2rem' }}>{cache.title}</h2>
          <p className="muted small" style={{ margin: 0 }}>
            {cache.area}
            {otherFinders > 0 ? (
              <>
                {' · '}
                <Users size={11} style={{ verticalAlign: '-1px' }} aria-hidden="true" />{' '}
                {otherFinders} {otherFinders === 1 ? 'other person has' : 'others have'} found it
              </>
            ) : (
              ' · nobody has found this one yet'
            )}
          </p>
        </div>

        {/* The hint is always visible; the story is the reward. */}
        <div
          className="card"
          style={{ background: 'rgba(255, 209, 102, 0.08)', borderColor: 'rgba(255,209,102,0.3)' }}
        >
          <p className="small row row--top" style={{ gap: '0.5rem', margin: 0 }}>
            <Lightbulb size={16} color="var(--warning)" aria-hidden="true" style={{ flexShrink: 0 }} />
            <span>{cache.hint}</span>
          </p>
        </div>

        {found ? (
          <div>
            <h4 style={{ marginBottom: '0.35rem' }}>What you found</h4>
            <p style={{ margin: 0 }}>{cache.story}</p>
          </div>
        ) : null}

        {cache.accessibility.length > 0 ? (
          <div>
            <h4 style={{ marginBottom: '0.35rem' }}>Getting there</h4>
            <AccessibilityIcons tags={cache.accessibility} />
          </div>
        ) : null}

        {!found ? (
          <>
            <div className="card" style={{ padding: '0.75rem' }}>
              <div className="row row--between">
                <span className="row small" style={{ gap: '0.4rem' }}>
                  <MapPin size={15} aria-hidden="true" />
                  {metres === null
                    ? 'Distance unknown'
                    : inRange
                      ? `You are ${metres} m away — close enough`
                      : `${metres} m away`}
                </span>
                {!userLocation && !locationDenied ? (
                  <Button variant="text" size="sm" onClick={request}>
                    Use my location
                  </Button>
                ) : null}
              </div>
              <p className="tiny muted" style={{ margin: '0.4rem 0 0' }}>
                {locationDenied
                  ? 'Location is off, so we cannot confirm you are there. Answer the question below instead — it counts.'
                  : `Get within ${CACHE_FIND_RADIUS_M} m and the button turns on.`}
              </p>
            </div>

            <hr className="divider" />

            {/*
              Not a consolation prize. Some people cannot get to a canal path at
              midnight — because of a wheelchair, a budget, a shift pattern, or
              simply not feeling safe there — and the game has to work for them.
            */}
            <form onSubmit={handleAnsweredFind} className="stack stack--xs">
              <div className="row row--between">
                <h4 style={{ margin: 0 }}>Can&rsquo;t get there?</h4>
                <Badge tone="neutral">{remotePoints(cache)} points</Badge>
              </div>
              <p className="small muted" style={{ margin: 0 }}>
                <Accessibility size={13} style={{ verticalAlign: '-2px' }} aria-hidden="true" />{' '}
                Work it out from the photo and the hint. It still counts as a find.
              </p>

              <Field label={cache.question} htmlFor={`answer-${cache.id}`} error={answerError ?? undefined}>
                <input
                  id={`answer-${cache.id}`}
                  className="input"
                  value={answer}
                  onChange={(event) => {
                    setAnswer(event.target.value);
                    setAnswerError(null);
                  }}
                  aria-invalid={Boolean(answerError)}
                  placeholder="Your answer"
                />
              </Field>

              <Button
                type="submit"
                variant="secondary"
                loading={busy}
                disabled={!answer.trim()}
                icon={<Compass size={15} />}
              >
                Log it from here
              </Button>
            </form>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
