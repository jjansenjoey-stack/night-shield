import { useMemo } from 'react';
import { Footprints, Hammer, Zap } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { POINTS } from '@/services/pointsService';
import { useAppStore } from '@/store/appStore';
import {
  ATTENDANCE_POINTS_MAX,
  ATTENDANCE_POINTS_MIN,
  eventAttendancePoints,
  REMOTE_FIND_RATIO,
} from '@/types';

/**
 * Every way to earn a point, and what it is worth.
 *
 * Written down because a currency nobody can see the price list for is not a
 * currency, it is a slot machine. The amounts are read from the same constants
 * the app awards from, so this table cannot drift from what actually happens.
 *
 * Grouped by effort rather than by feature, because the honest headline is that
 * the big numbers are attached to the hard things. Nothing pays more than
 * putting a piece of your own work in the street and coming back for it.
 */

interface Row {
  action: string;
  points: string;
  cadence: string;
  note?: string;
}

interface Group {
  key: string;
  title: string;
  blurb: string;
  Icon: typeof Zap;
  rows: Row[];
}

export function EarningGuide() {
  const data = useAppStore((s) => s.data);

  // Real ranges from the real data, so the table never quietly goes stale.
  const cacheRange = useMemo(() => {
    const values = (data?.caches ?? []).map((c) => c.points).filter((n) => Number.isFinite(n));
    if (values.length === 0) return null;
    return { min: Math.min(...values), max: Math.max(...values) };
  }, [data?.caches]);

  const eventRange = useMemo(() => {
    const values = (data?.events ?? []).map(eventAttendancePoints);
    if (values.length === 0) return null;
    return { min: Math.min(...values), max: Math.max(...values) };
  }, [data?.events]);

  const cacheLabel = cacheRange
    ? `${cacheRange.min}–${cacheRange.max}`
    : '6–16';
  const eventLabel = eventRange
    ? `${eventRange.min}–${eventRange.max}`
    : `${ATTENDANCE_POINTS_MIN}–${ATTENDANCE_POINTS_MAX}`;

  const groups: Group[] = [
    {
      key: 'moment',
      title: 'A moment',
      blurb: 'Things that take a tap or a minute. Worth little on purpose.',
      Icon: Zap,
      rows: [
        {
          action: 'Walk an art route again',
          points: String(POINTS.walk_art_route),
          cadence: 'once a week, per route',
          note: 'The work on the changing route has moved on since last time.',
        },
        { action: 'Save your first place', points: String(POINTS.save_first_item), cadence: 'once ever' },
        { action: 'RSVP to an event', points: String(POINTS.rsvp_event), cadence: 'once per event' },
        {
          action: 'Report how a place felt',
          points: String(POINTS.submit_feedback),
          cadence: 'once per place',
          note: 'Always anonymous. Three reports before a place gets a score.',
        },
      ],
    },
    {
      key: 'evening',
      title: 'An evening',
      blurb: 'Turning up somewhere, or walking somewhere, and doing it properly.',
      Icon: Footprints,
      rows: [
        {
          action: 'Review an event you went to',
          points: String(POINTS.event_feedback),
          cadence: 'once per event',
        },
        {
          action: 'Find a Night Cache',
          points: cacheLabel,
          cadence: 'once per cache',
          note: `Harder caches pay more. Answering from home instead of standing there pays ${Math.round(
            REMOTE_FIND_RATIO * 100,
          )}%.`,
        },
        {
          action: 'Turn up to an event',
          points: eventLabel,
          cadence: 'once per event',
          note: 'Set by the event: the longer and harder it is, the more it pays. Claimed with the code given out on the night.',
        },
        {
          action: 'Finish a route',
          points: String(POINTS.complete_route),
          cadence: 'once per route',
          note: 'The Night Cache Trail counts, and so does every cache on it.',
        },
      ],
    },
    {
      key: 'work',
      title: 'Real work',
      blurb: 'Making something, or adding something the city did not have. The only place the big numbers live.',
      Icon: Hammer,
      rows: [
        {
          action: 'Add art or a third space to the map',
          points: String(POINTS.submit_content),
          cadence: 'once per submission',
          note: 'Checked by a moderator before it appears.',
        },
        {
          action: 'Collect your art back',
          points: String(POINTS.collect_art),
          cadence: 'once per piece',
          note: 'Paid for the tidy-up, not the art. It is what keeps the route from becoming litter.',
        },
        {
          action: 'Put a piece on the changing route',
          points: String(POINTS.place_art),
          cadence: 'once per piece',
          note: 'The most anything pays. You make it, carry it there, and fix it down.',
        },
      ],
    },
  ];

  return (
    <div className="stack stack--xs">
      <p className="small muted" style={{ margin: 0 }}>
        Points are earned by taking part in the city, never bought. Each thing pays once — doing
        it twice does not pay twice.
      </p>

      {groups.map(({ key, title, blurb, Icon, rows }) => (
        <Card key={key} className="earning-group">
          <div className="row" style={{ gap: '0.5rem', marginBottom: '0.15rem' }}>
            <Icon size={16} aria-hidden="true" style={{ color: 'var(--accent2)' }} />
            <h3 style={{ margin: 0, fontSize: '1rem' }}>{title}</h3>
          </div>
          <p className="tiny muted" style={{ margin: '0 0 0.7rem' }}>
            {blurb}
          </p>

          <ul className="earning-list">
            {rows.map((row) => (
              <li key={row.action}>
                <div className="row row--between" style={{ gap: 'var(--xs)' }}>
                  <span className="small">{row.action}</span>
                  <Badge tone="pink">{row.points}</Badge>
                </div>
                <p className="tiny muted" style={{ margin: '0.15rem 0 0' }}>
                  {row.cadence}
                  {row.note ? ` · ${row.note}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
