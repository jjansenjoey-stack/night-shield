# Night Shield

Discover your city with confidence.

An urban-experience app for young adults (18–30) in Tilburg: an interactive map of public art,
guided discovery routes, events and community third spaces, with anonymous safety reporting and a
contribution loop that runs from *Discover* to *Belong*.

A concept built around three of the Municipality of Tilburg's themes — **Inclusivity**, **Safety**
and **Awareness**. Designed by Joey Jansen (Fontys).

> This is a student project. It is not an official product of the Municipality of Tilburg, was not
> commissioned by them, and is not endorsed by them. The municipality appears throughout the app as
> the body that would run it, which is part of the concept rather than a statement of fact.

---

## Running it

```bash
npm install && npm run dev
```

Open http://localhost:5173. **No configuration is needed** — the app boots on seeded Tilburg data
held in your browser. Sign in with either demo account:

| Account | Password | Role |
| --- | --- | --- |
| `organizer@nightshield.tilburg.nl` | `nightshield` | Organizer — can create and edit events, see analytics |
| `admin@nightshield.tilburg.nl` | `nightshield` | Admin — everything, plus the moderation queue |

Or sign up fresh to see the citizen experience.

Other scripts:

```bash
npm run typecheck
```

```bash
npm run build
```

---

## Connecting a real backend

The app talks to a backend through one interface — `DataProvider` in
[`src/services/dataProvider.ts`](src/services/dataProvider.ts). Two implementations satisfy it:

- **`localProvider`** — seeded data in `localStorage`. Used when no Supabase credentials are set.
- **`supabaseProvider`** — real Postgres + Supabase Auth.

`getProvider()` picks between them at runtime based on whether the env vars are present, so
switching backends is configuration, not a code change.

1. Create a Supabase project.
2. Run the migrations, in order:
   - `supabase/migrations/0001_schema.sql`
   - `supabase/migrations/0002_rls.sql`
   - `supabase/seed.sql` (optional — the same Tilburg content as the local provider)
3. Copy `.env.example` to `.env` and fill in:

```bash
cp .env.example .env
```

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

4. Restart the dev server. The Menu tab shows which backend is live.

> The local provider is **development only**. It stores credentials in `localStorage` behind a
> non-cryptographic digest and is not authentication. It is unreachable once the env vars are set.

---

## Architecture

```
src/
  components/
    ui/          Card, Modal, Button, Badge, LoadingSpinner, EmptyState, Toast, Shared
    layout/      AppShell, BottomNav, PrivateRoute
    map/         MapView, MapFilters, SearchBar, NearbySidebar, MapSettings,
                 FeaturedCarousel, WeatherStrip, mapStyles
    details/     DetailModal (dispatcher) → Location / Route / Event modals, FeedbackForm
    events/      CalendarGrid, EventCard, EventForm, LocationPicker, EventFeedbackForm
    profile/     EditProfileModal
  pages/         one file per route
  hooks/         useGeolocation, useOnlineStatus, useFilteredItems, useReminders
  services/      dataProvider (interface) + localProvider / supabaseProvider,
                 one service per domain, api.ts aggregate loader, seed.ts
  store/         appStore.ts (Zustand)
  lib/           geo, format, permissions, idb
  styles/        tokens.ts + global.css
supabase/
  migrations/    0001_schema.sql, 0002_rls.sql
  seed.sql
```

**One filter path.** `useFilteredItems` is the only place filters are applied, so the map, the
nearby list and the "showing N of M" count can never disagree.

**One detail dispatcher.** `DetailModal` decides which sheet a selection opens, so a marker, a
list row, a search result and a calendar entry all behave identically.

---

## Decisions worth knowing about

**MapLibre, not Mapbox.** The brief specified Mapbox, which requires an access token. Night Shield
runs on MapLibre GL (BSD) with keyless raster tiles from ArcGIS Online, so the app works on a fresh
clone with nothing to sign up for. `react-map-gl/maplibre` keeps the component API identical —
moving to Mapbox later means changing
[`src/components/map/mapStyles.ts`](src/components/map/mapStyles.ts) and one import.

CARTO was the first choice for tiles but now stamps "API KEY REQUIRED" across unauthenticated
requests.

**Tilburg's coordinates were wrong in the brief.** It listed `lng 5.1857`, which is roughly 9 km
east of the city, in farmland. Corrected to `5.0913` in
[`src/styles/tokens.ts`](src/styles/tokens.ts) so the map opens on Tilburg.

**Prompt 13 was built even though it was unmarked.** Signup (12), password reset (14) and profile
fetching (15) were marked done but login was not. Without it you could create an account and never
get back into it.

**Safety scores are withheld below three reports.** A single bad night should not brand a place.
`MIN_REPORTS_FOR_SCORE` in
[`src/services/feedbackService.ts`](src/services/feedbackService.ts) governs this, and night-time
scores are held to the same bar separately.

**Colour is never the only signal.** Every safety indicator carries a word as well as a colour
("Usually feels safe", "Mixed reports", "Often feels unsafe"), and every map marker has a full
`aria-label` — type, title, artist, distance, safety band.

**Anonymity is enforced in the database, not the UI.** A check constraint makes an anonymous report
carry no author, RLS restricts the base `feedback` table to moderators, and everyone else reads
`feedback_public`, a view with `user_id` projected away. Because that table is write-only to
ordinary users, an `insert … returning` would be rejected — so reports go in through the
`submit_feedback` function, which also decides anonymity server-side rather than trusting the client
to send `user_id: null`.

**Event ratings are not safety scores.** `feedback.kind` separates `'safety'` from `'event'`. A
five-star review of a screenprinting workshop should never become "usually feels safe" on the map,
and only `'safety'` rows reach `summariseFeedback`.

