-- ============================================================================
-- Night Shield — two things the backends disagreed about
-- Municipality of Tilburg, Inclusivity Department
--
-- 1. Answering a Night Cache from home paid greatest(5, 40%) here and
--    Math.max(2, 40%) in the client. Six of the eight seeded caches paid a
--    different number depending on which backend was answering.
--
-- 2. Submitting content paid ten points the moment the form was sent, keyed
--    on a brand-new submission id, so every submission was a fresh ledger row
--    and ten more points whatever was in it. Twenty pieces of nonsense bought
--    the dearest course in the catalogue. The points now land when a
--    moderator approves, which is what the submitter is told will happen.
--
-- The award is a trigger rather than an edit to approve_submission() because
-- it then covers every route to approval, including a direct update by an
-- admin, and does not mean restating two hundred lines of unrelated function
-- body to change one thing.
--
-- Safe to run twice.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. The remote find floor
-- ---------------------------------------------------------------------------

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

    -- A comparison against NULL yields NULL, and `if NULL` is simply not
    -- taken — so `metres > 60` quietly *passes* whenever the distance cannot
    -- be computed (a cache with no location, a coordinate that does not
    -- project). NaN needs the same treatment. Demand a real number first.
    if metres is null or metres <> metres then
      raise exception 'We could not work out where you are';
    end if;

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

    /*
     * Working it out from home is worth 40%, floor of 2 — the same number as
     * remoteCachePoints() in src/types/index.ts, which is the whole reason
     * this migration exists. The floor used to be 5 here and 2 there, so six
     * of the eight seeded caches paid a different amount depending on which
     * backend answered.
     *
     * 2 rather than 5 because the caches are worth 6 to 16: with a floor of 5
     * a six-point cache paid 5 for answering from a chair against 6 for
     * walking to it, which is not a choice anyone would agonise over. The
     * difficulty ladder the points are meant to express only survives at 2.
     */
    reward := greatest(2, round(cache_row.points * 0.4));
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


-- ---------------------------------------------------------------------------
-- 2. Submitting pays on approval
-- ---------------------------------------------------------------------------

/*
 * award_points_for() pays auth.uid(), which during moderation is the
 * moderator. The submitter is somebody else, so the ledger row is written
 * directly here — with the submission id as the subject, so the existing
 * unique key makes a second approval of the same submission a no-op.
 */
create or replace function public.pay_for_approved_submission()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  amount integer := 10;  -- POINTS.submit_content
begin
  if new.moderation_status <> 'approved' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.moderation_status = 'approved' then
    return new;
  end if;

  insert into public.point_awards (user_id, reason, subject_id, period, amount)
  values (new.submitted_by, 'submit_content', new.id, null, amount)
  on conflict do nothing;

  if not found then
    return new;
  end if;

  insert into public.user_points (user_id, points_balance, last_updated)
  values (new.submitted_by, amount, now())
  on conflict (user_id) do update
    set points_balance = public.user_points.points_balance + excluded.points_balance,
        last_updated = now();

  return new;
end $$;

drop trigger if exists pay_for_approved_submission on public.community_submissions;
create trigger pay_for_approved_submission
  after insert or update of moderation_status on public.community_submissions
  for each row
  execute function public.pay_for_approved_submission();
