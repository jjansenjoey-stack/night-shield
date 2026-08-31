-- ============================================================================
-- Night Shield — hiding a piece, and finding one
-- Municipality of Tilburg, Inclusivity Department
--
-- A maker can hide their piece and leave a clue instead of putting it on show.
-- Anyone else can then go and find it, which is checked the same way a Night
-- Cache find is: by measuring the distance server-side against the spot the
-- piece is at. Safe to run twice.
-- ============================================================================


alter table public.placements add column if not exists hunt_clue text
  check (hunt_clue is null or length(hunt_clue) <= 140);

comment on column public.placements.hunt_clue is
  'Set to hide the piece until somebody finds it. The clue is public; the piece is not.';


create table if not exists public.placement_finds (
  id uuid primary key default uuid_generate_v4(),
  placement_id uuid not null references public.placements (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  found_at timestamptz not null default now(),

  -- One find per person per piece. This is what stops the reward repeating.
  unique (placement_id, user_id)
);

create index if not exists placement_finds_user_idx on public.placement_finds (user_id);

alter table public.placement_finds enable row level security;

drop policy if exists placement_finds_read on public.placement_finds;
-- Counts are public (the gallery shows them); nothing here is sensitive.
create policy placement_finds_read on public.placement_finds
  for select using (true);

-- No insert policy: rows appear only through log_placement_find().
grant select on public.placement_finds to anon, authenticated;


/*
 * How many people have found each piece.
 *
 * A view rather than a counter column: a column would need a trigger to stay
 * true, and a counter that can drift is worse than no counter.
 */
create or replace view public.placement_find_counts
with (security_invoker = true) as
select placement_id, count(*)::integer as find_count
from public.placement_finds
group by placement_id;

grant select on public.placement_find_counts to anon, authenticated;


-- ---------------------------------------------------------------------------
-- Placing, now with an optional clue
-- ---------------------------------------------------------------------------

create or replace function public.place_art(
  target_spot uuid,
  p_title text,
  p_description text default null,
  p_materials text default null,
  p_image_url text default null,
  p_hunt_clue text default null
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

  if exists (
    select 1 from public.placements
    where user_id = uid and status = 'live' and collect_by >= now()
  ) then
    raise exception 'You already have a piece out. Collect it before placing another.';
  end if;

  update public.placements
     set status = 'collected', collected_at = now()
   where spot_id = target_spot and status = 'live' and collect_by < now();

  insert into public.placements (
    spot_id, user_id, maker_name, title, description, materials, image_url,
    placed_at, collect_by, hunt_clue
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
    now() + make_interval(days => window_days),
    nullif(btrim(coalesce(p_hunt_clue, '')), '')
  )
  returning * into fresh;

  perform public.award_points_for('place_art', fresh.id);

  return fresh;
end $$;


-- ---------------------------------------------------------------------------
-- Finding
-- ---------------------------------------------------------------------------

create or replace function public.log_placement_find(
  target_placement uuid,
  at_latitude double precision,
  at_longitude double precision
)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
  row_p public.placements;
  spot_row public.route_spots;
  metres double precision;
begin
  if uid is null then
    raise exception 'Sign in first';
  end if;

  select * into row_p from public.placements where id = target_placement;
  if not found then
    raise exception 'We cannot find that piece';
  end if;

  if row_p.user_id = uid then
    raise exception 'You hid this one — let somebody else find it';
  end if;

  if row_p.status <> 'live' or row_p.collect_by < now() then
    raise exception 'That piece is not out there any more';
  end if;

  select * into spot_row from public.route_spots where id = row_p.spot_id;
  if not found then
    raise exception 'That spot is not on the route any more';
  end if;

  if at_latitude is null or at_longitude is null then
    raise exception 'We need your location to confirm you are there';
  end if;

  select st_distance(
           spot_row.location,
           st_setsrid(st_makepoint(at_longitude, at_latitude), 4326)::geography
         )
    into metres;

  /*
   * NULL and NaN both slip past a bare `metres > 60`, because neither
   * comparison is ever true. Demand a real number before trusting it — the
   * same guard log_cache_find() needed.
   */
  if metres is null or metres <> metres then
    raise exception 'We could not work out where you are';
  end if;

  if metres > 60 then
    raise exception 'You are still % m away', round(metres);
  end if;

  insert into public.placement_finds (placement_id, user_id)
  values (target_placement, uid)
  on conflict do nothing;

  if not found then
    -- Already logged. Report the balance rather than failing.
    return coalesce(
      (select points_balance from public.user_points where user_id = uid), 0
    );
  end if;

  return public.award_points_for('find_art', target_placement);
end $$;


-- ---------------------------------------------------------------------------
-- The price list gains find_art
--
-- Small on purpose: the walk is the reward, and finding somebody else's work
-- must never be worth more than making your own.
-- ---------------------------------------------------------------------------

create or replace function public.award_points_for(
  reason text,
  subject uuid default null,
  period text default null
)
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
    when 'walk_art_route'   then 1
    when 'find_art'         then 3
    else null
  end;

  if amount is null then
    raise exception 'Unknown points reason: %', reason;
  end if;

  if reason = 'walk_art_route' then
    period := to_char(now() at time zone 'Europe/Amsterdam', 'IYYY"-W"IW');
  else
    period := null;
  end if;

  insert into public.point_awards (user_id, reason, subject_id, period, amount)
  values (uid, reason, subject, period, amount)
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


revoke execute on function public.place_art(uuid, text, text, text, text, text)
  from public, anon, authenticated;
revoke execute on function public.log_placement_find(uuid, double precision, double precision)
  from public, anon, authenticated;
revoke execute on function public.award_points_for(text, uuid, text)
  from public, anon, authenticated;

grant execute on function public.place_art(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.log_placement_find(uuid, double precision, double precision)
  to authenticated;
grant execute on function public.award_points_for(text, uuid, text) to authenticated;

-- The five-argument place_art is superseded; leaving both would give PostgREST
-- two overloads to choose between and it would refuse to pick.
drop function if exists public.place_art(uuid, text, text, text, text);
