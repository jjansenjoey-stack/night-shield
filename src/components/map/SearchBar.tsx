import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Search, X } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { toMapItems } from '@/services/api';
import { itemTypeLabel } from '@/lib/format';
import { formatDistance } from '@/lib/geo';
import { distanceKm } from '@/lib/geo';
import { ALL_ITEM_TYPES } from '@/store/appStore';
import type { ItemType, MapItem } from '@/types';

/*
 * Every type the map can show, because results are grouped by this list and
 * a type missing from it is a type that can never appear. Night Caches were
 * left out: they matched the query, found no group to sit in, and the box
 * reported "Nothing matches" for something visible on the map behind it.
 */
const GROUP_ORDER: ItemType[] = ['installation', 'route', 'event', 'third_space', 'cache'];

/** Prompt 36 — one box, autocomplete, results grouped by type, recent searches. */
export function SearchBar() {
  const data = useAppStore((s) => s.data);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const pushSearchHistory = useAppStore((s) => s.pushSearchHistory);
  const searchHistory = useAppStore((s) => s.searchHistory);
  const setSelectedItem = useAppStore((s) => s.setSelectedItem);
  const setMapCenter = useAppStore((s) => s.setMapCenter);
  const userLocation = useAppStore((s) => s.userLocation);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(searchQuery);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => setDraft(searchQuery), [searchQuery]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const matches = useMemo(() => {
    const query = draft.trim().toLowerCase();
    if (!data || query.length < 2) return [];

    const all = toMapItems(data, ALL_ITEM_TYPES);
    return all
      .filter((item) =>
        `${item.title} ${item.subtitle ?? ''}`.toLowerCase().includes(query),
      )
      .slice(0, 12);
  }, [data, draft]);

  const grouped = useMemo(() => {
    const groups = new Map<ItemType, MapItem[]>();
    for (const item of matches) {
      const list = groups.get(item.type) ?? [];
      list.push(item);
      groups.set(item.type, list);
    }
    return GROUP_ORDER.filter((t) => groups.has(t)).map((t) => [t, groups.get(t)!] as const);
  }, [matches]);

  const flat = useMemo(() => grouped.flatMap(([, items]) => items), [grouped]);

  function choose(item: MapItem) {
    pushSearchHistory(draft);
    setSearchQuery('');
    setDraft('');
    setOpen(false);
    setMapCenter(item.location, 16);
    setSelectedItem(item);
  }

  function submit() {
    pushSearchHistory(draft);
    setSearchQuery(draft);
    setOpen(false);
  }

  return (
    <div className="search" ref={containerRef}>
      <div className="row" style={{ flexWrap: 'nowrap', gap: '0.35rem' }}>
        <Search size={16} className="muted" aria-hidden="true" />
        <input
          className="search__input"
          type="search"
          value={draft}
          placeholder="Search art, routes, events, caches, places…"
          aria-label="Search Night Shield"
          aria-expanded={open}
          // Only reference the listbox while it is actually in the DOM, and
          // name the highlighted row so arrow-key navigation is announced
          // rather than being a purely visual highlight.
          aria-controls={open ? 'search-results' : undefined}
          aria-activedescendant={
            open && activeIndex >= 0 && flat[activeIndex]
              ? `search-option-${flat[activeIndex].type}-${flat[activeIndex].id}`
              : undefined
          }
          role="combobox"
          aria-autocomplete="list"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setDraft(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActiveIndex((i) => Math.min(i + 1, flat.length - 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, -1));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              if (activeIndex >= 0 && flat[activeIndex]) choose(flat[activeIndex]);
              else submit();
            } else if (event.key === 'Escape') {
              setOpen(false);
            }
          }}
        />
        {draft ? (
          <button
            className="btn btn--ghost"
            onClick={() => {
              setDraft('');
              setSearchQuery('');
              setActiveIndex(-1);
            }}
            aria-label="Clear search"
          >
            <X size={15} />
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="search__results" id="search-results" role="listbox">
          {draft.trim().length < 2 && searchHistory.length > 0 ? (
            <div role="group" aria-label="Recent searches">
              <div className="search__group-label" aria-hidden="true">
                Recent
              </div>
              {searchHistory.map((term) => (
                <button
                  key={term}
                  className="search__item"
                  onClick={() => {
                    setDraft(term);
                    setSearchQuery(term);
                    setOpen(false);
                  }}
                >
                  <Clock size={14} className="muted" aria-hidden="true" />
                  {term}
                </button>
              ))}
            </div>
          ) : null}

          {draft.trim().length >= 2 && flat.length === 0 ? (
            <p className="small muted" style={{ padding: '0.75rem' }}>
              Nothing matches &ldquo;{draft.trim()}&rdquo;.
            </p>
          ) : null}

          {grouped.map(([type, items]) => (
            // role="group" keeps the type headings from sitting in the listbox
            // as stray non-option children.
            <div key={type} role="group" aria-label={itemTypeLabel(type)}>
              <div className="search__group-label" aria-hidden="true">
                {itemTypeLabel(type)}
              </div>
              {items.map((item) => {
                const index = flat.indexOf(item);
                const distance = userLocation
                  ? distanceKm(userLocation, item.location)
                  : null;
                return (
                  <button
                    key={item.id}
                    id={`search-option-${item.type}-${item.id}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    className={`search__item${index === activeIndex ? ' is-active' : ''}`}
                    onClick={() => choose(item)}
                  >
                    <span className="grow truncate">
                      {item.title}
                      {item.subtitle ? <span className="muted"> · {item.subtitle}</span> : null}
                    </span>
                    {distance != null ? (
                      <span className="tiny muted">{formatDistance(distance)}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
