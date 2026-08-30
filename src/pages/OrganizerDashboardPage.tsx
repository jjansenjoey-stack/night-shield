import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format } from 'date-fns';
import { Download, Star, TrendingUp, Users } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { Card, Section } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import { DetailModal } from '@/components/details/DetailModal';
import { eventToMapItem } from '@/services/api';
import { countGoing, getRsvpsForEvent, isPast } from '@/services/eventService';
import { eventCategoryLabel, formatEventDate } from '@/lib/format';
import { colors } from '@/styles/tokens';
import type { EventRsvp } from '@/types';

const PIE_COLORS = [colors.success, colors.accent2, colors.warning];

/** Prompt 54 — how an organizer's events are actually doing. */
export function OrganizerDashboardPage() {
  const user = useAppStore((s) => s.user);
  const data = useAppStore((s) => s.data);
  const rsvpCounts = useAppStore((s) => s.rsvpCounts);
  const setSelectedItem = useAppStore((s) => s.setSelectedItem);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Per-event RSVP rows. The store only holds the viewer's own RSVPs, but RLS
  // lets an organizer read every RSVP for an event they run — so fetch those
  // here rather than trying to slice a list that does not contain them.
  const [eventRsvps, setEventRsvps] = useState<EventRsvp[]>([]);

  const myEvents = useMemo(() => {
    if (!user || !data) return [];
    const mine =
      user.role === 'admin' ? data.events : data.events.filter((e) => e.organizer_id === user.id);

    // Soonest upcoming first — that is the one an organizer is working on —
    // then finished events, most recent first.
    const upcoming = mine.filter((e) => !isPast(e)).sort((a, b) => a.start_time.localeCompare(b.start_time));
    const past = mine.filter(isPast).sort((a, b) => b.start_time.localeCompare(a.start_time));
    return [...upcoming, ...past];
  }, [user, data]);

  const active = selectedId ?? myEvents[0]?.id ?? null;
  const activeEvent = myEvents.find((e) => e.id === active) ?? null;

  useEffect(() => {
    if (!active) {
      setEventRsvps([]);
      return undefined;
    }
    let live = true;
    getRsvpsForEvent(active)
      .then((rows) => live && setEventRsvps(rows))
      .catch(() => live && setEventRsvps([]));
    return () => {
      live = false;
    };
  }, [active]);

  const statusBreakdown = useMemo(() => {
    const counts = { going: 0, interested: 0, not_going: 0 };
    for (const row of eventRsvps) counts[row.rsvp_status] += 1;
    return [
      { name: 'Going', value: counts.going },
      { name: 'Interested', value: counts.interested },
      { name: 'Not going', value: counts.not_going },
    ].filter((row) => row.value > 0);
  }, [eventRsvps]);

  const rsvpTrend = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const row of eventRsvps) {
      const day = row.rsvped_at.slice(0, 10);
      buckets.set(day, (buckets.get(day) ?? 0) + 1);
    }
    let running = 0;
    return [...buckets.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, count]) => {
        running += count;
        return { day: format(new Date(day), 'd MMM'), rsvps: running, new: count };
      });
  }, [eventRsvps]);

  const perEvent = useMemo(
    () =>
      myEvents.slice(0, 8).map((event) => ({
        name: event.title.length > 18 ? `${event.title.slice(0, 17)}…` : event.title,
        going: countGoing(rsvpCounts, event.id),
        capacity: event.capacity ?? 0,
      })),
    [myEvents, rsvpCounts],
  );

  const totalGoing = useMemo(
    () => myEvents.reduce((sum, event) => sum + countGoing(rsvpCounts, event.id), 0),
    [myEvents, rsvpCounts],
  );

  const feedbackFor = useMemo(() => {
    if (!active || !data) return null;
    const rows = data.feedback.filter((f) => f.location_id === active && f.kind === 'event');
    if (rows.length === 0) return null;
    return {
      count: rows.length,
      average: rows.reduce((sum, r) => sum + r.safety_perception, 0) / rows.length,
      comments: rows.filter((r) => r.comment).slice(0, 5),
    };
  }, [active, data]);

  function exportCsv() {
    const header = ['Event', 'Start', 'Category', 'Capacity', 'Going', 'Cost (EUR)', 'Online'];
    const rows = myEvents.map((event) => [
      `"${event.title.replace(/"/g, '""')}"`,
      event.start_time,
      event.category,
      event.capacity ?? '',
      countGoing(rsvpCounts, event.id),
      event.cost_euros,
      event.is_virtual ? 'yes' : 'no',
    ]);

    const csv = [header, ...rows].map((row) => row.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'night-shield-events.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  if (myEvents.length === 0) {
    return (
      <div className="page">
        <h1 style={{ fontSize: '1.8rem' }}>Organizer dashboard</h1>
        <EmptyState
          icon={<TrendingUp size={24} />}
          title="No events yet"
          message="Create your first event and its numbers will show up here."
        />
      </div>
    );
  }

  return (
    <div className="page page--wide">
      <div className="row row--between" style={{ marginBottom: '0.25rem' }}>
        <h1 style={{ fontSize: '1.8rem', margin: 0 }}>Organizer dashboard</h1>
        <Button variant="text" size="sm" onClick={exportCsv} icon={<Download size={14} />}>
          Export CSV
        </Button>
      </div>
      <p className="page__lede">
        {myEvents.length} event{myEvents.length === 1 ? '' : 's'} · {totalGoing} RSVPs in total
      </p>

      <Section title="Your events">
        <div className="stack stack--xs">
          {myEvents.map((event) => {
            const going = countGoing(rsvpCounts, event.id);
            const isActive = event.id === active;
            return (
              <button
                key={event.id}
                className="list-row"
                style={isActive ? { borderColor: 'var(--accent1)' } : undefined}
                onClick={() => setSelectedId(event.id)}
                aria-pressed={isActive}
              >
                <span className="grow">
                  <span className="list-row__title" style={{ display: 'block' }}>
                    {event.title}
                  </span>
                  <span className="list-row__meta">
                    {formatEventDate(event.start_time)} · {eventCategoryLabel(event.category)}
                  </span>
                </span>
                <span className="row" style={{ gap: '0.35rem' }}>
                  <Badge tone={isPast(event) ? 'neutral' : 'success'}>
                    {isPast(event) ? 'Finished' : 'Upcoming'}
                  </Badge>
                  <Badge tone="teal">
                    <Users size={10} /> {event.capacity ? `${going}/${event.capacity}` : going}
                  </Badge>
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      {activeEvent ? (
        <>
          <div className="row row--between" style={{ marginBottom: '0.5rem' }}>
            <h2 style={{ fontSize: '1.2rem', margin: 0 }}>{activeEvent.title}</h2>
            <button
              className="link-btn"
              onClick={() => {
                const item = eventToMapItem(activeEvent);
                if (item) setSelectedItem(item);
              }}
            >
              Open event
            </button>
          </div>

          <div className="grid grid--2">
            <Card>
              <h4>RSVP status</h4>
              {statusBreakdown.length === 0 ? (
                <p className="small muted">No RSVPs yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={statusBreakdown}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {statusBreakdown.map((entry, index) => (
                        <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: colors.surfaceRaised,
                        border: `1px solid ${colors.border}`,
                        borderRadius: 8,
                        color: colors.neutral,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: colors.textMuted }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card>
              <h4>RSVPs over time</h4>
              {rsvpTrend.length === 0 ? (
                <p className="small muted">No RSVPs yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={rsvpTrend}>
                    <CartesianGrid stroke={colors.border} strokeDasharray="3 3" />
                    <XAxis dataKey="day" stroke={colors.textMuted} fontSize={11} />
                    <YAxis stroke={colors.textMuted} fontSize={11} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: colors.surfaceRaised,
                        border: `1px solid ${colors.border}`,
                        borderRadius: 8,
                        color: colors.neutral,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="rsvps"
                      stroke={colors.accent1}
                      strokeWidth={2}
                      dot={false}
                      name="Total RSVPs"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>

          <Section title="Attendance across your events">
            <Card>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={perEvent}>
                  <CartesianGrid stroke={colors.border} strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke={colors.textMuted} fontSize={11} />
                  <YAxis stroke={colors.textMuted} fontSize={11} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: colors.surfaceRaised,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 8,
                      color: colors.neutral,
                    }}
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: colors.textMuted }} />
                  <Bar dataKey="going" fill={colors.accent1} name="Going" radius={[4, 4, 0, 0]} />
                  <Bar
                    dataKey="capacity"
                    fill={colors.accent2}
                    name="Capacity"
                    radius={[4, 4, 0, 0]}
                    fillOpacity={0.35}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Section>

          {feedbackFor ? (
            <Section title="Feedback">
              <Card>
                <div className="row" style={{ gap: '0.4rem', marginBottom: '0.5rem' }}>
                  <Star size={18} color={colors.warning} fill={colors.warning} aria-hidden="true" />
                  <span className="stat__value">{feedbackFor.average.toFixed(1)}</span>
                  <span className="muted small">
                    / 5 across {feedbackFor.count} response
                    {feedbackFor.count === 1 ? '' : 's'}
                  </span>
                </div>
                {feedbackFor.comments.length > 0 ? (
                  <ul className="stack stack--xs" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {feedbackFor.comments.map((row) => (
                      <li key={row.id} className="small muted" style={{ borderLeft: `2px solid ${colors.border}`, paddingLeft: '0.6rem' }}>
                        {row.comment}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="small muted" style={{ margin: 0 }}>
                    Ratings only — nobody left a comment.
                  </p>
                )}
              </Card>
            </Section>
          ) : null}
        </>
      ) : null}

      <DetailModal />
    </div>
  );
}