**Points, badges and roles cannot be self-granted.** `user_points` and `user_badges` have no write
policy at all; the only writers are the `add_user_points` and `award_badge` security-definer
functions, which verify `auth.uid()`. A trigger on `users` rejects any self-change to `role` or
`points`.

**Attendance counts come from an aggregate, not a row count.** RLS only lets someone read their own
RSVPs, so counting rows client-side would show every event as empty to everyone else. Public numbers
come from the `event_rsvp_counts` view, which exposes totals without names.

**A virtual event's join link is revoked at column level.** `events.virtual_url` is not readable by
`anon` or `authenticated` at all — not even via `select *`. It comes back only from
`event_join_url()`, which checks for a `'going'` RSVP first. Hiding the button client-side would not
have hidden the link.

### Night Caches

A geocaching layer: eight small details of Tilburg — a single rail left in the Spoorzone paving, a
brass bolt at the foot of the water tower, the fourth mooring ring on the Piushaven quay — each with
a hint, a story you only get once you've found it, and points.

**Every cache can be logged two ways.** Stand within 60 m and the button turns on, worth full points.
Or answer a question about the place from its photo and hint, worth 40%. The second route is the
whole reason the feature is defensible in an Inclusivity Department app: a location-gated game
quietly excludes anyone with a mobility limit, no travel budget, a shift pattern, or good reason not
to be on that street after dark. Nobody is locked out; the walk is simply worth more.

Both proofs are checked server-side. `log_cache_find()` re-measures the distance with PostGIS rather
than believing a client that says "I'm here", and the `answers` column is projected away by
`caches_public`, so the quiz answers never reach the browser at all.

### Grow — points instead of money

Art courses and short certificates around Tilburg, priced in points: screenprinting, analogue
darkroom, sound design (a 3-ECTS Fontys micro-credential), ceramics, stage lighting, natural dyeing,
writing in a second language.

Each one shows its real open-market price next to its points price — *"normally €180, yours for 200
points"* — because that contrast is the argument. The Department buys the places; residents earn them
by taking part in the city. The thing standing between someone and a certificate becomes
participation rather than a bank balance.

`enrol_in_course()` locks the course row and checks the start date, the remaining capacity and the
balance in one transaction, then debits and books. None of those three can be decided by the client,
and two people can tap the last place at the same moment. Cancelling before the start date refunds
the points in full.

Enrolling advances the user's journey to **Grow**, which is what that stage was always meant to mean.

### The review pass

The finished codebase was put through a multi-dimension review (React correctness, provider parity,
SQL, security, wiring, accessibility) with every finding independently checked by an adversarial
verifier. 41 findings were raised, 31 survived, and all of them are fixed above and in the source.
The ones worth knowing about are the five invariants just listed, plus:

- The `feedback`, `user_badges` and points paths **only worked on the local provider** — under real
  RLS they failed silently or hard. That is exactly the class of bug a two-implementation setup
  invites, and why the interface now has one code path per concern.
- `guard_role_escalation` was aborting every point award, because `add_user_points` writes the
  denormalised `users.points`. It now raises a scoped `night_shield.trusted` flag for that one
  statement.
- The moderation and featured-flag triggers silently demoted every seeded row, so a freshly seeded
  project would have shown an empty map. They now exempt trusted contexts (no JWT).
- `Modal`'s focus trap re-ran on every parent render — every caller passes a fresh inline `onClose`
  — pulling focus back out of the dialog. The handler is latched in a ref.

---

## Coverage against the brief

| Phase | Prompts | Where |
| --- | --- | --- |
| **1 — Foundation** | 1–10 | `styles/tokens.ts`, `AppShell`, `BottomNav`, `LandingPage`, `OnboardingPage`, `SignupPage`, `LoginPage`, `ProfilePage`, `components/ui/*`, `MapView`, `MapFilters`, `LocationDetailModal`, `store/appStore.ts`, `services/api.ts` |
| **2 — Auth & users** | 11–20 | `services/supabase.ts`, `authService`, `ForgotPasswordPage`, `ResetPasswordPage`, `EditProfileModal`, `lib/permissions.ts`, `PrivateRoute`, `AuthErrorBoundary`, guest banner in `AppShell` |
| **3 — Data model** | 21–30 | `supabase/migrations/*`, `installationService`, `routeService`, `eventService`, `thirdSpaceService`, `userService`, `feedbackService`, `pointsService`, `submissionService`, `journeyService` |
| **4 — Map & discovery** | 31–45 | `MapView`, `LocationDetailModal`, `RouteDetailModal`, `MapFilters`, `SearchBar`, `SafetyScore`, `NearbySidebar`, `sortByPreference`, `RouteNavigationPage`, `weatherService`, `useGeolocation`, `lib/idb.ts`, `MapSettings` |
| **5 — Events** | 46–58 | `EventsCalendarPage`, `CalendarGrid`, `EventDetailModal`, RSVP in `eventService`, `ProfilePage`, `CreateEventPage`, `EventForm`, `useReminders`, `OrganizerDashboardPage`, `EventFeedbackForm`, `FeaturedCarousel`, virtual events in `EventForm` |

The source document stops at prompt 58 despite its title.

---

## Things a real deployment still needs

- **Photography.** Every image is a `picsum.photos` placeholder.
- **Image uploads.** Forms take image *URLs*; wire them to Supabase Storage.
- **Email.** Password reset relies on Supabase Auth's mailer being configured.
- **Push notifications.** Reminders currently use the browser Notification API plus an in-app
  toast, and only fire while a tab is open. Real push needs a service worker and VAPID keys.
- **A tile budget.** ArcGIS Online's open basemaps are fine for a pilot, not for a city-scale
  rollout.
- **Content moderation policy.** The queue exists; the editorial rules behind it do not.
