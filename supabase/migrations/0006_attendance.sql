-- ============================================================================
-- Night Shield — attendance points
-- Municipality of Tilburg, Inclusivity Department
--
-- attend_event was in the price list from the start and never awarded to
-- anyone: there was no way to know whether someone actually turned up. This
-- adds the missing proof — a code read out at the event — and makes the reward
-- depend on how much the event asks of you.
--
-- Safe to run twice.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- Two new columns
--
-- attendance_code is treated exactly like a cache answer and like
-- virtual_url: it is the proof, so it must never reach the browser. The
-- column grant below is what enforces that, not the client's good manners.
-- ---------------------------------------------------------------------------

alter table public.events add column if not exists attendance_code text;

alter table public.events add column if not exists points_reward integer
  check (points_reward is null or points_reward between 4 and 14);

comment on column public.events.attendance_code is
  'Read out at the event. Never granted to anon or authenticated.';
comment on column public.events.points_reward is
  'Overrides the duration-derived attendance reward. Clamped 4..14.';


-- ---------------------------------------------------------------------------
-- What turning up is worth
--
-- Two points an hour on top of a base of four, clamped to 4..14. A one-hour
-- talk pays 6; a full day hits the ceiling. The ceiling is deliberately below
-- place_art (14 for making something and carrying it across the city), because
-- attending should never out-earn making.
-- ---------------------------------------------------------------------------

create or replace function public.event_attendance_points(target_event uuid)
returns integer
language sql
stable
security definer
set search_path = public, extensions
as $$
  select greatest(4, least(14,
    coalesce(
      e.points_reward,
      round(4 + extract(epoch from (e.end_time - e.start_time)) / 3600.0 * 2)::integer
    )
  ))
  from public.events e
  where e.id = target_event;
$$;


-- ---------------------------------------------------------------------------
-- Claiming
-- ---------------------------------------------------------------------------

create or replace function public.claim_attendance(target_event uuid, given_code text)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
  ev public.events;
  amount integer;
  balance integer;
begin
  if uid is null then
    raise exception 'Sign in first';
  end if;

  select * into ev from public.events where id = target_event;
  if not found then
    raise exception 'That event is not on the calendar any more';
  end if;

  /*
   * Order matters. "Not started" has to come before the code check, or a
   * wrong-code message on a future event tells someone their guess was right.
   */
  if ev.start_time > now() then
    raise exception 'The code is given out at the event itself';
  end if;

  if not exists (
    select 1 from public.event_rsvps
    where event_id = target_event and user_id = uid and rsvp_status = 'going'
  ) then
    raise exception 'RSVP as going first, then claim at the event';
  end if;

  if coalesce(btrim(ev.attendance_code), '') = '' then
    raise exception 'This event has no code to claim with';
  end if;

  if lower(regexp_replace(coalesce(given_code, ''), '\s', '', 'g'))
     <> lower(regexp_replace(ev.attendance_code, '\s', '', 'g')) then
    raise exception 'That code is not right';
  end if;

  amount := public.event_attendance_points(target_event);

  -- The ledger keeps this to once per event, same as every other award.
  insert into public.point_awards (user_id, reason, subject_id, period, amount)
  values (uid, 'attend_event', target_event, null, amount)
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


-- ---------------------------------------------------------------------------
-- Grants
--
-- 0003 replaced the table-level SELECT on events with an explicit column list,
-- because a column REVOKE after a table GRANT is a no-op. That list has to be
-- reissued with points_reward added — and with attendance_code left out, which
-- is the entire point.
-- ---------------------------------------------------------------------------

revoke select on public.events from anon, authenticated;

grant select (
  id, title, description, category, location, latitude, longitude, address,
  start_time, end_time, capacity, cost_euros, organizer_id, organizer_name,
  image_url, accessibility, is_virtual, is_featured, points_reward,
  updated_at, created_at
) on public.events to anon, authenticated;

grant insert, update, delete on public.events to authenticated;

revoke execute on function public.claim_attendance(uuid, text) from public, anon, authenticated;
revoke execute on function public.event_attendance_points(uuid) from public, anon, authenticated;

grant execute on function public.claim_attendance(uuid, text) to authenticated;
grant execute on function public.event_attendance_points(uuid) to anon, authenticated;
