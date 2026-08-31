import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  Award,
  CalendarDays,
  Clock,
  GraduationCap,
  MapPin,
  Sparkles,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { fetchCurrentUser } from '@/services/authService';
import { useAppStore } from '@/store/appStore';
import { Card, ClickableCard, Section } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingBlock } from '@/components/ui/LoadingSpinner';
import { AccessibilityIcons, SafeImage } from '@/components/ui/Shared';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { EarningGuide } from '@/components/points/EarningGuide';
import {
  applyCourseFilters,
  cancelEnrolment,
  canCancel,
  disciplinesOf,
  enrolInCourse,
  FORMAT_LABELS,
  hasStarted,
  isFull,
  LEVEL_LABELS,
  placesLeft,
  pointsShort,
} from '@/services/courseService';
import { formatEuros } from '@/lib/format';
import type { Course, CourseFormat } from '@/types';

const FORMATS: CourseFormat[] = ['class', 'certificate', 'masterclass'];

/**
 * Workshops — spend points on artistic courses that normally cost money.
 *
 * This is where the points earned everywhere else in the app become something.
 * The framing matters: these places are bought by the Inclusivity Department
 * and earned by taking part in the city, so the thing standing between someone
 * and a certificate is participation rather than a bank balance.
 */
export function WorkshopsPage() {
  const user = useAppStore((s) => s.user);
  const courses = useAppStore((s) => s.courses);
  const enrolments = useAppStore((s) => s.enrolments);
  const enrolmentCounts = useAppStore((s) => s.enrolmentCounts);
  const coursesLoading = useAppStore((s) => s.coursesLoading);
  const refreshCourses = useAppStore((s) => s.refreshCourses);
  const setUser = useAppStore((s) => s.setUser);
  const markJourney = useAppStore((s) => s.markJourney);
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [formats, setFormats] = useState<CourseFormat[]>([]);
  const [discipline, setDiscipline] = useState<string | null>(null);
  const [affordableOnly, setAffordableOnly] = useState(false);
  const [selected, setSelected] = useState<Course | null>(null);
  const [busy, setBusy] = useState(false);

  const points = user?.points ?? 0;

  /*
   * Depends on the user id, not just on mount. The session resolves
   * asynchronously in bootstrap(), so a mount-only fetch runs while `user` is
   * still null, skips the enrolment lookup, and leaves "Your places" empty for
   * someone who is in fact enrolled.
   */
  useEffect(() => {
    void refreshCourses();
  }, [refreshCourses, user?.id]);

  const mine = useMemo(
    () => new Map(enrolments.filter((e) => e.status !== 'cancelled').map((e) => [e.course_id, e])),
    [enrolments],
  );

  const visible = useMemo(
    () =>
      applyCourseFilters(courses, {
        search,
        formats: formats.length ? formats : undefined,
        disciplines: discipline ? [discipline] : undefined,
        affordableWith: affordableOnly ? points : null,
      }),
    [courses, search, formats, discipline, affordableOnly, points],
  );

  const myCourses = useMemo(
    () => courses.filter((c) => mine.has(c.id)).sort((a, b) => a.starts_on.localeCompare(b.starts_on)),
    [courses, mine],
  );

  const disciplines = useMemo(() => disciplinesOf(courses), [courses]);

  async function handleEnrol(course: Course) {
    if (!user) return;
    setBusy(true);
    try {
      await enrolInCourse(user.id, course.id);
      // The debit happens server-side; pull the fresh balance rather than
      // subtracting locally and hoping the two agree.
      await refreshCourses();
      const fresh = await fetchCurrentUser();
      if (fresh) setUser(fresh);

      void markJourney('grown');
      toast.success(`Place reserved — ${course.points_cost} points spent.`);
      setSelected(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not take that place.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel(course: Course) {
    if (!user) return;
    setBusy(true);
    try {
      await cancelEnrolment(user.id, course.id);
      await refreshCourses();
      const fresh = await fetchCurrentUser();
      if (fresh) setUser(fresh);

      toast.success(`Place released — ${course.points_cost} points back.`);
      setSelected(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not cancel that.');
    } finally {
      setBusy(false);
    }
  }

  if (coursesLoading && courses.length === 0) return <LoadingBlock label="Loading courses…" />;

  const filtersActive = Boolean(search || formats.length || discipline || affordableOnly);

  return (
    <div className="page">
      <h1 className="page__title" style={{ fontSize: '1.8rem' }}>
        Workshops
      </h1>
      <p className="page__lede">
        Art courses and short certificates around Tilburg — <strong>redeemed with points, not
        money</strong>. You earn points by taking part in the city: reporting how a street felt,
        walking a route, finding a Night Cache, turning up to an event.
      </p>

      <Card style={{ marginBottom: 'var(--md)' }}>
        <div className="row row--between">
          <span className="row" style={{ gap: '0.5rem' }}>
            <Trophy size={22} color="var(--warning)" aria-hidden="true" />
            <span>
              <span className="stat__value">{points}</span>
              <span className="muted small"> points to spend</span>
            </span>
          </span>
          {!user ? (
            <LinkButton to="/login" variant="primary" size="sm">
              Log in to spend
            </LinkButton>
          ) : (
            <span className="tiny muted">
              {visible.filter((c) => c.points_cost <= points).length} of {visible.length} within
              reach
            </span>
          )}
        </div>
      </Card>

      <details className="earning-guide">
        <summary>
          <span className="row" style={{ gap: '0.45rem' }}>
            <Sparkles size={15} aria-hidden="true" />
            How to earn points — every action and what it pays
          </span>
        </summary>
        <div style={{ marginTop: 'var(--xs)' }}>
          <EarningGuide />
        </div>
      </details>

      {myCourses.length > 0 ? (
        <Section title="Your places">
          <div className="stack stack--xs">
            {myCourses.map((course) => (
              <button
                key={course.id}
                className="list-row"
                onClick={() => setSelected(course)}
              >
                <span className="list-row__thumb" aria-hidden="true">
                  <GraduationCap size={18} />
                </span>
                <span className="grow">
                  <span className="list-row__title" style={{ display: 'block' }}>
                    {course.title}
                  </span>
                  <span className="list-row__meta">
                    {course.provider} · starts {format(new Date(course.starts_on), 'd MMM')}
                  </span>
                </span>
                <Badge tone={hasStarted(course) ? 'neutral' : 'success'}>
                  {hasStarted(course) ? 'Running' : 'Reserved'}
                </Badge>
              </button>
            ))}
          </div>
        </Section>
      ) : null}

      <div className="row" style={{ marginBottom: '0.75rem' }}>
        <input
          className="input grow"
          type="search"
          value={search}
          placeholder="Search courses…"
          aria-label="Search courses"
          onChange={(event) => setSearch(event.target.value)}
          style={{ maxWidth: 300 }}
        />
        {filtersActive ? (
          <Button
            variant="ghost"
            icon={<X size={14} />}
            onClick={() => {
              setSearch('');
              setFormats([]);
              setDiscipline(null);
              setAffordableOnly(false);
            }}
          >
            Clear
          </Button>
        ) : null}
      </div>

      <div className="filter-chips" style={{ marginBottom: '0.5rem' }} role="group" aria-label="Filter courses">
        <button
          className={`chip${affordableOnly ? ' is-active' : ''}`}
          onClick={() => setAffordableOnly((value) => !value)}
          aria-pressed={affordableOnly}
        >
          <Sparkles size={13} aria-hidden="true" />
          I can afford it
        </button>
        {FORMATS.map((value) => {
          const active = formats.includes(value);
          return (
            <button
              key={value}
              className={`chip${active ? ' is-active' : ''}`}
              data-tone="teal"
              aria-pressed={active}
              onClick={() =>
                setFormats((current) =>
                  active ? current.filter((f) => f !== value) : [...current, value],
                )
              }
            >
              {FORMAT_LABELS[value]}
            </button>
          );
        })}
      </div>

      <div className="filter-chips" style={{ marginBottom: '1.25rem' }} role="group" aria-label="Filter by discipline">
        {disciplines.map((value) => (
          <button
            key={value}
            className={`chip${discipline === value ? ' is-active' : ''}`}
            data-tone="teal"
            aria-pressed={discipline === value}
            onClick={() => setDiscipline((current) => (current === value ? null : value))}
          >
            {value}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<GraduationCap size={24} />}
          title="Nothing matches that"
          message={
            affordableOnly
              ? 'Nothing in reach yet. Points come from reporting how a place felt, walking routes, finding caches and turning up to events.'
              : 'Try clearing a filter — the next intake may just be outside it.'
          }
          action={
            affordableOnly ? (
              <LinkButton to="/discover" variant="text">
                Go and earn some
              </LinkButton>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid--2">
          {visible.map((course, cardIndex) => {
            const taken = enrolmentCounts.get(course.id) ?? 0;
            const enrolled = mine.has(course.id);
            const short = pointsShort(course, points);

            return (
              <ClickableCard
                key={course.id}
                flush
                label={`Open course: ${course.title}`}
                index={cardIndex}
                onSelect={() => setSelected(course)}
              >
                <SafeImage
                  src={course.image_url}
                  alt=""
                  style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }}
                />
                <div style={{ padding: '0.85rem' }}>
                  <div className="row" style={{ marginBottom: '0.4rem' }}>
                    <Badge tone="teal">{FORMAT_LABELS[course.format]}</Badge>
                    {/* A gentle pulse marks the ones already within reach. */}
                    <Badge
                      tone={short === 0 ? 'success' : 'neutral'}
                      className={short === 0 && user ? 'badge--affordable' : undefined}
                    >
                      {course.points_cost} pts
                    </Badge>
                    {enrolled ? <Badge tone="success">Reserved</Badge> : null}
                    {!enrolled && isFull(course, taken) ? (
                      <Badge tone="warning">Full</Badge>
                    ) : null}
                  </div>

                  <h3 style={{ fontSize: '1.05rem', marginBottom: '0.15rem' }}>{course.title}</h3>
                  <p className="tiny muted" style={{ marginBottom: '0.4rem' }}>
                    {course.provider} · {course.discipline}
                  </p>

                  {course.certificate ? (
                    <p className="tiny row" style={{ gap: '0.3rem', color: 'var(--accent2)', margin: '0 0 0.4rem' }}>
                      <Award size={11} aria-hidden="true" />
                      {course.certificate}
                    </p>
                  ) : null}

                  <div className="row tiny muted" style={{ gap: '0.75rem' }}>
                    <span className="row" style={{ gap: '0.2rem' }}>
                      <CalendarDays size={11} aria-hidden="true" />
                      {format(new Date(course.starts_on), 'd MMM')}
                    </span>
                    <span className="row" style={{ gap: '0.2rem' }}>
                      <Clock size={11} aria-hidden="true" />
                      {course.sessions} × {Math.round(course.hours_total / course.sessions)}h
                    </span>
                    <span className="row" style={{ gap: '0.2rem' }}>
                      <Users size={11} aria-hidden="true" />
                      {placesLeft(course, taken)} left
                    </span>
                  </div>

                  {/* The exchange rate, stated plainly. */}
                  <p className="tiny muted" style={{ margin: '0.4rem 0 0' }}>
                    Normally {formatEuros(course.cash_cost_euros)} — yours for{' '}
                    {course.points_cost} points
                    {short > 0 && user ? ` · ${short} short` : ''}
                  </p>
                </div>
              </ClickableCard>
            );
          })}
        </div>
      )}

      {selected ? (
        <CourseModal
          course={selected}
          taken={enrolmentCounts.get(selected.id) ?? 0}
          enrolled={mine.has(selected.id)}
          points={points}
          signedIn={Boolean(user)}
          busy={busy}
          onEnrol={() => handleEnrol(selected)}
          onCancel={() => handleCancel(selected)}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}

interface ModalProps {
  course: Course;
  taken: number;
  enrolled: boolean;
  points: number;
  signedIn: boolean;
  busy: boolean;
  onEnrol: () => void;
  onCancel: () => void;
  onClose: () => void;
}

function CourseModal({
  course,
  taken,
  enrolled,
  points,
  signedIn,
  busy,
  onEnrol,
  onCancel,
  onClose,
}: ModalProps) {
  const short = pointsShort(course, points);
  const full = isFull(course, taken);
  const started = hasStarted(course);

  return (
    <Modal
      open
      onClose={onClose}
      title={course.title}
      footer={
        enrolled ? (
          <>
            <Badge tone="success">Your place is reserved</Badge>
            {canCancel(course) ? (
              <Button variant="text" onClick={onCancel} loading={busy}>
                Release my place (points refunded)
              </Button>
            ) : (
              <span className="tiny muted">
                Already running — talk to {course.provider} to change anything.
              </span>
            )}
          </>
        ) : !signedIn ? (
          <LinkButton to="/login" variant="primary">
            Log in to take a place
          </LinkButton>
        ) : (
          <Button
            variant="primary"
            onClick={onEnrol}
            loading={busy}
            disabled={short > 0 || full || started}
            icon={<GraduationCap size={15} />}
          >
            {started
              ? 'Already started'
              : full
                ? 'Full'
                : short > 0
                  ? `${short} points short`
                  : `Take a place — ${course.points_cost} points`}
          </Button>
        )
      }
    >
      <div className="stack">
        <div className="row">
          <Badge tone="teal">{FORMAT_LABELS[course.format]}</Badge>
          <Badge tone="neutral">{course.discipline}</Badge>
          <Badge tone="neutral">{LEVEL_LABELS[course.level]}</Badge>
          {course.materials_included ? <Badge tone="success">Materials included</Badge> : null}
        </div>

        <p className="muted small" style={{ margin: 0 }}>
          {course.provider}
        </p>

        <p style={{ margin: 0 }}>{course.description}</p>

        {course.certificate ? (
          <Card style={{ background: 'rgba(0, 217, 255, 0.08)', borderColor: 'rgba(0,217,255,0.3)' }}>
            <p className="small row row--top" style={{ gap: '0.5rem', margin: 0 }}>
              <Award size={16} color="var(--accent2)" aria-hidden="true" style={{ flexShrink: 0 }} />
              <span>
                <strong>You finish with:</strong> {course.certificate}
              </span>
            </p>
          </Card>
        ) : null}

        <div className="stat-row">
          <div className="stat">
            <span className="stat__value">{course.sessions}</span>
            <span className="stat__label">Sessions</span>
          </div>
          <div className="stat">
            <span className="stat__value">{course.hours_total}h</span>
            <span className="stat__label">In total</span>
          </div>
          <div className="stat">
            <span className="stat__value">{placesLeft(course, taken)}</span>
            <span className="stat__label">Places left</span>
          </div>
        </div>

        <div className="row small" style={{ gap: '1rem' }}>
          <span className="row" style={{ gap: '0.3rem' }}>
            <CalendarDays size={14} aria-hidden="true" />
            Starts {format(new Date(course.starts_on), 'EEEE d MMMM, HH:mm')}
          </span>
          {course.address ? (
            <span className="row" style={{ gap: '0.3rem' }}>
              <MapPin size={14} aria-hidden="true" />
              {course.address}
            </span>
          ) : null}
        </div>

        {/*
          Stating the market price is the whole argument: it makes visible that
          participation is being valued at something real, and that the barrier
          removed here is a financial one.
        */}
        <Card style={{ background: 'rgba(255, 209, 102, 0.08)', borderColor: 'rgba(255,209,102,0.3)' }}>
          <div className="row row--between">
            <span className="small">
              Open-market price
              <span className="muted"> · {formatEuros(course.cash_cost_euros)}</span>
            </span>
            <span className="row" style={{ gap: '0.35rem' }}>
              <Trophy size={15} color="var(--warning)" aria-hidden="true" />
              <strong>{course.points_cost} points</strong>
            </span>
          </div>
          <p className="tiny muted" style={{ margin: '0.4rem 0 0' }}>
            The Inclusivity Department buys these places. You earn them by taking part in the city,
            not by being able to pay for them.
          </p>
          {signedIn && short > 0 ? (
            <p className="tiny" style={{ margin: '0.4rem 0 0', color: 'var(--warning)' }}>
              You have {points}. Another {short} points and this is yours.
            </p>
          ) : null}
        </Card>

        {course.accessibility.length > 0 ? (
          <div>
            <h4 style={{ marginBottom: '0.35rem' }}>Getting in</h4>
            <AccessibilityIcons tags={course.accessibility} />
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
