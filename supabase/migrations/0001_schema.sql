-- ============================================================================
-- Night Shield — schema
-- Municipality of Tilburg, Inclusivity Department
--
-- Covers prompts 11 (users) and 21–29 (installations, routes, events,
-- third spaces, saved items, feedback, points, submissions, journey).
-- Row-level security lives in 0002_rls.sql.
-- ============================================================================

create extension if not exists postgis;
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type user_role as enum ('citizen', 'contributor', 'organizer', 'admin');
create type mentality_preference as enum ('vigilant', 'explorer', 'both');
create type moderation_status as enum ('pending', 'approved', 'rejected');
create type item_type as enum ('installation', 'route', 'event', 'third_space');
create type route_type as enum ('safe', 'exploration', 'art_walk');
create type event_category as enum ('workshop', 'art_talk', 'social', 'nightlife');
create type third_space_type as enum ('cafe', 'library', 'park', 'community_centre', 'studio');
create type time_of_day as enum ('morning', 'afternoon', 'evening', 'night');
create type rsvp_status as enum ('going', 'interested', 'not_going');
create type submission_type as enum ('installation', 'event', 'third_space');
-- A safety report and a "how was the workshop" rating are both 1–5, but they
-- mean different things. Keeping them apart stops event ratings from showing
-- up as safety scores on the map.
create type feedback_kind as enum ('safety', 'event');
create type cache_difficulty as enum ('easy', 'medium', 'hard');
-- 'visited' = stood next to it. 'answered' = worked it out from home, for
-- anyone who cannot make the trip. Both count; they are worth different points.
create type find_method as enum ('visited', 'answered');
create type course_format as enum ('class', 'certificate', 'masterclass');
create type course_level as enum ('beginner', 'some_experience', 'any');
create type enrolment_status as enum ('reserved', 'completed', 'cancelled');
create type journey_stage as enum (
  'discovered', 'explored', 'participated', 'connected', 'contributed', 'grown', 'belonged'
);

-- ---------------------------------------------------------------------------
-- users
--
-- Passwords live in auth.users and are managed by Supabase Auth. This table is
-- the public profile, keyed to the same id.
-- ---------------------------------------------------------------------------

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  pronouns text,
  avatar_url text,
  role user_role not null default 'citizen',
  onboarding_preference mentality_preference,
  accessibility_needs text[] not null default '{}',
  points integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.users is
  'Public profile. Authentication credentials are held by Supabase Auth in auth.users.';

-- Create the profile row automatically on sign-up so the client never has to.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  insert into public.user_points (user_id) values (new.id)
  on conflict (user_id) do nothing;

  insert into public.user_journey (user_id, current_stage, discovered_at)
  values (new.id, 'discovered', now())
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- installations (prompt 21)
--
-- `location` is the source of truth; `latitude` / `longitude` are generated so
-- PostgREST can return plain numbers without a PostGIS round trip client-side.
-- ---------------------------------------------------------------------------

create table public.installations (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  artist text,
  description text,
  location geography(point, 4326) not null,
  latitude double precision generated always as (st_y(location::geometry)) stored,
  longitude double precision generated always as (st_x(location::geometry)) stored,
  address text,
  images text[] not null default '{}',
  category text,
  is_temporary boolean not null default false,
  status text not null default 'active' check (status in ('active', 'removed')),
  accessibility text[] not null default '{}',
  created_by uuid references public.users (id) on delete set null,
  moderation_status moderation_status not null default 'pending',
  created_at timestamptz not null default now()
);

create index installations_location_idx on public.installations using gist (location);
create index installations_status_idx on public.installations (status, moderation_status);
-- Two installations should not share a title, and it makes seed.sql re-runnable.
create unique index installations_title_key on public.installations (title);

-- ---------------------------------------------------------------------------
-- routes (prompt 22)
-- ---------------------------------------------------------------------------

