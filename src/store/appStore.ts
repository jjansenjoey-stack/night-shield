import { create } from 'zustand';
import { TILBURG } from '@/styles/tokens';
import { fetchCityData, type CityDataResult } from '@/services/api';
import { getUserSavedItems, saveItem, savedKey, unsaveItem } from '@/services/userService';
import { fetchCurrentUser, logoutUser } from '@/services/authService';
import { advanceIfAhead, getUserJourneyProgress, initializeJourney } from '@/services/journeyService';
import { getRsvpCounts, getRsvpsForUser } from '@/services/eventService';
import { getCacheFindCounts, getCacheFinds } from '@/services/cacheService';
import { getCourses, getEnrolmentCounts, getEnrolments } from '@/services/courseService';
import type {
  EventRsvp,
  CacheFind,
  Course,
  Enrolment,
  ItemType,
  JourneyStage,
  LatLng,
  MapItem,
  MentalityPreference,
  RsvpCounts,
  UserJourney,
  UserProfile,
} from '@/types';

export type MapStyleId = 'dark' | 'light' | 'satellite';
export type MarkerSize = 'small' | 'medium' | 'large';
export type DistanceBand = 'any' | 'near' | 'mid' | 'far';
export type TimeFilter = 'any' | 'now' | 'evening' | 'night';

export interface MapPreferences {
  style: MapStyleId;
  markerSize: MarkerSize;
  layers: Record<ItemType, boolean>;
}

const PREFS_KEY = 'ns.mapPrefs.v1';
const ONBOARDING_KEY = 'ns.onboarding.v1';
const SEARCH_HISTORY_KEY = 'ns.searchHistory.v1';

const DEFAULT_PREFS: MapPreferences = {
  style: 'dark',
  markerSize: 'medium',
  layers: { installation: true, route: true, event: true, third_space: true, cache: true },
};

function loadPrefs(): MapPreferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<MapPreferences>;
    return {
      ...DEFAULT_PREFS,
      ...parsed,
      layers: { ...DEFAULT_PREFS.layers, ...(parsed.layers ?? {}) },
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(prefs: MapPreferences) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* storage blocked — preferences just won't persist */
  }
}

export function loadOnboardingPreference(): MentalityPreference | null {
  try {
    return (localStorage.getItem(ONBOARDING_KEY) as MentalityPreference) || null;
  } catch {
    return null;
  }
}

export function storeOnboardingPreference(value: MentalityPreference) {
  try {
    localStorage.setItem(ONBOARDING_KEY, value);
  } catch {
    /* non-fatal */
  }
}

function loadSearchHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

export interface AppState {
  // ---- session --------------------------------------------------------
  user: UserProfile | null;
  authReady: boolean;
  journey: UserJourney | null;
  savedKeys: Set<string>;
  /** The signed-in user's own RSVPs. Under RLS this is all they can see. */
  rsvps: EventRsvp[];
  /** Public attendance numbers per event, from an aggregate the server allows. */
  rsvpCounts: Map<string, RsvpCounts>;
  /** Night Caches this user has logged, and how many people found each one. */
  cacheFinds: CacheFind[];
  cacheFindCounts: Map<string, number>;
  /** Grow: the course catalogue, your places, and how full each one is. */
  courses: Course[];
  enrolments: Enrolment[];
  enrolmentCounts: Map<string, number>;
  coursesLoading: boolean;

  // ---- city data ------------------------------------------------------
  data: CityDataResult | null;
  dataLoading: boolean;
  dataError: string | null;

  // ---- map / UI -------------------------------------------------------
  mapCenter: LatLng;
  zoom: number;
  userLocation: LatLng | null;
  locationDenied: boolean;
  selectedItem: MapItem | null;
  activeTypes: ItemType[];
  accessibilityFilters: string[];
  distanceBand: DistanceBand;
  timeFilter: TimeFilter;
  searchQuery: string;
  searchHistory: string[];
  nearbyOpen: boolean;
  prefs: MapPreferences;
  isOnline: boolean;

  // ---- actions --------------------------------------------------------
  setUser: (user: UserProfile | null) => void;
  bootstrap: () => Promise<void>;
  refreshData: () => Promise<void>;
  signOut: () => Promise<void>;

  setSelectedItem: (item: MapItem | null) => void;
  setMapCenter: (center: LatLng, zoom?: number) => void;
  setUserLocation: (location: LatLng | null) => void;
  setLocationDenied: (denied: boolean) => void;

  toggleType: (type: ItemType) => void;
  toggleAccessibility: (tag: string) => void;
  setDistanceBand: (band: DistanceBand) => void;
  setTimeFilter: (filter: TimeFilter) => void;
  setSearchQuery: (query: string) => void;
  pushSearchHistory: (query: string) => void;
  clearFilters: () => void;
  activeFilterCount: () => number;

