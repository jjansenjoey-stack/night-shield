import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { addDays, endOfDay, format, isSameDay } from 'date-fns';
import { CalendarDays, Plus, SlidersHorizontal, X } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { CalendarGrid } from '@/components/events/CalendarGrid';
import { EventCard } from '@/components/events/EventCard';
import { DetailModal } from '@/components/details/DetailModal';
import { Modal } from '@/components/ui/Modal';
import { Button, LinkButton } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingBlock } from '@/components/ui/LoadingSpinner';
import { Field } from '@/components/ui/Shared';
import { applyEventFilters, type EventFilters } from '@/services/eventService';
import { eventToMapItem } from '@/services/api';
import { canUserPerformAction } from '@/lib/permissions';
import { a11yLabel, eventCategoryLabel } from '@/lib/format';
import type { EventCategory, NightEvent } from '@/types';

const CATEGORIES: EventCategory[] = ['workshop', 'art_talk', 'social', 'nightlife'];
const A11Y_FILTERS = ['wheelchair', 'quiet', 'hearing_loop', 'step_free', 'service_animal'];

/** Prompts 46 & 52 — calendar, upcoming list, and the filters over both. */
export function EventsCalendarPage() {
  const data = useAppStore((s) => s.data);
  const loading = useAppStore((s) => s.dataLoading);
  const user = useAppStore((s) => s.user);
  const userLocation = useAppStore((s) => s.userLocation);
  const setSelectedItem = useAppStore((s) => s.setSelectedItem);

  const [month, setMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [accessibility, setAccessibility] = useState<string[]>([]);
  const [cost, setCost] = useState<EventFilters['cost']>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [params, setParams] = useSearchParams();

  const allEvents = data?.events ?? [];

  const filtered = useMemo(
    () =>
      applyEventFilters(allEvents, {
        search,
        categories: categories.length ? categories : undefined,
        accessibility: accessibility.length ? accessibility : undefined,
        cost,
        maxDistanceKm: distance,
        origin: userLocation,
      }),
    [allEvents, search, categories, accessibility, cost, distance, userLocation],
  );

  const upcoming = useMemo(() => {
    if (!selectedDay) {
      const horizon = endOfDay(addDays(new Date(), 14));
      return filtered.filter((e) => new Date(e.start_time) <= horizon);
    }
    return filtered.filter((e) => isSameDay(new Date(e.start_time), selectedDay));
  }, [filtered, selectedDay]);

  // Deep link from a share or a reminder: /events?event=evt-…
  useEffect(() => {
    const target = params.get('event');
    if (!target || !data) return;
    const event = allEvents.find((e) => e.id === target);
    if (event) {
      const item = eventToMapItem(event) ?? {
        id: event.id,
        type: 'event' as const,
        title: event.title,
        subtitle: event.organizer_name,
        location: { latitude: 0, longitude: 0 },
        image: event.image_url,
        accessibility: event.accessibility,
        raw: event,
      };
      setSelectedItem(item);
    }
    params.delete('event');
    setParams(params, { replace: true });
  }, [params, data, allEvents, setSelectedItem, setParams]);

  function open(event: NightEvent) {
    const item = eventToMapItem(event) ?? {
      id: event.id,
      type: 'event' as const,
      title: event.title,
      subtitle: event.organizer_name,
      location: { latitude: 0, longitude: 0 },
      image: event.image_url,
      accessibility: event.accessibility,
      raw: event,
    };
    setSelectedItem(item);
  }

  const filterCount =
    (search ? 1 : 0) +
    categories.length +
    accessibility.length +
    (cost ? 1 : 0) +
    (distance ? 1 : 0);

  function clearAll() {
    setSearch('');
    setCategories([]);
    setAccessibility([]);
    setCost(null);
    setDistance(null);
  }

  if (loading && !data) return <LoadingBlock label="Loading events…" />;

  return (
    <div className="page">
      <div className="row row--between" style={{ marginBottom: '0.25rem' }}>
        <h1 style={{ fontSize: '1.8rem', margin: 0 }}>Events</h1>
        {canUserPerformAction(user, 'create_event') ? (
          <LinkButton to="/events/new" variant="primary" size="sm" icon={<Plus size={14} />}>
            New event
          </LinkButton>
        ) : null}
      </div>
      <p className="page__lede">Workshops, talks, walks and late openings across Tilburg.</p>

      <div className="row" style={{ marginBottom: '1rem' }}>
        <input
          className="input grow"
          type="search"
          value={search}
          placeholder="Search events…"
          aria-label="Search events"
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 320 }}
        />
        <Button
          variant={filterCount > 0 ? 'secondary' : 'text'}
          onClick={() => setFiltersOpen(true)}
          icon={<SlidersHorizontal size={15} />}
        >
          Filters{filterCount > 0 ? ` (${filterCount})` : ''}
        </Button>
        {filterCount > 0 ? (
          <Button variant="ghost" onClick={clearAll} icon={<X size={14} />}>
            Clear
          </Button>
        ) : null}
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <CalendarGrid
          month={month}
          onMonthChange={setMonth}
          selected={selectedDay}
          onSelect={setSelectedDay}
          events={filtered}
        />
      </div>

      <div className="row row--between" style={{ marginBottom: '0.5rem' }}>
        <h2 style={{ fontSize: '1.15rem', margin: 0 }}>
          {selectedDay ? format(selectedDay, 'EEEE d MMMM') : 'Next two weeks'}
        </h2>
        {selectedDay ? (
          <button className="link-btn" onClick={() => setSelectedDay(null)}>
            Show next two weeks
          </button>
        ) : null}
      </div>

      {upcoming.length === 0 ? (
        <EmptyState
          icon={<CalendarDays size={24} />}
          title={selectedDay ? 'Nothing on this day' : 'Nothing coming up'}
          message={
            filterCount > 0
              ? 'Try clearing a filter — there may be something just outside it.'
              : 'New events are added every week. Check back soon.'
          }
          action={
            filterCount > 0 ? (
              <Button variant="text" onClick={clearAll}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="stack stack--xs">
          {upcoming.map((event, i) => (
            <EventCard key={event.id} event={event} onSelect={() => open(event)} compact index={i} />
          ))}
        </div>
      )}

      <Modal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filter events"
        footer={
          <>
            <Button variant="text" onClick={clearAll}>
              Clear all
            </Button>
            <Button variant="primary" onClick={() => setFiltersOpen(false)}>
              Show {filtered.length} events
            </Button>
          </>
        }
      >
        <fieldset style={{ border: 0, padding: 0, margin: '0 0 1.25rem' }}>
          <legend className="field__label" style={{ marginBottom: '0.4rem' }}>
            Category
          </legend>
          <div className="row">
            {CATEGORIES.map((category) => {
              const active = categories.includes(category);
              return (
                <button
                  key={category}
                  className={`chip${active ? ' is-active' : ''}`}
                  aria-pressed={active}
                  onClick={() =>
                    setCategories((current) =>
                      active ? current.filter((c) => c !== category) : [...current, category],
                    )
                  }
                >
                  {eventCategoryLabel(category)}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset style={{ border: 0, padding: 0, margin: '0 0 1.25rem' }}>
          <legend className="field__label" style={{ marginBottom: '0.4rem' }}>
            Cost
          </legend>
          <div className="row">
            {(
              [
                [null, 'Any'],
                ['free', 'Free'],
                ['under10', 'Under €10'],
                ['paid', 'Paid'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={label}
                className={`chip${cost === value ? ' is-active' : ''}`}
                data-tone="teal"
                aria-pressed={cost === value}
                onClick={() => setCost(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <Field label="Within" htmlFor="event-distance" hint="Online events are always included.">
          <select
            id="event-distance"
            className="select"
            value={distance ?? ''}
            onChange={(e) => setDistance(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Any distance</option>
            <option value="1">1 km</option>
            <option value="5">5 km</option>
            <option value="15">15 km</option>
          </select>
        </Field>

        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field__label" style={{ marginBottom: '0.4rem' }}>
            Accessibility
          </legend>
          <div className="grid grid--2" style={{ gap: '0.4rem' }}>
            {A11Y_FILTERS.map((tag) => {
              const checked = accessibility.includes(tag);
              return (
                <label key={tag} className={`check${checked ? ' is-checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setAccessibility((current) =>
                        checked ? current.filter((t) => t !== tag) : [...current, tag],
                      )
                    }
                  />
                  <span>{a11yLabel(tag)}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </Modal>

      <DetailModal />
    </div>
  );
}
