import { useMemo } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { NightEvent } from '@/types';

interface Props {
  month: Date;
  onMonthChange: (month: Date) => void;
  selected: Date | null;
  onSelect: (day: Date | null) => void;
  events: NightEvent[];
}

/** Prompt 46 — month grid with a dot per event. */
export function CalendarGrid({ month, onMonthChange, selected, onSelect, events }: Props) {
  const days = useMemo(() => {
    // Weeks start Monday — Dutch convention.
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const byDay = useMemo(() => {
    const map = new Map<string, NightEvent[]>();
    for (const event of events) {
      const key = format(new Date(event.start_time), 'yyyy-MM-dd');
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    return map;
  }, [events]);

  return (
    <div>
      <div className="row row--between" style={{ marginBottom: '0.5rem' }}>
        <button
          className="btn btn--ghost"
          onClick={() => onMonthChange(subMonths(month, 1))}
          aria-label="Previous month"
        >
          <ChevronLeft size={18} />
        </button>
        <strong className="mono" aria-live="polite">
          {format(month, 'MMMM yyyy')}
        </strong>
        <button
          className="btn btn--ghost"
          onClick={() => onMonthChange(addMonths(month, 1))}
          aria-label="Next month"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <p className="tiny muted calendar__hint">
        Tap a highlighted day to see what is on. Tap it again to go back.
      </p>

      {/*
        Deliberately not role="grid". A real grid needs row/rowgroup children
        and roving tabindex; role="gridcell" would also strip the day buttons of
        their native button role, taking aria-pressed with it. These are plain
        buttons with full labels, which screen readers handle correctly.
      */}
      <div className="calendar" role="group" aria-label={`Events in ${format(month, 'MMMM yyyy')}`}>
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((label) => (
          <div key={label} className="calendar__dow" aria-hidden="true">
            {label}
          </div>
        ))}

        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const dayEvents = byDay.get(key) ?? [];
          const isSelected = selected ? isSameDay(day, selected) : false;

          const classes = [
            'calendar__day',
            !isSameMonth(day, month) ? 'is-outside' : '',
            isToday(day) ? 'is-today' : '',
            isSelected ? 'is-selected' : '',
            dayEvents.length > 0 ? 'has-events' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <button
              key={key}
              type="button"
              className={classes}
              aria-pressed={isSelected}
              aria-label={`${format(day, 'EEEE d MMMM')} — ${
                dayEvents.length === 0
                  ? 'no events'
                  : `${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}`
              }`}
              onClick={() => onSelect(isSelected ? null : day)}
            >
              <span>{format(day, 'd')}</span>
              <span className="calendar__dots" aria-hidden="true">
                {dayEvents.slice(0, 3).map((event) => (
                  <span key={event.id} className="calendar__dot" />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
