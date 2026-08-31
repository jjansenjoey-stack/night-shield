# Night Shield — project context

Written for whoever picks this up next, including a future me. The README says
what the app *is*; this says why it is built the way it is, and which decisions
cost real time to reach. Anything here that reads as fussy is usually the scar
of a bug.

---

## What this is, and what it is not

A concept app for young adults (18–30) in Tilburg, built around three of the
Municipality of Tilburg's themes: **Inclusivity**, **Safety** and **Awareness**.
Those map to real municipal work — *Beleidsnota Inclusie "Tilburg, Stad van
Verbinding"*, the *straatintimidatie* policy and APV ban, and the council
portfolio literally named *Inclusie en Mondiale Bewustwording*.

**It is a student project by Joey Jansen (Fontys).** It is not an official
product of the Municipality of Tilburg, was not commissioned by them, and is not
endorsed by them. The municipality appears inside the app as the body that would
run it; that is part of the concept, not a claim. The landing page, the About
card and the README each say so in one line — please keep them.

## Where it lives

| | |
|---|---|
| Live | https://jjansenjoey-stack.github.io/night-shield/ |
| Repo | https://github.com/jjansenjoey-stack/night-shield |
| Deploys from | the `gh-pages` branch (built output), **not** Actions |

The Actions workflow is parked at `deploy/github-pages-workflow.yml` because the
token used for the first push had no `workflow` scope. To switch to automatic
deploys, see `deploy/README.md`.

To redeploy by hand:

```bash
npm run build:pages -- night-shield
cd dist && git add -A && git commit -m "Redeploy" && git push -f origin gh-pages
```

Demo logins, password `nightshield`: `organizer@nightshield.tilburg.nl` (organizer
dashboard) and `admin@nightshield.tilburg.nl` (moderation queue). Everything is
also browsable signed out.

---

## Architecture

### The provider seam

Every service goes through `DataProvider` (`src/services/dataProvider.ts`).
Two implementations satisfy it:

- `localProvider` — seeded Tilburg data in `localStorage`. Dev and demo only.
  Its "auth" is a non-cryptographic digest and must never be treated as real.
- `supabaseProvider` — real Postgres, Auth and RLS.

