-- ============================================================================
-- Night Shield — placements_public catches up with the hunt
-- Municipality of Tilburg, Inclusivity Department
--
-- Migration 0007 added hunt_clue to the placements TABLE and created the
-- placement_find_counts view, but left placements_public exactly as 0004 wrote
-- it. The client reads placements through the view and asks for both new
-- columns, so on Supabase every request for the changing route came back as a
-- PostgREST error and the Art routes page showed "Could not load what is out
-- there" — with the local backend working perfectly, which is the combination
-- that hides this kind of thing for months.
--
-- find_count comes from the counts view rather than a column on placements, so
-- there is nothing to keep in sync: a piece nobody has found yet reports 0
-- instead of null, because a count of nothing is a number and the client
-- displays it.
--
-- Safe to run twice.
-- ============================================================================


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
  p.collected_at,
  /*
   * The clue is meant to be read — that is the whole mechanic. What the piece
   * actually is stays hidden in the interface until somebody logs a find.
   *
   * That hiding is presentation, not secrecy: anything in this view is readable
   * over the API by anyone who asks it directly. For a demo that is the right
   * trade, because the alternative is withholding the title server-side and
   * then having no way to show it once the find is logged. It is written down
   * here so nobody later mistakes the interface for an access control.
   */
  p.hunt_clue,
  coalesce(c.find_count, 0) as find_count
from public.placements p
join public.route_spots s on s.id = p.spot_id
left join public.placement_find_counts c on c.placement_id = p.id;

grant select on public.placements_public to anon, authenticated;
