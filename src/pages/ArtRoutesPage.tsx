import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  CalendarClock,
  Footprints,
  MapPin,
  PackageOpen,
  Plus,
  Ruler,
  Trophy,
  X,
} from 'lucide-react';
import { fetchCurrentUser } from '@/services/authService';
import { useAppStore } from '@/store/appStore';
import { Card, Section } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { LoadingBlock } from '@/components/ui/LoadingSpinner';
import { AccessibilityIcons, SafeImage } from '@/components/ui/Shared';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { RouteComparison } from '@/components/routes/RouteComparison';
import { POINTS } from '@/services/pointsService';
import {
  buildBoard,
  CHANGING_ROUTE_ID,
  collectPlacement,
  currentPlacement,
  getPlacements,
  getSpots,
  placeArt,
  PLACEMENT_DAYS,
  urgencyOf,
  type SpotBoardEntry,
} from '@/services/routeArtService';
import type { Placement, RouteSpot } from '@/types';

const URGENCY_TONE: Record<string, BadgeTone> = {
  fresh: 'teal',
  due_soon: 'warning',
  due_now: 'error',
};

function daysLabel(days: number): string {
  if (days <= 0) return 'Due back today';
  if (days === 1) return 'Due back tomorrow';
  return `${days} days left`;
}

/**
 * Art routes — walks built around what people have made.
 *
 * Led by Two Weeks Only, the route that changes itself: eight fixed spots on a
 * loop, anyone can put a small piece of work in a free one, and a fortnight
 * later they come back for it or the municipality clears the spot. The value
 * for a walker is that the route is never twice the same, and the value for a
 * maker is a real place to show something without applying to anyone for
 * permission. The city's other art walks are listed underneath.
 */
