import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  CalendarClock,
  Footprints,
  MapPin,
  PackageOpen,
  Plus,
  Ruler,
  Search,
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
import { ExampleBadge } from '@/components/ui/ExampleBadge';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { RouteComparison } from '@/components/routes/RouteComparison';
import { ArtGallery } from '@/components/routes/ArtGallery';
import { fileToCompressedDataUrl } from '@/lib/image';
import { POINTS } from '@/services/pointsService';
import {
  buildBoard,
  CHANGING_ROUTE_ID,
  collectPlacement,
  currentPlacement,
  getPlacements,
  getPlacementFinds,
  getSpots,
  logPlacementFind,
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
  const [foundIds, setFoundIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    const [nextSpots, nextPlacements] = await Promise.all([
      getSpots(CHANGING_ROUTE_ID),
      getPlacements(CHANGING_ROUTE_ID),
    ]);
    setSpots(nextSpots);
    setPlacements(nextPlacements);

    const me = useAppStore.getState().user;
    if (me) {
      const finds = await getPlacementFinds(me.id).catch(() => []);
      setFoundIds(new Set(finds.map((f) => f.placement_id)));
    } else {
      setFoundIds(new Set());
    }
  }, []);

  async function handleFind(placement: Placement) {
    if (!user) return;
    setBusy(true);
    try {
      // The position is checked by the backend against the spot, so a browser
      // that refuses location simply cannot log a find.
      const at = await new Promise<GeolocationPosition | null>((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), {
          enableHighAccuracy: true,
          timeout: 8000,
        });
      });

      await logPlacementFind(
        user.id,
        placement.id,
        at ? { latitude: at.coords.latitude, longitude: at.coords.longitude } : null,
      );
      await refresh();
      const fresh = await fetchCurrentUser();
      if (fresh) setUser(fresh);
      toast.success(`Found it. +${POINTS.find_art} points.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not log that find.');
    } finally {
      setBusy(false);
    }
  }

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
        Walks through Tilburg built around what people have made. There are two kinds.{' '}
        <strong>Two Weeks Only</strong> changes every fortnight, because anyone can put their own
        work on it and then take it home again. The others are permanent — the same artworks are
        there whenever you go. Each walk says which kind it is.
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
              foundIds={foundIds}
              onFind={(p) => void handleFind(p)}
              busy={busy}
            />
          ))}
        </div>
      </Section>

      {/*
        Two things on this page ask people to walk around looking for something,
        and they are not the same thing. Saying so plainly, next to each other,
        is the only way anyone will keep them straight.
      */}
      {/*
        Its own section, about caches and nothing else.

        This used to sit Two Weeks Only in a column beside it, which put the
        fortnight rule inside a heading that said "Night Caches" and made it
        look as though caches expired too. They do not: the two-week clock
        belongs to the art route above and to nothing else on this page.
      */}
      <Section title="The gallery">
        <ArtGallery placements={placements} spots={spots} />
      </Section>

      {(data?.routes?.length ?? 0) > 0 ? (
        <Section title="Compare the walks">
          <RouteComparison routes={data?.routes ?? []} />
        </Section>
      ) : null}

      {otherWalks.length > 0 ? (
        <Section title="Permanent walks">
          <p className="small muted" style={{ margin: '0 0 0.7rem' }}>
            These do not change. The same artworks are there whenever you go, so the
            two-week rule above does not apply to any of them. One of them is the Night
            Cache trail, which links all eight caches into a single walk —{' '}
            <Link to="/explore">the caches themselves live in Explore</Link>, where you can
            see what each one is worth and tick them off as you find them.
          </p>
          <div className="stack stack--xs">
            {otherWalks.map((route) => (
              <Card key={route.id} className="card--interactive">
                <h3 style={{ margin: 0 }}>{route.title}</h3>
                <p className="tiny" style={{ margin: '0.2rem 0 0.15rem' }}>
                  {route.rotates ? (
                    <span style={{ color: 'var(--accent1)' }}>
                      Changes every 2 weeks — anyone can add work
                    </span>
                  ) : (
                    <span className="muted">Same all year — permanent artworks</span>
                  )}
                </p>
                <p className="small muted" style={{ margin: '0 0 0.6rem' }}>
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
  foundIds,
  onFind,
  busy,
}: {
  entry: SpotBoardEntry;
  index: number;
  canPlace: boolean;
  signedIn: boolean;
  onPlace: () => void;
  foundIds: Set<string>;
  onFind: (placement: Placement) => void;
  busy: boolean;
}) {
  const { spot, live, daysLeft, history } = entry;

  /*
   * A hidden piece stays hidden until you have actually found it. Showing the
   * photo and title next to the clue would give the game away before anyone
   * left the house.
   */
  const hidden = Boolean(live?.hunt_clue) && !(live && foundIds.has(live.id));

  if (live && hidden) {
    return (
      <Card
        className="card-enter twoweeks-spot twoweeks-spot--hunt"
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

        <div className="twoweeks-spot__empty" style={{ borderStyle: 'solid' }}>
          <Badge tone="pink" icon={<Search size={12} />}>
            Something is hidden here
          </Badge>
          <p className="small" style={{ margin: '0.6rem 0 0.4rem' }}>
            <strong>Clue:</strong> {live.hunt_clue}
          </p>
          <p className="tiny muted" style={{ margin: '0 0 0.7rem' }}>
            Go and look. When you have it in front of you, tap below — we check you are
            actually there. Worth {POINTS.find_art} points.
          </p>
          {signedIn ? (
            <Button variant="secondary" onClick={() => onFind(live)} disabled={busy}>
              I found it
            </Button>
          ) : (
            <p className="small muted" style={{ margin: 0 }}>
              Sign in to log a find.
            </p>
          )}
        </div>

        <AccessibilityIcons tags={spot.accessibility} />
      </Card>
    );
  }

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
            <ExampleBadge show={live.is_example} />
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
  const [huntClue, setHuntClue] = useState('');
  const [isHunt, setIsHunt] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (spot) {
      setTitle('');
      setDescription('');
      setMaterials('');
      setImageUrl('');
      setHuntClue('');
      setIsHunt(false);
    }
  }, [spot]);

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    try {
      // Shrunk before it is stored — see lib/image.ts for why that matters.
      setImageUrl(await fileToCompressedDataUrl(file));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not read that photo.');
    }
  }

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
        hunt_clue: isHunt ? huntClue.trim() || null : null,
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
        <label className="field__label" htmlFor="place-photo">
          Photo <span className="field__hint">(optional)</span>
        </label>
        <input
          id="place-photo"
          className="input"
          type="file"
          accept="image/*"
          onChange={(e) => void pickPhoto(e.target.files?.[0])}
        />
        <p className="field__hint">
          Taken on your phone is fine. It is made smaller before it is saved.
        </p>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="The piece you are placing"
            style={{
              width: '100%',
              maxHeight: 160,
              objectFit: 'cover',
              borderRadius: 'var(--r-sm)',
              marginTop: '0.4rem',
            }}
          />
        ) : null}
      </div>

      {/*
        The hunt. The spots are public, so this is not "where is spot 5" — it is
        what is at it and where exactly, which turns a walk past into a two
        minute search. Finding one is worth a few points to whoever does it.
      */}
      <div className="field">
        <label className="row" style={{ gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={isHunt}
            onChange={(e) => setIsHunt(e.target.checked)}
          />
          <span className="small">
            <strong>Hide it and leave a clue</strong> — make it something to find
          </span>
        </label>

        {isHunt ? (
          <>
            <input
              className="input"
              value={huntClue}
              maxLength={140}
              onChange={(e) => setHuntClue(e.target.value)}
              placeholder="Behind the third fence post, low down"
              aria-label="Your clue"
              style={{ marginTop: '0.4rem' }}
            />
            <p className="field__hint">
              People who find it earn {POINTS.find_art} points, and you can see how many did.
            </p>
          </>
        ) : null}
      </div>

      <p className="small muted" style={{ marginBottom: 0 }}>
        You are agreeing to come back for it within {PLACEMENT_DAYS} days. After that the
        municipality clears the spot, and what was there is not kept.
      </p>
    </Modal>
  );
}
