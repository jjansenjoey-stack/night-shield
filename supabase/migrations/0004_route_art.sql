-- ============================================================================
-- Night Shield — Two Weeks Only
-- Municipality of Tilburg, Inclusivity Department
--
-- A walking loop with eight fixed spots. Anyone may put a small piece of work
-- in a free spot and earn points; a fortnight later they collect it, or the
-- municipality clears the spot for the next person.
--
-- Two rules carry the whole idea and both are enforced here, not in the client:
-- a spot holds one live piece at a time, and a person has one piece out at a
-- time. Safe to run twice.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- Spots
--
-- The spots are municipal furniture, not user content: they are created by the
-- Inclusivity Department and are read-only to everyone else. They never move,
-- which is the point — a walker learns the route once.
-- ---------------------------------------------------------------------------

create table if not exists public.route_spots (
  id uuid primary key default uuid_generate_v4(),
  route_id uuid not null references public.routes (id) on delete cascade,
  number integer not null check (number > 0),
  label text not null,
  hint text not null default '',
  location geography(point, 4326) not null,
  latitude double precision generated always as (st_y(location::geometry)) stored,
  longitude double precision generated always as (st_x(location::geometry)) stored,
  -- Longest side. Keeps a "small installation" small enough to carry.
  max_size_cm integer not null default 40 check (max_size_cm between 5 and 200),
  accessibility text[] not null default '{}',
  created_at timestamptz not null default now(),

  unique (route_id, number)
);

create index if not exists route_spots_route_idx on public.route_spots (route_id);


-- ---------------------------------------------------------------------------
-- Placements
--
-- `status` is only ever 'live' or 'collected'. Expiry is NOT stored: a row is
-- expired when collect_by has passed, which is computed wherever it is needed.
-- A scheduled job that flips rows to 'removed' is one more thing to run and to
-- get wrong, and if it ever stops, expired work silently stays on show.
-- ---------------------------------------------------------------------------

