import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Crosshair, List, Settings2 } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useFilteredItems } from '@/hooks/useFilteredItems';
import { MapView } from '@/components/map/MapView';
import { MapFilters } from '@/components/map/MapFilters';
import { SearchBar } from '@/components/map/SearchBar';
import { NearbySidebar } from '@/components/map/NearbySidebar';
import { MapSettings } from '@/components/map/MapSettings';
import { FeaturedCarousel } from '@/components/map/FeaturedCarousel';
import { DetailModal } from '@/components/details/DetailModal';
import { LoadingBlock } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { toMapItems } from '@/services/api';
import { ALL_ITEM_TYPES } from '@/store/appStore';

/** Prompts 7, 8, 31, 35–38, 42, 44, 45, 57 — the map tab. */
export function DiscoverPage() {
  const data = useAppStore((s) => s.data);
  const loading = useAppStore((s) => s.dataLoading);
  const error = useAppStore((s) => s.dataError);
  const refreshData = useAppStore((s) => s.refreshData);
  const nearbyOpen = useAppStore((s) => s.nearbyOpen);
  const setNearbyOpen = useAppStore((s) => s.setNearbyOpen);
  const setMapCenter = useAppStore((s) => s.setMapCenter);
  const setSelectedItem = useAppStore((s) => s.setSelectedItem);
  const markJourney = useAppStore((s) => s.markJourney);

  const { userLocation, locationDenied, request } = useGeolocation();
  const { items } = useFilteredItems();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    void markJourney('discovered');
  }, [markJourney]);

  // Ask for location on first visit; the browser remembers the answer.
  useEffect(() => {
    if (!userLocation && !locationDenied) request();
  }, [userLocation, locationDenied, request]);

  // Deep link: /discover?item=installation:inst-lochal-loom
  useEffect(() => {
    const target = params.get('item');
    if (!target || !data) return;

    const [type, id] = target.split(':');
    const match = toMapItems(data, ALL_ITEM_TYPES).find((i) => i.type === type && i.id === id);
    if (match) {
      setMapCenter(match.location, 16);
      setSelectedItem(match);
    }
    params.delete('item');
    setParams(params, { replace: true });
  }, [params, data, setMapCenter, setSelectedItem, setParams]);

  if (loading && !data) return <LoadingBlock label="Loading Tilburg…" />;

  if (error && !data) {
    return (
      <div className="page">
        <EmptyState
          title="Could not load the map"
          message={error}
          action={
            <Button variant="primary" onClick={() => void refreshData()}>
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="map-page">
      <MapView />

      <div className="map-overlay">
        <div className="map-toolbar">
          <button
            className="btn btn--ghost"
            onClick={() => setNearbyOpen(!nearbyOpen)}
            aria-label={nearbyOpen ? 'Hide nearby list' : 'Show nearby list'}
            aria-expanded={nearbyOpen}
          >
            <List size={17} />
          </button>
          <SearchBar />
        </div>

        <MapFilters />
        <FeaturedCarousel />
      </div>

      <button
        className="map-fab"
        style={{ bottom: 92 }}
        // One click does the thing the label promises: ask for permission the
        // first time, recentre once we have a fix. A double-click handler would
        // be unreachable by keyboard and fire the request twice besides.
        onClick={() => (userLocation ? setMapCenter(userLocation, 16) : request())}
        aria-label={userLocation ? 'Centre on my location' : 'Use my location'}
        title={locationDenied ? 'Enable location to see distances' : 'My location'}
      >
        <Crosshair size={19} color={userLocation ? 'var(--accent2)' : undefined} />
      </button>

      <button
        className="map-fab"
        style={{ bottom: 144 }}
        onClick={() => setSettingsOpen(true)}
        aria-label="Map settings"
      >
        <Settings2 size={19} />
      </button>

      {locationDenied ? (
        <p
          className="tiny"
          style={{
            position: 'absolute',
            bottom: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(26,26,46,0.92)',
            padding: '0.3rem 0.7rem',
            borderRadius: 'var(--r-pill)',
            border: '1px solid var(--border)',
            zIndex: 5,
            margin: 0,
          }}
        >
          Enable location to see distances
        </p>
      ) : null}

      <NearbySidebar />
      <MapSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <DetailModal />

      <p className="sr-only" role="status" aria-live="polite">
        {items.length} locations currently shown on the map.
      </p>
    </div>
  );
}
