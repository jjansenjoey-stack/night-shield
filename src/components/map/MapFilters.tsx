import { useState } from 'react';
import {
  Brush,
  CalendarDays,
  Coffee,
  Route as RouteIcon,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useAppStore, type DistanceBand, type TimeFilter } from '@/store/appStore';
import { useFilteredItems } from '@/hooks/useFilteredItems';
import { a11yLabel } from '@/lib/format';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { ItemType } from '@/types';

const TYPE_CHIPS: Array<{ type: ItemType; label: string; Icon: typeof Brush; tone: string }> = [
  { type: 'installation', label: 'Art', Icon: Brush, tone: 'pink' },
  { type: 'event', label: 'Events', Icon: CalendarDays, tone: 'pink' },
  { type: 'route', label: 'Routes', Icon: RouteIcon, tone: 'teal' },
  { type: 'third_space', label: 'Third spaces', Icon: Coffee, tone: 'teal' },
  { type: 'cache', label: 'Caches', Icon: Search, tone: 'pink' },
];

const DISTANCE_OPTIONS: Array<{ value: DistanceBand; label: string }> = [
  { value: 'any', label: 'Any distance' },
  { value: 'near', label: 'Within 1 km' },
  { value: 'mid', label: '1–3 km' },
  { value: 'far', label: '3 km +' },
];

const TIME_OPTIONS: Array<{ value: TimeFilter; label: string }> = [
  { value: 'any', label: 'Any time' },
  { value: 'now', label: 'Active now' },
  { value: 'evening', label: 'Evening' },
  { value: 'night', label: 'Night' },
];

/** The accessibility needs people actually filter on most. */
const A11Y_FILTERS = ['wheelchair', 'quiet', 'pet_friendly', 'step_free', 'well_lit', 'hearing_loop'];

export function MapFilters() {
  const activeTypes = useAppStore((s) => s.activeTypes);
  const toggleType = useAppStore((s) => s.toggleType);
  const accessibilityFilters = useAppStore((s) => s.accessibilityFilters);
  const toggleAccessibility = useAppStore((s) => s.toggleAccessibility);
  const distanceBand = useAppStore((s) => s.distanceBand);
  const setDistanceBand = useAppStore((s) => s.setDistanceBand);
  const timeFilter = useAppStore((s) => s.timeFilter);
  const setTimeFilter = useAppStore((s) => s.setTimeFilter);
  const clearFilters = useAppStore((s) => s.clearFilters);
  const activeFilterCount = useAppStore((s) => s.activeFilterCount);

  const { items, total } = useFilteredItems();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const extraCount = activeFilterCount();

  return (
    <>
      <div className="filter-chips" role="group" aria-label="Filter what appears on the map">
        {TYPE_CHIPS.map(({ type, label, Icon, tone }) => {
          const active = activeTypes.includes(type);
          return (
            <button
              key={type}
              className={`chip${active ? ' is-active' : ''}`}
              data-tone={tone}
              onClick={() => toggleType(type)}
              aria-pressed={active}
            >
              <Icon size={13} aria-hidden="true" />
              {label}
            </button>
          );
        })}

        <button
          className={`chip${extraCount > 0 ? ' is-active' : ''}`}
          data-tone="teal"
          onClick={() => setAdvancedOpen(true)}
        >
          <SlidersHorizontal size={13} aria-hidden="true" />
          Filters
          {extraCount > 0 ? <span className="pill-count">{extraCount}</span> : null}
        </button>

        {extraCount > 0 ? (
          <button className="chip" onClick={clearFilters}>
            <X size={13} aria-hidden="true" />
            Clear
          </button>
        ) : null}
      </div>

      <p
        className="tiny muted"
        style={{ margin: 0, paddingLeft: '0.35rem' }}
        role="status"
        aria-live="polite"
      >
        Showing {items.length} of {total} locations
      </p>

      <Modal
        open={advancedOpen}
        onClose={() => setAdvancedOpen(false)}
        title="Filters"
        footer={
          <>
            <Button
              variant="text"
              onClick={() => {
                clearFilters();
                setAdvancedOpen(false);
              }}
            >
              Clear all
            </Button>
            <Button variant="primary" onClick={() => setAdvancedOpen(false)}>
              Show {items.length} results
            </Button>
          </>
        }
      >
        <fieldset style={{ border: 0, padding: 0, margin: '0 0 1.25rem' }}>
          <legend className="field__label" style={{ marginBottom: '0.4rem' }}>
            Distance
          </legend>
          <div className="row">
            {DISTANCE_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={`chip${distanceBand === option.value ? ' is-active' : ''}`}
                onClick={() => setDistanceBand(option.value)}
                aria-pressed={distanceBand === option.value}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset style={{ border: 0, padding: 0, margin: '0 0 1.25rem' }}>
          <legend className="field__label" style={{ marginBottom: '0.4rem' }}>
            When
          </legend>
          <div className="row">
            {TIME_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={`chip${timeFilter === option.value ? ' is-active' : ''}`}
                data-tone="teal"
                onClick={() => setTimeFilter(option.value)}
                aria-pressed={timeFilter === option.value}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="field__hint" style={{ marginTop: '0.4rem' }}>
            Time filters apply to events. Art, routes and third spaces stay visible.
          </p>
        </fieldset>

        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field__label" style={{ marginBottom: '0.4rem' }}>
            Accessibility
          </legend>
          <div className="grid grid--2" style={{ gap: '0.4rem' }}>
            {A11Y_FILTERS.map((tag) => {
              const checked = accessibilityFilters.includes(tag);
              return (
                <label key={tag} className={`check${checked ? ' is-checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleAccessibility(tag)}
                  />
                  <span>{a11yLabel(tag)}</span>
                </label>
              );
            })}
          </div>
          <p className="field__hint" style={{ marginTop: '0.4rem' }}>
            Results must match every box you tick.
          </p>
        </fieldset>
      </Modal>
    </>
  );
}