create table if not exists public.placements (
  id uuid primary key default uuid_generate_v4(),
  spot_id uuid not null references public.route_spots (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  maker_name text,
  title text not null check (length(btrim(title)) between 1 and 80),
  description text check (description is null or length(description) <= 400),
  materials text check (materials is null or length(materials) <= 80),
  image_url text,
  placed_at timestamptz not null default now(),
  collect_by timestamptz not null,
  status text not null default 'live' check (status in ('live', 'collected')),
  collected_at timestamptz,

  constraint placements_collect_after_placed check (collect_by > placed_at),
  constraint placements_collected_has_time check (
    (status = 'collected' and collected_at is not null)
    or (status = 'live' and collected_at is null)
  )
);

create index if not exists placements_spot_idx on public.placements (spot_id);
create index if not exists placements_user_idx on public.placements (user_id);

/*
 * At most one live, unexpired piece per spot.
 *
 * A partial unique index cannot reference now(), so this only collapses rows
 * still marked 'live'. That is the invariant that matters: an expired row is
 * cleared by the municipality and marked 'collected' when the spot is emptied,
 * and place_art() below re-checks the deadline under a row lock anyway.
 */
create unique index if not exists placements_one_live_per_spot
  on public.placements (spot_id)
  where status = 'live';


-- ---------------------------------------------------------------------------
-- What a reader sees
--
-- route_id is joined in so the client can ask for a whole route in one query.
-- user_id is included because the app has to know which piece is yours to
-- collect; nothing else about the maker is exposed beyond the name they chose
-- to attach.
-- ---------------------------------------------------------------------------

create or replace view public.placements_public
with (security_invoker = true) as
select
  p.id,
  p.spot_id,
  s.route_id,
  p.user_id,
  p.maker_name,
  p.title,
  p.description,
  p.materials,
  p.image_url,
  p.placed_at,
  p.collect_by,
  p.status,
  p.collected_at
from public.placements p
join public.route_spots s on s.id = p.spot_id;


-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.route_spots enable row level security;
alter table public.placements enable row level security;

drop policy if exists route_spots_read_all on public.route_spots;
create policy route_spots_read_all on public.route_spots
  for select using (true);

drop policy if exists route_spots_admin_write on public.route_spots;
create policy route_spots_admin_write on public.route_spots
  for all using (public.is_admin()) with check (public.is_admin());

-- The work is on public display in the street, so it is publicly readable.
drop policy if exists placements_read_all on public.placements;
create policy placements_read_all on public.placements
  for select using (true);

-- No insert or update policy on purpose: rows are written only by the two
-- functions below, which own the occupancy and deadline rules.

grant select on public.route_spots to anon, authenticated;
grant select on public.placements to anon, authenticated;
grant select on public.placements_public to anon, authenticated;


-- ---------------------------------------------------------------------------
-- Placing
-- ---------------------------------------------------------------------------

create or replace function public.place_art(
  target_spot uuid,
  p_title text,
  p_description text default null,
  p_materials text default null,
  p_image_url text default null
)
returns public.placements
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
  spot_row public.route_spots;
  fresh public.placements;
  window_days integer := 14;
begin
  if uid is null then
    raise exception 'Sign in before putting something on the route';
  end if;

  -- Lock the spot for the length of the transaction. Two people can tap
  -- "place here" on the same spot in the same second, and whichever check runs
  -- first has to be the one that wins.
  select * into spot_row from public.route_spots where id = target_spot for update;
  if not found then
    raise exception 'That spot is not on the route any more';
  end if;

  if exists (
    select 1 from public.placements
    where spot_id = target_spot and status = 'live' and collect_by >= now()
  ) then
    raise exception 'Someone got to that spot first. Try another one.';
  end if;

  -- One piece at a time. Eight spots with no per-person limit means one
  -- enthusiast can hold the entire route for a fortnight.
  if exists (
    select 1 from public.placements
    where user_id = uid and status = 'live' and collect_by >= now()
  ) then
    raise exception 'You already have a piece out. Collect it before placing another.';
  end if;

  /*
   * An expired row still sitting in this spot is what the municipality would
   * have cleared. Close it off as it is replaced, so the partial unique index
   * stays satisfied and the spot's history reads correctly.
   */
  update public.placements
     set status = 'collected', collected_at = now()
   where spot_id = target_spot and status = 'live' and collect_by < now();

  insert into public.placements (
    spot_id, user_id, maker_name, title, description, materials, image_url,
    placed_at, collect_by
  )
  values (
    target_spot,
    uid,
    (select full_name from public.users where id = uid),
    btrim(p_title),
    nullif(btrim(coalesce(p_description, '')), ''),
    nullif(btrim(coalesce(p_materials, '')), ''),
    nullif(btrim(coalesce(p_image_url, '')), ''),
    now(),
    now() + make_interval(days => window_days)
  )
  returning * into fresh;

  perform public.award_points_for('place_art', fresh.id);

  return fresh;
end $$;


-- ---------------------------------------------------------------------------
-- Collecting
-- ---------------------------------------------------------------------------

create or replace function public.collect_placement(target_placement uuid)
returns public.placements
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
  row_out public.placements;
begin
  if uid is null then
    raise exception 'Sign in first';
  end if;

  select * into row_out from public.placements where id = target_placement for update;
  if not found then
    raise exception 'We cannot find that piece';
  end if;

  if row_out.user_id <> uid then
    raise exception 'That is not yours to collect';
  end if;

  if row_out.status = 'collected' then
    return row_out;  -- already done; a second tap is not an error
  end if;

  if row_out.collect_by < now() then
    raise exception 'The two weeks are up, so the municipality has already cleared this spot';
  end if;

  update public.placements
     set status = 'collected', collected_at = now()
   where id = target_placement
  returning * into row_out;

  perform public.award_points_for('collect_art', row_out.id);

  return row_out;
end $$;


-- ---------------------------------------------------------------------------
-- The price list gains two reasons
--
-- Replaced whole rather than patched, because the CASE in 0003 is the single
-- place the server decides what anything is worth. Placing is the largest
-- award on the board: it is the most work. Collecting pays too, and that is
-- deliberate — without it the route slowly becomes fly-tipping.
-- ---------------------------------------------------------------------------

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

  amount := case reason
    when 'submit_feedback'  then 4
    when 'rsvp_event'       then 2
    when 'attend_event'     then 8
    when 'event_feedback'   then 6
    when 'submit_content'   then 10
    when 'complete_route'   then 12
    when 'save_first_item'  then 2
    when 'place_art'        then 14
    when 'collect_art'      then 6
    else null
  end;

  if amount is null then
    raise exception 'Unknown points reason: %', reason;
  end if;

  insert into public.point_awards (user_id, reason, subject_id, amount)
  values (uid, reason, subject, amount)
  on conflict do nothing;

  if not found then
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


-- 0003 revoked EXECUTE from PUBLIC on everything in the schema; these are new,
-- so take the default away from them too before granting.
revoke execute on function public.place_art(uuid, text, text, text, text)
  from public, anon, authenticated;
revoke execute on function public.collect_placement(uuid) from public, anon, authenticated;
revoke execute on function public.award_points_for(text, uuid) from public, anon, authenticated;

grant execute on function public.place_art(uuid, text, text, text, text) to authenticated;
grant execute on function public.collect_placement(uuid) to authenticated;
grant execute on function public.award_points_for(text, uuid) to authenticated;