create table public.routes (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  type route_type not null default 'safe',
  distance_km double precision not null default 0,
  estimated_time_minutes integer not null default 0,
  start_location geography(point, 4326) not null,
  end_location geography(point, 4326) not null,
  start_latitude double precision generated always as (st_y(start_location::geometry)) stored,
  start_longitude double precision generated always as (st_x(start_location::geometry)) stored,
  end_latitude double precision generated always as (st_y(end_location::geometry)) stored,
  end_longitude double precision generated always as (st_x(end_location::geometry)) stored,
  -- [{ order, title, note, image_url, location: { latitude, longitude } }]
  stops jsonb not null default '[]',
  accessibility text[] not null default '{}',
  created_by uuid references public.users (id) on delete set null,
  moderation_status moderation_status not null default 'approved',
  created_at timestamptz not null default now()
);

create index routes_start_idx on public.routes using gist (start_location);
create index routes_moderation_idx on public.routes (moderation_status);
create unique index routes_title_key on public.routes (title);

-- ---------------------------------------------------------------------------
-- events (prompt 23)
--
-- `location` is nullable: virtual events have nowhere to sit on a map.
-- ---------------------------------------------------------------------------

create table public.events (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  category event_category not null default 'workshop',
  location geography(point, 4326),
  latitude double precision generated always as (st_y(location::geometry)) stored,
  longitude double precision generated always as (st_x(location::geometry)) stored,
  address text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  capacity integer check (capacity is null or capacity > 0),
  cost_euros double precision not null default 0 check (cost_euros >= 0),
  organizer_id uuid references public.users (id) on delete set null,
  organizer_name text,
  image_url text,
  accessibility text[] not null default '{}',
  is_virtual boolean not null default false,
  virtual_url text,
  is_featured boolean not null default false,
  updated_at timestamptz,
  created_at timestamptz not null default now(),

  constraint events_end_after_start check (end_time > start_time),
  -- An event is either somewhere or online. Never neither.
  constraint events_have_a_place check (
    (is_virtual and virtual_url is not null) or (not is_virtual and location is not null)
  )
);

create index events_location_idx on public.events using gist (location);
create index events_start_idx on public.events (start_time);
create index events_organizer_idx on public.events (organizer_id);
-- One event per title per start time — also what makes seed.sql idempotent.
create unique index events_title_start_key on public.events (title, start_time);

-- ---------------------------------------------------------------------------
-- third_spaces (prompt 24)
-- ---------------------------------------------------------------------------