  setNearbyOpen: (open: boolean) => void;
  setPrefs: (patch: Partial<MapPreferences>) => void;
  toggleLayer: (type: ItemType) => void;
  setOnline: (online: boolean) => void;

  toggleSaved: (type: ItemType, id: string) => Promise<boolean>;
  isSaved: (type: ItemType, id: string) => boolean;
  refreshSaved: () => Promise<void>;
  refreshRsvps: () => Promise<void>;
  refreshCaches: () => Promise<void>;
  refreshCourses: () => Promise<void>;
  setJourney: (journey: UserJourney | null) => void;
  markJourney: (stage: JourneyStage) => Promise<void>;
}

const ALL_TYPES: ItemType[] = ['installation', 'route', 'event', 'third_space', 'cache'];

export const DISTANCE_BAND_KM: Record<DistanceBand, number | null> = {
  any: null,
  near: 1,
  mid: 3,
  far: null, // "3 km +" — handled as a lower bound in the filter hook
};

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  authReady: false,
  journey: null,
  savedKeys: new Set<string>(),
  rsvps: [],
  rsvpCounts: new Map(),
  cacheFinds: [],
  cacheFindCounts: new Map(),
  courses: [],
  enrolments: [],
  enrolmentCounts: new Map(),
  coursesLoading: false,

  data: null,
  dataLoading: false,
  dataError: null,

  mapCenter: { latitude: TILBURG.latitude, longitude: TILBURG.longitude },
  zoom: TILBURG.zoom,
  userLocation: null,
  locationDenied: false,
  selectedItem: null,
  activeTypes: [...ALL_TYPES],
  accessibilityFilters: [],
  distanceBand: 'any',
  timeFilter: 'any',
  searchQuery: '',
  searchHistory: loadSearchHistory(),
  nearbyOpen: false,
  prefs: loadPrefs(),
  isOnline: typeof navigator === 'undefined' ? true : navigator.onLine,

  setUser: (user) => set({ user }),

  async bootstrap() {
    set({ dataLoading: true, dataError: null });

    // Session and city data are independent — load them together.
    const [userResult, dataResult] = await Promise.allSettled([
      fetchCurrentUser(),
      fetchCityData(),
    ]);

    const user = userResult.status === 'fulfilled' ? userResult.value : null;
    set({ user, authReady: true });

    if (dataResult.status === 'fulfilled') {
      set({ data: dataResult.value, dataLoading: false });
    } else {
      set({
        dataLoading: false,
        dataError:
          dataResult.reason instanceof Error
            ? dataResult.reason.message
            : 'Could not load the city map.',
      });
    }

    // Public counts — guests see these too. Run after the user is set above so
    // each of these picks up the session on its first call.
    const tasks: Array<Promise<unknown>> = [
      get().refreshRsvps(),
      get().refreshCaches(),
      get().refreshCourses(),
    ];

    if (user) {
      tasks.push(
        get().refreshSaved(),
        (async () => {
          const existing = await getUserJourneyProgress(user.id);
          const journey = existing ?? (await initializeJourney(user.id));
          set({ journey });
        })(),
      );
    }
    await Promise.allSettled(tasks);
  },

  async refreshData() {
    set({ dataLoading: true, dataError: null });
    try {
      set({ data: await fetchCityData(), dataLoading: false });
    } catch (error) {
      set({
        dataLoading: false,
        dataError: error instanceof Error ? error.message : 'Could not load the city map.',
      });
    }
  },

  async signOut() {
    await logoutUser();
    set({
      user: null,
      journey: null,
      savedKeys: new Set<string>(),
      rsvps: [],
      rsvpCounts: new Map(),
      cacheFinds: [],
      enrolments: [],
      selectedItem: null,
    });
  },

  setSelectedItem: (selectedItem) => set({ selectedItem }),

  setMapCenter: (mapCenter, zoom) => set(zoom == null ? { mapCenter } : { mapCenter, zoom }),

  setUserLocation: (userLocation) => set({ userLocation, locationDenied: false }),

  setLocationDenied: (locationDenied) => set({ locationDenied }),

  toggleType: (type) =>
    set((state) => ({
      activeTypes: state.activeTypes.includes(type)
        ? state.activeTypes.filter((t) => t !== type)
        : [...state.activeTypes, type],
    })),

  toggleAccessibility: (tag) =>
    set((state) => ({
      accessibilityFilters: state.accessibilityFilters.includes(tag)
        ? state.accessibilityFilters.filter((t) => t !== tag)
        : [...state.accessibilityFilters, tag],
    })),

  setDistanceBand: (distanceBand) => set({ distanceBand }),
  setTimeFilter: (timeFilter) => set({ timeFilter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  pushSearchHistory: (query) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const history = [trimmed, ...get().searchHistory.filter((q) => q !== trimmed)].slice(0, 5);
    set({ searchHistory: history });
    try {
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
    } catch {
      /* non-fatal */
    }
  },

  clearFilters: () =>
    set({
      activeTypes: [...ALL_TYPES],
      accessibilityFilters: [],
      distanceBand: 'any',
      timeFilter: 'any',
      searchQuery: '',
    }),

  activeFilterCount: () => {
    const s = get();
    let count = 0;
    if (s.activeTypes.length !== ALL_TYPES.length) count += 1;
    count += s.accessibilityFilters.length;
    if (s.distanceBand !== 'any') count += 1;
    if (s.timeFilter !== 'any') count += 1;
    if (s.searchQuery.trim()) count += 1;
    return count;
  },

  setNearbyOpen: (nearbyOpen) => set({ nearbyOpen }),

  setPrefs: (patch) => {
    const prefs = { ...get().prefs, ...patch };
    savePrefs(prefs);
    set({ prefs });
  },

  toggleLayer: (type) => {
    const current = get().prefs;
    const prefs = {
      ...current,
      layers: { ...current.layers, [type]: !current.layers[type] },
    };
    savePrefs(prefs);
    set({ prefs });
  },

  setOnline: (isOnline) => set({ isOnline }),

  async toggleSaved(type, id) {
    const { user, savedKeys } = get();
    if (!user) return false;

    const key = savedKey(type, id);
    const next = new Set(savedKeys);
    const wasSaved = next.has(key);

    // Optimistic — the heart should respond immediately.
    if (wasSaved) next.delete(key);
    else next.add(key);
    set({ savedKeys: next });

    try {
      if (wasSaved) {
        await unsaveItem(user.id, type, id);
      } else {
        await saveItem(user.id, type, id);

        /*
         * Saving your first thing is worth a small nudge — it is the moment
         * the app stops being a list and starts being yours. The award has no
         * subject, so the ledger pays it once per account however many things
         * get saved afterwards; there is no need to check whether this really
         * was the first.
         */
        const { addPoints } = await import('@/services/pointsService');
        void addPoints(user.id, 'save_first_item').catch(() => null);
      }
      return !wasSaved;
    } catch (error) {
      set({ savedKeys }); // roll back
      throw error;
    }
  },

  isSaved: (type, id) => get().savedKeys.has(savedKey(type, id)),

  async refreshSaved() {
    const { user } = get();
    if (!user) {
      set({ savedKeys: new Set<string>() });
      return;
    }
    const rows = await getUserSavedItems(user.id);
    set({ savedKeys: new Set(rows.map((r) => savedKey(r.item_type, r.item_id))) });
  },

  async refreshRsvps() {
    const { user } = get();
    const [countsResult, mineResult] = await Promise.allSettled([
      getRsvpCounts(),
      user ? getRsvpsForUser(user.id) : Promise.resolve([]),
    ]);

    if (countsResult.status === 'fulfilled') set({ rsvpCounts: countsResult.value });
    if (mineResult.status === 'fulfilled') set({ rsvps: mineResult.value });
    // Attendance numbers are decoration when offline — never surface a failure.
  },

  async refreshCaches() {
    const { user } = get();
    const [countsResult, mineResult] = await Promise.allSettled([
      getCacheFindCounts(),
      user ? getCacheFinds(user.id) : Promise.resolve([]),
    ]);

    if (countsResult.status === 'fulfilled') set({ cacheFindCounts: countsResult.value });
    if (mineResult.status === 'fulfilled') set({ cacheFinds: mineResult.value });
  },

  async refreshCourses() {
    const { user } = get();
    set({ coursesLoading: true });

    const [catalogue, counts, mine] = await Promise.allSettled([
      getCourses(),
      getEnrolmentCounts(),
      user ? getEnrolments(user.id) : Promise.resolve([]),
    ]);

    if (catalogue.status === 'fulfilled') set({ courses: catalogue.value });
    if (counts.status === 'fulfilled') set({ enrolmentCounts: counts.value });
    if (mine.status === 'fulfilled') set({ enrolments: mine.value });
    set({ coursesLoading: false });
  },

  setJourney: (journey) => set({ journey }),

  async markJourney(stage) {
    const { user, journey } = get();
    if (!user) return;
    try {
      const next = await advanceIfAhead(user.id, stage, journey);
      set({ journey: next });
    } catch {
      /* journey tracking is never worth interrupting someone for */
    }
  },
}));

export const ALL_ITEM_TYPES = ALL_TYPES;
