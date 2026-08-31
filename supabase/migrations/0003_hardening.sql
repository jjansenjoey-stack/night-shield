-- ============================================================================
-- Night Shield — hardening
-- Municipality of Tilburg, Inclusivity Department
--
-- An adversarial audit of 0001 and 0002 found several holes that only appear
-- once the schema meets a real PostgREST endpoint and a real anon key. The
-- anon key ships inside the JavaScript bundle: anything the anon or
-- authenticated role is allowed to do, a stranger with curl can do too.
--
-- Safe to run on a database that already has 0001 and 0002 applied, and safe
-- to run twice.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Night Caches were never addable to the saved list
--
-- user_saved.item_type is an enum that predates the cache feature, so saving a
-- cache raises 22P02 (invalid input value for enum). Adding the value is the
-- whole fix; nothing reads the enum exhaustively.
-- ---------------------------------------------------------------------------

alter type item_type add value if not exists 'cache';


-- ---------------------------------------------------------------------------
-- 2. PostGIS may not live in `public`
--
-- Supabase installs PostGIS into the `extensions` schema. Every SECURITY
-- DEFINER function here pins `search_path = public`, which is correct practice
-- — an unpinned definer function is a privilege-escalation vector — but it
-- also means an unqualified st_distance() or st_makepoint() cannot be resolved
-- and the geo RPCs fail at runtime with "function does not exist".
--
-- Widening the pin to include `extensions` keeps the protection (the path is
-- still fixed, still excludes anything user-writable) while letting PostGIS
-- resolve wherever the project put it.
-- ---------------------------------------------------------------------------

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proconfig is not null
      and exists (
        select 1 from unnest(p.proconfig) c
        where c = 'search_path=public'
      )
  loop
    execute format('alter function %s set search_path = public, extensions', fn.sig);
  end loop;
end $$;


-- ---------------------------------------------------------------------------
-- 3. Virtual event join links were world-readable
--
-- 0002 tried to hide them with
--     revoke select (virtual_url) on public.events from anon, authenticated;
-- but PostgreSQL documents that as a no-op: "if a role has been granted
-- privileges on a table, then revoking the same privileges from individual
-- columns will have no effect." The table-level GRANT SELECT won, the revoke
-- only logged a warning, and
--     GET /rest/v1/events?select=virtual_url&is_virtual=eq.true
-- returned every join link to anyone holding the publishable anon key.
--
-- The only thing a column revoke can subtract from is a column grant, so the
-- table-level grant has to go and be replaced by an explicit column list.
-- event_join_url() remains the supported way in, and it checks for a 'going'
-- RSVP first.
--
-- Consequence worth knowing: `select=*` on events now returns 42501. The
-- client already names its columns everywhere (EVENT_COLS in
-- supabaseProvider.ts), so no application change is needed.
-- ---------------------------------------------------------------------------

revoke select on public.events from anon, authenticated;

grant select (
  id, title, description, category, location, latitude, longitude, address,
  start_time, end_time, capacity, cost_euros, organizer_id, organizer_name,
  image_url, accessibility, is_virtual, is_featured, updated_at, created_at
) on public.events to anon, authenticated;

-- Organizers still write through the table; RLS decides which rows.
grant insert, update, delete on public.events to authenticated;


-- ---------------------------------------------------------------------------
-- 4. Every function in the schema was a public RPC endpoint
--
-- PostgreSQL grants EXECUTE on a new function to PUBLIC by default. 0002 adds
-- the grants it wants but never takes the default away, so *all* of them were
-- reachable — including prune_orphaned_saves(), a SECURITY DEFINER DELETE
-- across every user's saved items that takes no arguments and checks no
-- caller. It was written for a scheduled service-role job; unauthenticated,
-- it is a one-line data-loss button.
--
-- Take EXECUTE back from everything, then re-grant exactly the intended list.
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.advance_journey_stage(uuid, text) to authenticated;
grant execute on function public.approve_submission(uuid, uuid) to authenticated;
grant execute on function public.event_join_url(uuid) to authenticated;
grant execute on function public.submit_feedback(uuid, text, text, smallint, text, boolean)
  to anon, authenticated;
grant execute on function public.log_cache_find(uuid, text, double precision, double precision, text)
  to authenticated;
grant execute on function public.enrol_in_course(uuid) to authenticated;
grant execute on function public.cancel_enrolment(uuid) to authenticated;

-- RLS policies are evaluated as the *calling* role, so every helper a policy
-- names has to stay executable by that role. Revoking these would not lock the
-- data down, it would make each policy raise "permission denied for function".
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_at_least(user_role) to anon, authenticated;
grant execute on function public.is_trusted_context() to anon, authenticated;
grant execute on function public.current_role() to anon, authenticated;

-- Deliberately NOT re-granted:
--   add_user_points(uuid, integer)  — replaced by award_points_for(), below
--   award_badge(uuid, text)         — badges are earned, not requested
--   prune_orphaned_saves()          — service-role maintenance only
--   handle_new_user(), guard_*()    — trigger functions, never called directly