create table public.third_spaces (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type third_space_type not null default 'cafe',
  description text,
  location geography(point, 4326) not null,
  latitude double precision generated always as (st_y(location::geometry)) stored,
  longitude double precision generated always as (st_x(location::geometry)) stored,
  address text,
  hours_open text,
  cost text,
  accessibility text[] not null default '{}',
  image_url text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index third_spaces_location_idx on public.third_spaces using gist (location);
create unique index third_spaces_name_key on public.third_spaces (name);

-- ---------------------------------------------------------------------------
-- user_saved (prompt 25)
--
-- item_id is deliberately not a foreign key: it points at one of four tables
-- depending on item_type. Orphans are cleaned up by the job below.
-- ---------------------------------------------------------------------------

create table public.user_saved (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users (id) on delete cascade,
  item_type item_type not null,
  item_id uuid not null,
  saved_at timestamptz not null default now(),
  unique (user_id, item_type, item_id)
);

create index user_saved_user_idx on public.user_saved (user_id);

-- ---------------------------------------------------------------------------
-- feedback (prompt 26)
--
-- user_id is nullable and null for anonymous reports, which is the default.
-- Nothing in the app ever displays who filed a report.
-- ---------------------------------------------------------------------------

create table public.feedback (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users (id) on delete set null,
  location_id uuid not null,
  kind feedback_kind not null default 'safety',
  time_of_day time_of_day not null,
  safety_perception smallint not null check (safety_perception between 1 and 5),
  comment text,
  is_anonymous boolean not null default true,
  created_at timestamptz not null default now()
);

create index feedback_location_idx on public.feedback (location_id, kind);
create index feedback_created_idx on public.feedback (created_at desc);

-- An anonymous report must not carry an author.
alter table public.feedback
  add constraint feedback_anonymous_has_no_author
  check (not is_anonymous or user_id is null);

-- The projection the client reads. Drops user_id entirely so aggregate safety
-- scores can be public without exposing who said what.
create view public.feedback_public
with (security_invoker = true) as
select id, location_id, kind, time_of_day, safety_perception, comment, is_anonymous, created_at
from public.feedback;

-- public.feedback is write-only to everyone but moderators, so an
-- `insert ... returning` would be rejected. This is the sanctioned way to file
-- a report and get the sanitised row back. It also enforces the anonymity rule
-- server-side rather than trusting the client to pass user_id = null.
create or replace function public.submit_feedback(
  p_location_id uuid,
  p_kind text,
  p_time_of_day text,
  p_safety smallint,
  p_comment text,
  p_anonymous boolean
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted public.feedback;
begin
  if p_safety < 1 or p_safety > 5 then
    raise exception 'Rating must be between 1 and 5';
  end if;

  insert into public.feedback
    (user_id, location_id, kind, time_of_day, safety_perception, comment, is_anonymous)
  values (
    case when coalesce(p_anonymous, true) then null else auth.uid() end,
    p_location_id,
    coalesce(p_kind, 'safety')::feedback_kind,
    p_time_of_day::time_of_day,
    p_safety,
    nullif(btrim(coalesce(p_comment, '')), ''),
    coalesce(p_anonymous, true)
  )
  returning * into inserted;

  -- Deliberately does not echo user_id back.
  return json_build_object(
    'id', inserted.id,
    'location_id', inserted.location_id,
    'kind', inserted.kind,
    'time_of_day', inserted.time_of_day,
    'safety_perception', inserted.safety_perception,
    'comment', inserted.comment,
    'is_anonymous', inserted.is_anonymous,
    'created_at', inserted.created_at
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- points, badges (prompt 27)
-- ---------------------------------------------------------------------------

create table public.user_points (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  points_balance integer not null default 0 check (points_balance >= 0),
  last_updated timestamptz not null default now()
);

create table public.user_badges (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users (id) on delete cascade,
  badge_name text not null,
  earned_at timestamptz not null default now(),
  unique (user_id, badge_name)
);

-- ---------------------------------------------------------------------------
-- event_rsvps (prompt 48)
-- ---------------------------------------------------------------------------

create table public.event_rsvps (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  rsvp_status rsvp_status not null default 'going',
  rsvped_at timestamptz not null default now(),
  unique (user_id, event_id)
);

create index event_rsvps_event_idx on public.event_rsvps (event_id);
create index event_rsvps_user_idx on public.event_rsvps (user_id);

-- ---------------------------------------------------------------------------
-- community_submissions (prompt 28)
-- ---------------------------------------------------------------------------

create table public.community_submissions (
  id uuid primary key default uuid_generate_v4(),
  submission_type submission_type not null,
  submitted_by uuid not null references public.users (id) on delete cascade,
  submitter_name text,
  content jsonb not null,
  moderation_status moderation_status not null default 'pending',
  moderation_notes text,
  moderated_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  moderated_at timestamptz
);

create index community_submissions_status_idx
  on public.community_submissions (moderation_status, created_at);

-- ---------------------------------------------------------------------------
-- caches — the Night Caches game
--
-- Small details of the city, found either by standing next to them or by
-- answering a question about them. `answers` is never sent to the client:
-- the check happens in log_cache_find().
-- ---------------------------------------------------------------------------

create table public.caches (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  hint text not null,
  story text not null,
  location geography(point, 4326) not null,
  latitude double precision generated always as (st_y(location::geometry)) stored,
  longitude double precision generated always as (st_x(location::geometry)) stored,
  area text,
  difficulty cache_difficulty not null default 'easy',
  points integer not null default 15 check (points between 0 and 100),
  image_url text,
  accessibility text[] not null default '{}',
  night_only boolean not null default false,
  question text not null,
  answers text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index caches_location_idx on public.caches using gist (location);
create unique index caches_title_key on public.caches (title);

create table public.cache_finds (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users (id) on delete cascade,
  cache_id uuid not null references public.caches (id) on delete cascade,
  method find_method not null,
  found_at timestamptz not null default now(),
  unique (user_id, cache_id)
);

create index cache_finds_cache_idx on public.cache_finds (cache_id);

-- Public scoreboard: how many people have found each one, without naming them.
create view public.cache_find_counts
with (security_invoker = false) as
select cache_id, count(*) as finds
from public.cache_finds
group by cache_id;

/*
 * The client's view of a cache. Deliberately omits `answers` — a quiz whose
 * answers ship to the browser is not a quiz. RLS grants SELECT on this, never
 * on public.caches itself.
 */
create view public.caches_public
with (security_invoker = false) as
select id, title, hint, story, latitude, longitude, area, difficulty, points,
       image_url, accessibility, night_only, question, created_at
from public.caches;

-- ---------------------------------------------------------------------------
-- courses & enrolments — Grow
--
-- Artistic courses whose price is points rather than euros. cash_cost_euros is
-- the open-market price, kept so the app can show what the exchange is worth.
-- ---------------------------------------------------------------------------

create table public.courses (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  provider text not null,
  description text not null,
  certificate text,
  format course_format not null default 'class',
  discipline text not null,
  level course_level not null default 'any',
  points_cost integer not null check (points_cost >= 0),
  cash_cost_euros double precision not null default 0 check (cash_cost_euros >= 0),
  sessions integer not null default 1 check (sessions > 0),
  hours_total double precision not null default 0,
  starts_on timestamptz not null,
  location geography(point, 4326),
  latitude double precision generated always as (st_y(location::geometry)) stored,
  longitude double precision generated always as (st_x(location::geometry)) stored,
  address text,
  image_url text,
  accessibility text[] not null default '{}',
  capacity integer not null check (capacity > 0),
  materials_included boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index courses_title_start_key on public.courses (title, starts_on);
create index courses_starts_idx on public.courses (starts_on);

create table public.enrolments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  status enrolment_status not null default 'reserved',
  points_spent integer not null default 0,
  enrolled_at timestamptz not null default now()
);

-- One live place each. A cancelled row does not block re-enrolling.
create unique index enrolments_one_live_place
  on public.enrolments (user_id, course_id)
  where status <> 'cancelled';

create index enrolments_course_idx on public.enrolments (course_id);

-- Places taken, without naming who took them.
create view public.enrolment_counts
with (security_invoker = false) as
select course_id, count(*) as taken
from public.enrolments
where status <> 'cancelled'
group by course_id;

-- ---------------------------------------------------------------------------
-- user_journey (prompt 29)
-- ---------------------------------------------------------------------------

create table public.user_journey (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  current_stage journey_stage not null default 'discovered',
  discovered_at timestamptz,
  explored_at timestamptz,
  participated_at timestamptz,
  connected_at timestamptz,
  contributed_at timestamptz,
  grown_at timestamptz,
  belonged_at timestamptz
);

-- The trigger references user_points and user_journey, so attach it only now
-- that both tables exist.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Functions the client calls by RPC
-- ---------------------------------------------------------------------------

-- Points are never written directly by the client: RLS makes user_points
-- read-only to its owner, and this function is the only way in.
create or replace function public.add_user_points(target_user uuid, delta integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance integer;
begin
  if auth.uid() is null or auth.uid() <> target_user then
    raise exception 'You can only add points to your own account';
  end if;

  if delta < 0 or delta > 100 then
    raise exception 'Point awards must be between 0 and 100';
  end if;

  insert into public.user_points (user_id, points_balance, last_updated)
  values (target_user, delta, now())
  on conflict (user_id) do update
    set points_balance = public.user_points.points_balance + excluded.points_balance,
        last_updated = now()
  returning points_balance into new_balance;

  -- Keep the denormalised copy on the profile in step. users_guard_role would
  -- otherwise reject this write, so raise the trusted-context flag it checks.
  perform set_config('night_shield.trusted', 'on', true);
  update public.users set points = new_balance where id = target_user;
  perform set_config('night_shield.trusted', 'off', true);

  return new_balance;
end;
$$;

-- Badges are earned, never self-granted, so user_badges carries no INSERT
-- policy and this is the only writer.
create or replace function public.award_badge(target_user uuid, badge text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  badge_row public.user_badges;
begin
  -- A moderator awards on approval; otherwise you may only earn your own.
  if auth.uid() is null or (auth.uid() <> target_user and not public.is_admin()) then
    raise exception 'You cannot award that badge';
  end if;

  insert into public.user_badges (user_id, badge_name)
  values (target_user, badge)
  on conflict (user_id, badge_name) do nothing
  returning * into badge_row;

  if badge_row.id is null then
    return null; -- already held
  end if;

  return json_build_object(
    'id', badge_row.id,
    'user_id', badge_row.user_id,
    'badge_name', badge_row.badge_name,
    'earned_at', badge_row.earned_at
  );
end;
$$;

-- A virtual event's join link is only for people who said they are coming.
-- The column itself is revoked from anon/authenticated in 0002_rls.sql, so
-- this function is the only way to read it.
create or replace function public.event_join_url(event uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  link text;
begin
  if auth.uid() is null then
    return null;
  end if;

  select e.virtual_url into link
  from public.events e
  where e.id = event
    and (
      e.organizer_id = auth.uid()
      or public.is_admin()
      or exists (
        select 1 from public.event_rsvps r
        where r.event_id = e.id and r.user_id = auth.uid() and r.rsvp_status = 'going'
      )
    );

  return link;
end;
$$;

-- Moves a journey forward. Never backwards: re-opening the map must not undo
-- someone's progress.
create or replace function public.advance_journey_stage(target_user uuid, stage_name text)
returns public.user_journey
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.user_journey;
begin
  if auth.uid() is null or auth.uid() <> target_user then
    raise exception 'You can only advance your own journey';
  end if;

  insert into public.user_journey (user_id, current_stage, discovered_at)
  values (target_user, 'discovered', now())
  on conflict (user_id) do nothing;

  execute format(
    'update public.user_journey
       set %I = coalesce(%I, now()), current_stage = $1
     where user_id = $2',
    stage_name || '_at', stage_name || '_at'
  ) using stage_name::journey_stage, target_user;

  select * into result from public.user_journey where user_id = target_user;
  return result;
end;
$$;

-- Approving a submission both stamps the queue row and promotes the payload
-- into the live table, in one transaction.
create or replace function public.approve_submission(submission uuid, moderator uuid)
returns public.community_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  sub public.community_submissions;
  payload jsonb;
  point geography(point, 4326);
begin
  if not exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Only moderators can approve submissions';
  end if;

  select * into sub from public.community_submissions where id = submission for update;
  if not found then
    raise exception 'Submission not found';
  end if;
  if sub.moderation_status <> 'pending' then
    raise exception 'That submission has already been moderated';
  end if;

  payload := sub.content;
  point := st_setsrid(
    st_makepoint(
      (payload -> 'location' ->> 'longitude')::double precision,
      (payload -> 'location' ->> 'latitude')::double precision
    ),
    4326
  )::geography;

  if sub.submission_type = 'installation' then
    insert into public.installations
      (title, artist, description, location, address, images, category,
       is_temporary, accessibility, created_by, moderation_status)
    values (
      payload ->> 'title',
      payload ->> 'artist',
      payload ->> 'description',
      point,
      payload ->> 'address',
      coalesce(
        array(select jsonb_array_elements_text(payload -> 'images')),
        '{}'
      ),
      payload ->> 'category',
      coalesce((payload ->> 'is_temporary')::boolean, false),
      coalesce(
        array(select jsonb_array_elements_text(payload -> 'accessibility')),
        '{}'
      ),
      sub.submitted_by,
      'approved'
    );

  elsif sub.submission_type = 'third_space' then
    insert into public.third_spaces
      (name, type, description, location, address, hours_open, cost,
       accessibility, image_url, created_by)
    values (
      payload ->> 'name',
      coalesce((payload ->> 'type')::third_space_type, 'cafe'),
      payload ->> 'description',
      point,
      payload ->> 'address',
      payload ->> 'hours_open',
      payload ->> 'cost',
      coalesce(
        array(select jsonb_array_elements_text(payload -> 'accessibility')),
        '{}'
      ),
      payload ->> 'image_url',
      sub.submitted_by
    );

  elsif sub.submission_type = 'event' then
    insert into public.events
      (title, description, category, location, address, start_time, end_time,
       capacity, cost_euros, organizer_id, organizer_name, image_url,
       accessibility, is_virtual, virtual_url)
    values (
      payload ->> 'title',
      payload ->> 'description',
      coalesce((payload ->> 'category')::event_category, 'workshop'),
      case when coalesce((payload ->> 'is_virtual')::boolean, false) then null else point end,
      payload ->> 'address',
      (payload ->> 'start_time')::timestamptz,
      (payload ->> 'end_time')::timestamptz,
      nullif(payload ->> 'capacity', '')::integer,
      coalesce((payload ->> 'cost_euros')::double precision, 0),
      sub.submitted_by,
      payload ->> 'organizer_name',
      payload ->> 'image_url',
      coalesce(
        array(select jsonb_array_elements_text(payload -> 'accessibility')),
        '{}'
      ),
      coalesce((payload ->> 'is_virtual')::boolean, false),
      payload ->> 'virtual_url'
    );
  end if;

  update public.community_submissions
    set moderation_status = 'approved',
        moderated_by = moderator,
        moderated_at = now()
  where id = submission
  returning * into sub;

  return sub;
end;
$$;

/*
 * Log a Night Cache find and pay out for it.
 *
 * Everything that decides whether the find is legitimate happens here:
 *   - a 'visited' find has its distance measured server-side, because a client
 *     that simply asserts "I am standing here" cannot be believed;
 *   - an 'answered' find has its answer checked against public.caches.answers,
 *     which is never exposed to the browser.
 * Points come from the cache row, not from anything the caller sends.
 */
create or replace function public.log_cache_find(
  target_cache uuid,
  method find_method,
  at_latitude double precision default null,
  at_longitude double precision default null,
  given_answer text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  cache_row public.caches;
  find_row public.cache_finds;
  metres double precision;
  reward integer;
  normalised text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to log a find';
  end if;

  select * into cache_row from public.caches where id = target_cache;
  if not found then
    raise exception 'That cache is not on the map any more';
  end if;

  -- Already found: return the original find rather than paying twice.
  select * into find_row
  from public.cache_finds
  where user_id = auth.uid() and cache_id = target_cache;

  if found then
    return json_build_object(
      'id', find_row.id, 'user_id', find_row.user_id, 'cache_id', find_row.cache_id,
      'method', find_row.method, 'found_at', find_row.found_at, 'already_found', true
    );
  end if;

  if method = 'visited' then
    if at_latitude is null or at_longitude is null then
      raise exception 'We need your location to confirm you are there';
    end if;

    select st_distance(
             cache_row.location,
             st_setsrid(st_makepoint(at_longitude, at_latitude), 4326)::geography
           )
      into metres;

    if metres > 60 then
      raise exception 'You are still % m away', round(metres);
    end if;

    reward := cache_row.points;
  else
    normalised := regexp_replace(lower(btrim(coalesce(given_answer, ''))), '\s+', ' ', 'g');
    if normalised = '' then
      raise exception 'Have a guess first';
    end if;

    if not exists (
      select 1
      from unnest(cache_row.answers) as candidate
      where regexp_replace(lower(btrim(candidate)), '\s+', ' ', 'g') = normalised
    ) then
      raise exception 'Not quite — look at the photo again';
    end if;

    -- Working it out from home is worth 40%, floor of 5.
    reward := greatest(5, round(cache_row.points * 0.4));
  end if;

  insert into public.cache_finds (user_id, cache_id, method)
  values (auth.uid(), target_cache, method)
  returning * into find_row;

  perform public.add_user_points(auth.uid(), reward);

  return json_build_object(
    'id', find_row.id, 'user_id', find_row.user_id, 'cache_id', find_row.cache_id,
    'method', find_row.method, 'found_at', find_row.found_at,
    'points_awarded', reward, 'already_found', false
  );
end;
$$;

/*
 * Take a place on a course and pay for it in points, atomically.
 *
 * Three things have to be true and none of them can be decided by the client:
 * the course has not started, a place is still free, and the caller actually
 * has the points. The row lock on the course serialises the last-place race.
 */
create or replace function public.enrol_in_course(target_course uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  course_row public.courses;
  enrolment_row public.enrolments;
  taken integer;
  balance integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in to take a place';
  end if;

  -- FOR UPDATE so two people cannot both take the last place.
  select * into course_row from public.courses where id = target_course for update;
  if not found then
    raise exception 'That course is no longer listed';
  end if;

  select * into enrolment_row
  from public.enrolments
  where user_id = auth.uid() and course_id = target_course and status <> 'cancelled';

  if found then
    return json_build_object(
      'id', enrolment_row.id, 'user_id', enrolment_row.user_id,
      'course_id', enrolment_row.course_id, 'status', enrolment_row.status,
      'points_spent', enrolment_row.points_spent, 'enrolled_at', enrolment_row.enrolled_at,
      'already_enrolled', true
    );
  end if;

  if course_row.starts_on < now() then
    raise exception 'That course has already started';
  end if;

  select count(*) into taken
  from public.enrolments
  where course_id = target_course and status <> 'cancelled';

  if taken >= course_row.capacity then
    raise exception 'That course is full';
  end if;

  select points_balance into balance from public.user_points where user_id = auth.uid();
  balance := coalesce(balance, 0);

  if balance < course_row.points_cost then
    raise exception 'You need % more points for this one', course_row.points_cost - balance;
  end if;

  -- Debit. The guard trigger on users allows this only inside a trusted call.
  update public.user_points
    set points_balance = points_balance - course_row.points_cost,
        last_updated = now()
  where user_id = auth.uid();

  perform set_config('night_shield.trusted', 'on', true);
  update public.users set points = balance - course_row.points_cost where id = auth.uid();
  perform set_config('night_shield.trusted', 'off', true);

  insert into public.enrolments (user_id, course_id, status, points_spent)
  values (auth.uid(), target_course, 'reserved', course_row.points_cost)
  returning * into enrolment_row;

  return json_build_object(
    'id', enrolment_row.id, 'user_id', enrolment_row.user_id,
    'course_id', enrolment_row.course_id, 'status', enrolment_row.status,
    'points_spent', enrolment_row.points_spent, 'enrolled_at', enrolment_row.enrolled_at,
    'already_enrolled', false
  );
end;
$$;

/*
 * Give the place back and refund the points — but only while the course has
 * not started, which is the point at which the provider has committed costs.
 */
create or replace function public.cancel_enrolment(target_course uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  course_row public.courses;
  enrolment_row public.enrolments;
  balance integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;

  select * into enrolment_row
  from public.enrolments
  where user_id = auth.uid() and course_id = target_course and status <> 'cancelled'
  for update;

  if not found then
    return; -- nothing to cancel
  end if;

  select * into course_row from public.courses where id = target_course;
  if found and course_row.starts_on < now() then
    raise exception 'That course has started — talk to the provider directly';
  end if;

  update public.enrolments set status = 'cancelled' where id = enrolment_row.id;

  update public.user_points
    set points_balance = points_balance + enrolment_row.points_spent,
        last_updated = now()
  where user_id = auth.uid()
  returning points_balance into balance;

  perform set_config('night_shield.trusted', 'on', true);
  update public.users set points = coalesce(balance, 0) where id = auth.uid();
  perform set_config('night_shield.trusted', 'off', true);
end;
$$;

-- Housekeeping: user_saved.item_id has no foreign key (it is polymorphic), so
-- sweep rows whose target has been deleted. Run on a schedule.
create or replace function public.prune_orphaned_saves()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  with deleted as (
    delete from public.user_saved s
    where (s.item_type = 'installation'
             and not exists (select 1 from public.installations i where i.id = s.item_id))
       or (s.item_type = 'route'
             and not exists (select 1 from public.routes r where r.id = s.item_id))
       or (s.item_type = 'event'
             and not exists (select 1 from public.events e where e.id = s.item_id))
       or (s.item_type = 'third_space'
             and not exists (select 1 from public.third_spaces t where t.id = s.item_id))
    returning 1
  )
  select count(*) into removed from deleted;

  return removed;
end;
$$;
