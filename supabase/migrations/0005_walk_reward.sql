-- ============================================================================
-- Night Shield — a token reward for walking an art route again
-- Municipality of Tilburg, Inclusivity Department
--
-- Placing work on the changing route pays 14 and collecting it pays 6. Walking
-- it should pay something too — the point of a route that changes every
-- fortnight is that people come back and look — but walking costs nothing to
-- do, so an uncapped reward for it would be a tap-to-farm button.
--
-- So: 1 point, once per ISO week, per route. That is 52 a year against 364 for
-- placing, which keeps taking part worth about seven times more than looking,
-- and puts a hard ceiling on what walking alone can ever be worth.
--
-- Safe to run twice.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- The award ledger gains a period
--
-- Until now every award was once-ever, keyed on (user, reason, subject). A
-- repeatable award needs a fourth part to the key: the window it belongs to.
-- Null keeps the old behaviour, so nothing already in the table changes
-- meaning.
-- ---------------------------------------------------------------------------

alter table public.point_awards add column if not exists period text;

/*
 * One index instead of the previous pair.
 *
 * The old design used two partial indexes because NULL never equals NULL in a
 * unique index, so the subject_id-is-null case needed its own. Adding `period`
 * would have made that four partial indexes. Coalescing both nullable parts to
 * text collapses every case into a single key.
 */
drop index if exists public.point_awards_unique_subject;
drop index if exists public.point_awards_unique_global;

create unique index if not exists point_awards_unique_key
  on public.point_awards (
    user_id,
    reason,
    coalesce(subject_id::text, ''),
    coalesce(period, '')
  );


-- ---------------------------------------------------------------------------
-- The price list gains walk_art_route, and the function gains the period
--
-- Replaced whole rather than patched: the CASE below is the single place the
-- server decides what anything is worth, and the client still never sends an
-- amount.
--
-- Note the signature changes, so the three-argument version has to go or
-- PostgREST will see two overloads and refuse to pick one.
-- ---------------------------------------------------------------------------

drop function if exists public.award_points_for(text, uuid);

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
    -- Smallest award on the board, and the only repeatable one.
    when 'walk_art_route'   then 1
    else null
  end;

  if amount is null then
    raise exception 'Unknown points reason: %', reason;
  end if;

  /*
   * The period is server-side too. A client that passes its own week string
   * could pass a different one every call, so anything repeatable has its
   * window pinned here rather than trusted from the caller.
   */
  if reason = 'walk_art_route' then
    period := to_char(now() at time zone 'Europe/Amsterdam', 'IYYY"-W"IW');
  else
    period := null;
  end if;

  insert into public.point_awards (user_id, reason, subject_id, period, amount)
  values (uid, reason, subject, period, amount)
  on conflict do nothing;

  if not found then
    -- Already paid for this one, in this window. Report the balance rather
    -- than failing, so a repeat looks like a no-op instead of an error.
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

revoke execute on function public.award_points_for(text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.award_points_for(text, uuid, text) to authenticated;
