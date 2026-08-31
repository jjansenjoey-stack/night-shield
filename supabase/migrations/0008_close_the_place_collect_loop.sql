-- ============================================================================
-- Night Shield — placing and collecting are counted per person, per week
-- Municipality of Tilburg, Inclusivity Department
--
-- place_art and collect_art were keyed on the placement id, and every new
-- placement has a new one. So place, collect, place, collect on a single spot
-- paid its full 14 + 6 every lap and never once repeated a ledger key. Six laps
-- takes a few seconds and pays 120 points; the most expensive course in the
-- catalogue costs 200. There was no walking, no location check and no cooldown
-- anywhere in that path.
--
-- Dropping the subject makes the week the limit instead. The route turns over
-- every fortnight and one person may hold one spot at a time, so somebody
-- taking part properly places once and collects once inside that window and
-- loses nothing at all. walk_art_route keeps its subject, because walking two
-- different routes in one week really is two different things.
--
-- Safe to run twice.
-- ============================================================================


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

  /*
   * The window is decided here and never by the caller. A client free to name
   * its own period could pass a different string on every call and turn a
   * once-a-week award into an unlimited one.
   */
  if reason in ('walk_art_route', 'place_art', 'collect_art') then
    period := to_char(now() at time zone 'Europe/Amsterdam', 'IYYY"-W"IW');
  else
    period := null;
  end if;

  -- The subject is what made the loop possible; for these two it goes.
  if reason in ('place_art', 'collect_art') then
    subject := null;
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


/*
 * No new index is needed. point_awards_unique_key from migration 0005 is
 * already (user_id, reason, coalesce(subject_id::text, ''), coalesce(period,
 * '')), which coalesces both nullable parts — so a null subject really does
 * collide with the next null subject, and `on conflict do nothing` above has
 * something to conflict with. The loop was never a missing constraint; it was
 * a key that changed on every lap.
 */

revoke execute on function public.award_points_for(text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.award_points_for(text, uuid, text) to authenticated;