Which one runs is decided by `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.

> **The rule that matters:** every rule must exist in *both*. An adversarial
> audit found several features that worked only on the local provider and would
> have failed under real RLS. `scripts/`-adjacent checks aside, the quickest
> guard is the checker described under "Consistency checks" below.

### Never trust the client

- Points go through `award_points_for(reason, subject, period)`. The client
  names a *reason*; the server owns the price list. The previous
  `add_user_points(user, delta)` let any signed-in user mint the course currency
  four curl calls at a time.
- Awards are idempotent per `(user, reason, subject, period)`. `period` is set
  by the backend, never taken from the caller — a client free to name its own
  week could pass a different string every call.
- Cache-find distance and quiz answers are re-checked server-side; the answers
  never reach the browser.
- Course enrolment row-locks and re-checks balance and capacity in one
  transaction.

### Migrations

| File | What it does |
|---|---|
| `0001_schema.sql` | tables, views, RPCs, triggers |
| `0002_rls.sql` | row-level security and grants |
| `0003_hardening.sql` | fixes found by an adversarial audit |
| `0004_route_art.sql` | Two Weeks Only: spots, placements, place/collect |
| `0005_walk_reward.sql` | the award ledger's `period`, walking reward |

None of these have been run against a real project yet. **Run them on a
throwaway Supabase project first** — the audit's schema-validity pass died on a
session limit, so "does this execute top to bottom" is genuinely unverified.

---

## Traps, and why the code looks like it does

**MapLibre consumes the style object you hand it.** Passing the shared
`MAP_STYLES` entry means the *second* map mounted in a document renders no
basemap at all. Every map instance gets `structuredClone`. This was the root
cause of every "blank map" symptom; the resize hooks around it were treating
symptoms.

**React StrictMode broke two features in the same way.** It mounts, unmounts and
mounts again in dev. Anything that (a) marks work as "already started" in a ref
and (b) discards the result on cleanup will start the work, throw it away, then
skip it — so the answer never arrives. It bit route snapping (dedupe had to move
into the service, which caches in memory, in flight and in IndexedDB) and the
shader (`WEBGL_lose_context` in cleanup killed the context the remount then
inherited — a canvas returns the same context object forever, so never lose it).

**`NaN` and `NULL` silently pass range checks.** `NaN > 60` is false in JS and
`NULL > 60` is not true in SQL, so a garbage coordinate was accepted as a valid
cache find from anywhere in the world. Validate finiteness explicitly *before*
comparing.

**An unknown points reason used to brick an account.** `POINTS[reason]` was
`undefined`, `balance += undefined` is `NaN`, and `NaN` loses every comparison —
so the account silently could not afford anything, ever again. The SQL raised
properly; the local provider did not. Both throw now, and a `NaN` balance is
repaired on read. This is the dual-backend rule biting: a guard in one place is
not a guard.

**A column `REVOKE` after a table-level `GRANT` is a documented no-op.** This is
why virtual-event join links were world-readable despite two revokes trying to
hide them. The table grant has to go and be replaced by a column list.

**`localStorage` snapshots go stale.** `resyncSeed()` refreshes only named
presentation fields on rows that came from the seed, so a rebalance or a new
photo reaches existing browsers without touching anything a user created. If you
change a seeded value and it does not appear, it needs adding to that list.

**Keyless by choice.** The bundle is public, so anything in it is public. Hence
MapLibre + Esri tiles rather than Mapbox, and FOSSGIS OSRM rather than Google
Directions. Adding a billed API key here means putting someone's quota on the
open web.

---

## The points economy

Earning: feedback 4, RSVP 2, attend 8, event feedback 6, submit 10, route 12,
save 2, place art 14, collect art 6, walk an art route 1 (once per ISO week).
Workshops cost 20–200. Reward tiers 20/60/130/250. The seeded demo wallet is 95,
which reaches 5 of 11 workshops.

Earning and prices are tuned *together* — changing one alone breaks the ladder.
UI copy reads the numbers from the `POINTS` constants; it had already drifted
once when they were hardcoded in strings.

Points are integers everywhere, which is why walking pays 1 a week rather than
the 0.5 a walk originally asked for. Making the economy fractional would mean
showing people "95.5 points" and touching every comparison against a price.

**Two rewards are declared but never awarded:** `attend_event` and
`save_first_item` have no call sites. Attendance especially has no way to be
verified — a QR code scanned at the door is the usual answer.

---

## Tests

`npm test` runs the economy suite (`src/services/economy.test.ts`) — 20 cases,
about 20 ms of actual assertions. Every one of them is a defect that really
shipped and was caught by hand in a browser console: infinite point farming, NaN
cache finds from anywhere on earth, an unknown reason bricking a balance, spot
ids stranded by a renumbering.

The guards were each removed on purpose to confirm the suite goes red, because a
test that has only ever seen working code proves nothing. If one of these fails,
someone is about to buy a course for free, or be locked out of buying one at all.

## Consistency checks

Two things drift silently and are worth re-checking after any change to the
economy or the provider interface:

1. Both providers implement every `DataProvider` method (TypeScript catches
   this, but the count is worth eyeballing — currently 63).
2. The TypeScript `POINTS` and the SQL `award_points_for` price list agree.
   A mismatch means the UI promises one number and the server pays another.

---

## Deliberately not done

- **Individual safety reports are publicly readable** — comment, location, time
  of day and timestamp together can re-identify a reporter in a city this size.
  Locking the view down would empty a feature the app is built around, so the
  three options are written into `0003_hardening.sql` for a product decision
  rather than chosen unilaterally.
- **The map bundle is 762 kB.** Lazy-loading MapLibre per route would cut first
  paint noticeably on a phone.
- **The demo never shows night safety bands.** The threshold is three reports;
  the seed gives each location two at night.