-- ---------------------------------------------------------------------------
-- 5. Points could be minted at will
--
-- add_user_points(target_user, delta) was granted to `authenticated` and took
-- the amount from the caller. It checks that you are crediting yourself and
-- caps a single call at 100, but nothing caps the number of calls:
--
--   for i in $(seq 1 4); do curl -X POST .../rpc/add_user_points \
--     -d '{"target_user":"<own uid>","delta":100}'; done
--
-- ...and a 400-point course place — a real seat the municipality has paid for
-- — is free. enrol_in_course() carefully refuses to trust the client's
-- balance, but the balance it reads was written by the client.
--
-- Two changes fix the class of bug rather than the instance:
--
--   a) the client no longer says how much. It names a reason; the server owns
--      the price list. These values mirror POINTS in src/services/pointsService.ts.
--   b) an award ledger makes every award idempotent per (user, reason,
--      subject). Rating the same place twice, re-walking one route or
--      replaying an RSVP now pays once, which is what the UI always implied.
-- ---------------------------------------------------------------------------

create table if not exists public.point_awards (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users (id) on delete cascade,
  reason text not null,
  -- The thing earned against: an event, a route, a location. Null for the
  -- once-per-account awards, which the second index below collapses.
  subject_id uuid,
  amount integer not null,
  created_at timestamptz not null default now()
);

-- Two partial indexes rather than one, because NULL never equals NULL in a
-- unique index and the once-per-account awards need collapsing too.
create unique index if not exists point_awards_unique_subject
  on public.point_awards (user_id, reason, subject_id)
  where subject_id is not null;

create unique index if not exists point_awards_unique_global
  on public.point_awards (user_id, reason)
  where subject_id is null;

alter table public.point_awards enable row level security;

drop policy if exists point_awards_own on public.point_awards;
create policy point_awards_own on public.point_awards
  for select using (auth.uid() = user_id);

grant select on public.point_awards to authenticated;
-- No insert grant: rows appear only through award_points_for().


create or replace function public.award_points_for(reason text, subject uuid default null)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
  amount integer;
  balance integer;
begin
  if uid is null then
    raise exception 'You need to be signed in to earn points';
  end if;

  -- The server owns the price list. An unknown reason is a bug or an attack;
  -- either way it is not an award.
  amount := case reason
    when 'submit_feedback'  then 4
    when 'rsvp_event'       then 2
    when 'attend_event'     then 8
    when 'event_feedback'   then 6
    when 'submit_content'   then 10
    when 'complete_route'   then 12
    when 'save_first_item'  then 2
    else null
  end;

  if amount is null then
    raise exception 'Unknown points reason: %', reason;
  end if;

  insert into public.point_awards (user_id, reason, subject_id, amount)
  values (uid, reason, subject, amount)
  on conflict do nothing;

  if not found then
    -- Already paid for this one. Report the balance rather than failing, so a
    -- double tap looks like a no-op instead of an error.
    return coalesce(
      (select points_balance from public.user_points where user_id = uid), 0
    );
  end if;

  insert into public.user_points (user_id, points_balance, last_updated)
  values (uid, amount, now())
  on conflict (user_id) do update
    set points_balance = public.user_points.points_balance + excluded.points_balance,
        last_updated = now()
  returning points_balance into balance;

  return balance;
end $$;

grant execute on function public.award_points_for(text, uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- 6. A new account could make itself an admin
--
-- guard_role_escalation is attached BEFORE UPDATE only (it compares new.role
-- to old.role, which an INSERT has none of), and 0002 grants INSERT on
-- public.users to authenticated. A signed-up user could therefore insert their
-- own profile row with role = 'admin' and walk into the moderation queue.
-- ---------------------------------------------------------------------------

create or replace function public.guard_role_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  -- A profile row created over the web API is always a plain citizen. Roles
  -- are granted by the Inclusivity Desk, never claimed.
  if not public.is_trusted_context()
     and new.role is distinct from 'citizen'::user_role then
    new.role := 'citizen'::user_role;
  end if;
  return new;
end $$;

drop trigger if exists users_guard_role_insert on public.users;
create trigger users_guard_role_insert
  before insert on public.users
  for each row execute function public.guard_role_on_insert();


-- ---------------------------------------------------------------------------
-- 7. Individual safety reports are readable one by one (NOT changed here)
--
-- feedback_public serves each report's free-text comment, its location, its
-- time of day and its timestamp to anon. In a city this size those four
-- together can re-identify a reporter: "whoever reported Piushaven at 23:40
-- last Tuesday". That is a real privacy exposure in a municipal app.
--
-- It is deliberately NOT fixed here, because the app is built to show those
-- comments: supabaseProvider.ts reads exactly these columns (FEEDBACK_COLS)
-- and the detail sheets render them. Locking the view down would empty a
-- feature rather than protect anyone, so this is a product decision for the
-- Inclusivity Department, not a migration. The options:
--
--   * keep comments public, but coarsen created_at to a date and drop
--     time_of_day from the public projection; or
--   * serve only aggregates publicly, and show comments to signed-in users; or
--   * accept it, and say so plainly in the reporting UI, so people know their
--     words will be public before they type them.
--
-- Whichever is chosen, the change is a new view plus a column grant, and the
-- client's FEEDBACK_COLS has to be updated to match.


-- ---------------------------------------------------------------------------
-- 8. is_trusted_context() was true for every anonymous request
--
-- The original returned true whenever auth.uid() was null — which is exactly
-- the case for every unauthenticated PostgREST request. So anon was "trusted",
-- and the guard triggers it gates were open to the whole internet.
--
-- Trusted should mean "did not arrive over the web API". The seed runs as
-- postgres and is trusted; a SECURITY DEFINER function runs as its owner and
-- is trusted; anon and authenticated never are.
-- ---------------------------------------------------------------------------

create or replace function public.is_trusted_context()
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select current_user not in ('anon', 'authenticated');
$$;