export function ArtRoutesPage() {
  const user = useAppStore((s) => s.user);
  const data = useAppStore((s) => s.data);
  const setUser = useAppStore((s) => s.setUser);
  const markJourney = useAppStore((s) => s.markJourney);
  const toast = useToast();

  const [spots, setSpots] = useState<RouteSpot[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState<RouteSpot | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [nextSpots, nextPlacements] = await Promise.all([
      getSpots(CHANGING_ROUTE_ID),
      getPlacements(CHANGING_ROUTE_ID),
    ]);
    setSpots(nextSpots);
    setPlacements(nextPlacements);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    refresh()
      .catch(() => {
        if (!cancelled) toast.error('Could not load the route just now.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, user?.id]);

  /*
   * One instant for the whole board. Judging each row against its own
   * new Date() lets a piece read as live in the list and expired in the
   * summary when the clock ticks mid-render.
   */
  const now = useMemo(() => new Date(), [placements]);
  const board = useMemo(() => buildBoard(spots, placements, now), [spots, placements, now]);
  const mine = useMemo(
    () => currentPlacement(placements, user?.id ?? null, now),
    [placements, user?.id, now],
  );

  const freeCount = board.filter((entry) => entry.free).length;

  // The city's other art walks, so the tab is about art routes rather than
  // about one of them. The changing route is already the whole page above.
  const otherWalks = useMemo(
    () =>
      (data?.routes ?? []).filter(
        (route) => route.type === 'art_walk' && route.id !== CHANGING_ROUTE_ID,
      ),
    [data?.routes],
  );

  async function handleCollect(placement: Placement) {
    if (!user) return;
    setBusy(true);
    try {
      await collectPlacement(user.id, placement.id);
      await refresh();
      const fresh = await fetchCurrentUser();
      if (fresh) setUser(fresh);
      toast.success(`Thanks for taking it home. +${POINTS.collect_art} points.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not do that.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <LoadingBlock label="Loading the route" />
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page__title">Art routes</h1>
      <p className="page__lede">
        Walks through Tilburg built around what people have made. One of them changes every
        fortnight, because the work on it is yours to put there.
      </p>

      <h2 style={{ marginBottom: '0.3rem' }}>Two Weeks Only</h2>
      <p className="page__lede">
        A loop with eight spots on it. Put something you have made in a free one and it stays
        for {PLACEMENT_DAYS} days — then you come back for it and the spot goes to someone
        else. Walk it every couple of weeks and it is never the same route twice.
      </p>

      <div className="row row--wrap" style={{ gap: 'var(--xs)', marginBottom: 'var(--md)' }}>
        <Badge tone="teal" icon={<MapPin size={13} />}>
          {freeCount} of {board.length} spots free
        </Badge>
        <Badge tone="neutral" icon={<Footprints size={13} />}>
          5.9 km · about 80 minutes
        </Badge>
        <Badge tone="pink" icon={<Trophy size={13} />}>
          {POINTS.place_art} to place · {POINTS.collect_art} to collect
        </Badge>
      </div>

      {mine ? (
        <Card className="twoweeks-mine">
          <div className="row row--between row--wrap" style={{ gap: 'var(--xs)' }}>
            <div>
              <h3 style={{ margin: 0 }}>Your piece is out there</h3>
              <p className="small muted" style={{ margin: '0.2rem 0 0' }}>
                <strong>{mine.title}</strong> at spot{' '}
                {spots.find((s) => s.id === mine.spot_id)?.number ?? '?'} ·{' '}
                {daysLabel(Math.max(0, Math.ceil(
                  (Date.parse(mine.collect_by) - now.getTime()) / 86_400_000,
                )))}{' '}
                (by {format(new Date(mine.collect_by), 'd MMM')})
              </p>
            </div>
            <Button
              variant="primary"
              onClick={() => void handleCollect(mine)}
              disabled={busy}
              icon={<PackageOpen size={15} />}
            >
              I have collected it
            </Button>
          </div>
          <p className="small muted" style={{ margin: '0.6rem 0 0' }}>
            If it is still there after the {PLACEMENT_DAYS} days, the municipality clears the
            spot and the piece is not kept.
          </p>
        </Card>
      ) : null}

      <Section title="The spots">
        <div className="grid grid--2 twoweeks-board">
          {board.map((entry, index) => (
            <SpotCard
              key={entry.spot.id}
              entry={entry}
              index={index}
              canPlace={Boolean(user) && !mine}
              signedIn={Boolean(user)}
              onPlace={() => setPlacing(entry.spot)}
            />
          ))}
        </div>
      </Section>

      {(data?.routes?.length ?? 0) > 0 ? (
        <Section title="Compare the walks">
          <RouteComparison routes={data?.routes ?? []} />
        </Section>
      ) : null}

      {otherWalks.length > 0 ? (
        <Section title="Other art walks">
          <div className="stack stack--xs">
            {otherWalks.map((route) => (
              <Card key={route.id} className="card--interactive">
                <h3 style={{ margin: 0 }}>{route.title}</h3>
                <p className="small muted" style={{ margin: '0.2rem 0 0.6rem' }}>
                  {route.distance_km} km · about {route.estimated_time_minutes} minutes
                </p>
                {route.description ? (
                  <p className="small" style={{ margin: '0 0 0.7rem' }}>
                    {route.description}
                  </p>
                ) : null}
                <AccessibilityIcons tags={route.accessibility} />
                <LinkButton
                  to={`/route/${route.id}`}
                  variant="text"
                  icon={<Footprints size={15} />}
                >
                  Walk it
                </LinkButton>
              </Card>
            ))}
          </div>
        </Section>
      ) : null}

      {!user ? (
        <Card style={{ marginTop: 'var(--md)' }}>
          <h3 style={{ marginTop: 0 }}>Want to put something out?</h3>
          <p className="small muted">
            You need an account so we know whose piece it is and who to remind before the
            two weeks are up.
          </p>
          <div className="row" style={{ gap: 'var(--xs)' }}>
            <LinkButton to="/signup" variant="primary">
              Sign up
            </LinkButton>
            <LinkButton to="/login" variant="text">
              Log in
            </LinkButton>
          </div>
        </Card>
      ) : null}

      <PlaceModal
        spot={placing}
        onClose={() => setPlacing(null)}
        onPlaced={async () => {
          await refresh();
          const fresh = await fetchCurrentUser();
          if (fresh) setUser(fresh);
          void markJourney('contributed');
        }}
      />
    </div>
  );
}

function SpotCard({
  entry,
  index,
  canPlace,
  signedIn,
  onPlace,
}: {
  entry: SpotBoardEntry;
  index: number;
  canPlace: boolean;
  signedIn: boolean;
  onPlace: () => void;
}) {
  const { spot, live, daysLeft, history } = entry;

  return (
    <Card
      className="card-enter twoweeks-spot"
      style={{ '--i': index } as React.CSSProperties}
    >
      <div className="row row--between" style={{ gap: 'var(--xs)' }}>
        <h3 style={{ margin: 0 }}>
          <span className="twoweeks-spot__number" aria-hidden="true">
            {spot.number}
          </span>
          {spot.label}
        </h3>
      </div>

      {live ? (
        <>
          <SafeImage
            src={live.image_url}
            alt={`${live.title}, by ${live.maker_name ?? 'an anonymous maker'}`}
            className="twoweeks-spot__image"
          />
          <div className="row row--wrap" style={{ gap: '0.35rem', marginTop: '0.6rem' }}>
            <Badge tone={URGENCY_TONE[urgencyOf(daysLeft ?? 0)]} icon={<CalendarClock size={13} />}>
              {daysLabel(daysLeft ?? 0)}
            </Badge>
          </div>
          <h4 style={{ margin: '0.6rem 0 0.2rem' }}>{live.title}</h4>
          <p className="small muted" style={{ margin: 0 }}>
            by {live.maker_name ?? 'anonymous'}
            {live.materials ? ` · ${live.materials}` : ''}
          </p>
          {live.description ? (
            <p className="small" style={{ margin: '0.5rem 0 0' }}>
              {live.description}
            </p>
          ) : null}
        </>
      ) : (
        <div className="twoweeks-spot__empty">
          <p className="small muted" style={{ margin: '0 0 0.4rem' }}>
            {spot.hint}
          </p>
          <p className="small muted" style={{ margin: '0 0 0.8rem' }}>
            <Ruler size={13} aria-hidden="true" /> Up to {spot.max_size_cm} cm on the longest
            side.
          </p>
          {canPlace ? (
            <Button variant="secondary" onClick={onPlace} icon={<Plus size={15} />}>
              Place something here
            </Button>
          ) : (
            <p className="small muted" style={{ margin: 0 }}>
              {signedIn
                ? 'Collect your current piece first — one at a time.'
                : 'Sign in to put something here.'}
            </p>
          )}
        </div>
      )}

      <AccessibilityIcons tags={spot.accessibility} />

      {history.length > 0 ? (
        <details className="twoweeks-spot__history">
          <summary className="small muted">
            {history.length} {history.length === 1 ? 'piece has' : 'pieces have'} been here
            before
          </summary>
          <ul className="small muted" style={{ margin: '0.4rem 0 0', paddingLeft: '1.1rem' }}>
            {history.slice(0, 5).map((old) => (
              <li key={old.id}>
                <strong>{old.title}</strong> — {old.maker_name ?? 'anonymous'},{' '}
                {format(new Date(old.placed_at), 'd MMM')}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </Card>
  );
}

function PlaceModal({
  spot,
  onClose,
  onPlaced,
}: {
  spot: RouteSpot | null;
  onClose: () => void;
  onPlaced: () => Promise<void>;
}) {
  const user = useAppStore((s) => s.user);
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [materials, setMaterials] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (spot) {
      setTitle('');
      setDescription('');
      setMaterials('');
      setImageUrl('');
    }
  }, [spot]);

  if (!spot) return null;

  async function submit() {
    if (!user || !spot) return;
    if (!title.trim()) {
      toast.error('Give it a title, even a plain one.');
      return;
    }
    setBusy(true);
    try {
      await placeArt(user.id, spot.id, {
        title: title.trim(),
        description: description.trim() || null,
        materials: materials.trim() || null,
        image_url: imageUrl.trim() || null,
      });
      await onPlaced();
      toast.success(
        `It is on the route. +${POINTS.place_art} points — come back for it within ${PLACEMENT_DAYS} days.`,
      );
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not place that.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={Boolean(spot)}
      onClose={onClose}
      title={`Spot ${spot.number}`}
      footer={
        <div className="row row--between" style={{ width: '100%' }}>
          <Button variant="text" onClick={onClose} icon={<X size={15} />}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={busy}>
            {busy ? 'Placing…' : `Place it — +${POINTS.place_art} points`}
          </Button>
        </div>
      }
    >
      <p className="small muted" style={{ marginTop: 0 }}>
        {spot.label}. {spot.hint} Up to {spot.max_size_cm} cm on the longest side.
      </p>

      <div className="field">
        <label className="field__label" htmlFor="place-title">
          What is it called?
        </label>
        <input
          id="place-title"
          className="input"
          value={title}
          maxLength={80}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Fifty Bicycle Bells"
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="place-desc">
          A line or two about it <span className="field__hint">(optional)</span>
        </label>
        <textarea
          id="place-desc"
          className="input"
          rows={3}
          maxLength={400}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What it is, or why you put it here."
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="place-materials">
          Made from <span className="field__hint">(optional)</span>
        </label>
        <input
          id="place-materials"
          className="input"
          value={materials}
          maxLength={80}
          onChange={(e) => setMaterials(e.target.value)}
          placeholder="Salvaged bells, galvanised wire"
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="place-image">
          Photo link <span className="field__hint">(optional)</span>
        </label>
        <input
          id="place-image"
          className="input"
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://…"
        />
      </div>

      <p className="small muted" style={{ marginBottom: 0 }}>
        You are agreeing to come back for it within {PLACEMENT_DAYS} days. After that the
        municipality clears the spot, and what was there is not kept.
      </p>
    </Modal>
  );
}
