-- ============================================================================
-- Night Shield — row-level security (prompt 30)
--
-- Default posture: deny. Every table below enables RLS and then grants back
-- only what the app genuinely needs.
--
-- The rules that matter most here:
--   * Nobody but a moderator can read who filed a safety report.
--   * Nobody can escalate their own role.
--   * Points are written only through add_user_points().
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- security definer so the policies below can check a role without recursing
-- into the users policies they are themselves guarding.
create or replace function public.current_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.users where id = auth.uid()) = 'admin', false);
$$;

create or replace function public.is_at_least(required user_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    array_position(
      array['citizen', 'contributor', 'organizer', 'admin']::user_role[],
      (select role from public.users where id = auth.uid())
    ) >= array_position(
      array['citizen', 'contributor', 'organizer', 'admin']::user_role[],
      required
    ),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------

alter table public.users enable row level security;

create policy users_select_self on public.users
  for select using (id = auth.uid() or public.is_admin());

create policy users_update_self on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Only ever your own row, and only ever the one the auth trigger would have
-- made anyway — this backs signUp's safety-net upsert.
create policy users_insert_self on public.users
  for insert with check (id = auth.uid());

create policy users_admin_all on public.users
  for all using (public.is_admin()) with check (public.is_admin());

-- A person may edit their profile but not promote themselves. Enforced with a
-- trigger rather than a policy, because a WITH CHECK cannot see the old row.
/*
 * `night_shield.trusted` is raised by our own security-definer functions for
 * the duration of one statement. It lets add_user_points() write the
 * denormalised users.points without this trigger rejecting it, while a request
 * coming straight from the client still cannot.
 *
 * A null auth.uid() means there is no JWT at all — a migration, the seed, or a
 * server-side job. RLS already stops anon from updating this table, so treating
 * that as trusted is safe and keeps seeding from tripping the guard.
 */
create or replace function public.is_trusted_context()
returns boolean
language sql
stable
as $$
  select auth.uid() is null
      or coalesce(current_setting('night_shield.trusted', true), 'off') = 'on';
$$;

create or replace function public.guard_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_trusted_context() then
    return new;
  end if;

  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only an administrator can change a role';
  end if;

  -- Same for the denormalised points column: add_user_points() owns it.
  if new.points is distinct from old.points and not public.is_admin() then
    raise exception 'Points are awarded by the system, not set directly';
  end if;

  return new;
end;
$$;

drop trigger if exists users_guard_role on public.users;
create trigger users_guard_role
  before update on public.users
  for each row execute function public.guard_role_escalation();

-- ---------------------------------------------------------------------------
-- installations — anyone reads what is live; creators and admins edit their own
-- ---------------------------------------------------------------------------

alter table public.installations enable row level security;

create policy installations_read_public on public.installations
  for select using (
    (status = 'active' and moderation_status = 'approved')
    or created_by = auth.uid()
    or public.is_admin()
  );

create policy installations_insert on public.installations
  for insert with check (
    public.is_at_least('contributor') and created_by = auth.uid()
  );

create policy installations_update_own on public.installations
  for update using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());

create policy installations_delete_own on public.installations
  for delete using (created_by = auth.uid() or public.is_admin());

-- A contributor must not publish straight past the queue.
create or replace function public.guard_moderation_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Migrations and the seed insert already-approved content.
  if public.is_trusted_context() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.moderation_status <> 'pending' and not public.is_admin() then
      new.moderation_status := 'pending';
    end if;
  elsif new.moderation_status is distinct from old.moderation_status
        and not public.is_admin() then
    raise exception 'Only a moderator can change moderation status';
  end if;

  return new;
end;
$$;

drop trigger if exists installations_guard_moderation on public.installations;
create trigger installations_guard_moderation
  before insert or update on public.installations
  for each row execute function public.guard_moderation_status();

-- ---------------------------------------------------------------------------
-- routes
-- ---------------------------------------------------------------------------

alter table public.routes enable row level security;

create policy routes_read_public on public.routes
  for select using (
    moderation_status = 'approved' or created_by = auth.uid() or public.is_admin()
  );

create policy routes_insert on public.routes
  for insert with check (
    public.is_at_least('contributor') and created_by = auth.uid()
  );

create policy routes_update_own on public.routes
  for update using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());

create policy routes_delete_own on public.routes
  for delete using (created_by = auth.uid() or public.is_admin());

drop trigger if exists routes_guard_moderation on public.routes;
create trigger routes_guard_moderation
  before insert or update on public.routes
  for each row execute function public.guard_moderation_status();

-- ---------------------------------------------------------------------------
-- events — readable by everyone including guests; organizers write their own
-- ---------------------------------------------------------------------------

alter table public.events enable row level security;

create policy events_read_all on public.events
  for select using (true);

create policy events_insert_organizer on public.events
  for insert with check (
    public.is_at_least('organizer') and organizer_id = auth.uid()
  );

create policy events_update_own on public.events
  for update using (organizer_id = auth.uid() or public.is_admin())
  with check (organizer_id = auth.uid() or public.is_admin());

create policy events_delete_own on public.events
  for delete using (organizer_id = auth.uid() or public.is_admin());

/*
 * A virtual event's join link is not public. Column-level privileges keep it
 * out of any client SELECT — including `select *` — so the only way to read it
 * is public.event_join_url(), which checks for a 'going' RSVP first.
 *
 * Column privileges are additive to the table grant, so this revoke has to come
 * after the grants at the bottom of this file to survive a re-run; it is
 * repeated there.
 */
revoke select (virtual_url) on public.events from anon, authenticated;

-- "Featured" is an editorial decision, not something an organizer grants
-- themselves (prompt 57).
create or replace function public.guard_featured_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_trusted_context() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.is_featured and not public.is_admin() then
      new.is_featured := false;
    end if;
  elsif new.is_featured is distinct from old.is_featured and not public.is_admin() then
    raise exception 'Only the Inclusivity Department can feature an event';
  end if;

  return new;
end;
$$;

drop trigger if exists events_guard_featured on public.events;
create trigger events_guard_featured
  before insert or update on public.events
  for each row execute function public.guard_featured_flag();

-- ---------------------------------------------------------------------------
-- third_spaces
-- ---------------------------------------------------------------------------

alter table public.third_spaces enable row level security;

create policy third_spaces_read_all on public.third_spaces
  for select using (true);

create policy third_spaces_insert on public.third_spaces
  for insert with check (
    public.is_at_least('contributor') and created_by = auth.uid()
  );

create policy third_spaces_update_own on public.third_spaces
  for update using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- user_saved — strictly private to its owner
-- ---------------------------------------------------------------------------

alter table public.user_saved enable row level security;

create policy user_saved_own on public.user_saved
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- feedback
--
-- Anyone (including a guest) may file a report. Reading the base table — which
-- carries user_id — is restricted to moderators; everyone else reads the
-- feedback_public view, which does not expose it.
-- ---------------------------------------------------------------------------

alter table public.feedback enable row level security;

create policy feedback_insert_anyone on public.feedback
  for insert with check (
    -- A signed report has to be your own; an anonymous one carries no author.
    (is_anonymous and user_id is null)
    or (not is_anonymous and user_id = auth.uid())
  );

create policy feedback_read_admin on public.feedback
  for select using (public.is_admin());

-- The public projection. security_invoker is off here on purpose: the view is
-- the sanctioned way to read aggregate safety data without author identity.
alter view public.feedback_public set (security_invoker = false);
grant select on public.feedback_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- points & badges — readable by their owner, written only by the RPC
-- ---------------------------------------------------------------------------

alter table public.user_points enable row level security;

create policy user_points_read_own on public.user_points
  for select using (user_id = auth.uid() or public.is_admin());

-- Deliberately no insert/update/delete policy: add_user_points() is
-- security definer and is the only writer.

alter table public.user_badges enable row level security;

create policy user_badges_read_own on public.user_badges
  for select using (user_id = auth.uid() or public.is_admin());

-- No INSERT policy on purpose: a badge you can grant yourself is not a badge.
-- award_badge() is security definer and is the only writer.

-- ---------------------------------------------------------------------------
-- event_rsvps — counts are public, the list of names is not
-- ---------------------------------------------------------------------------

alter table public.event_rsvps enable row level security;

create policy event_rsvps_read on public.event_rsvps
  for select using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.events e
      where e.id = event_id and e.organizer_id = auth.uid()
    )
  );

create policy event_rsvps_write_own on public.event_rsvps
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Attendance counts without exposing who is going.
create view public.event_rsvp_counts
with (security_invoker = false) as
select event_id,
       count(*) filter (where rsvp_status = 'going') as going,
       count(*) filter (where rsvp_status = 'interested') as interested
from public.event_rsvps
group by event_id;

grant select on public.event_rsvp_counts to anon, authenticated;

-- ---------------------------------------------------------------------------
-- community_submissions
-- ---------------------------------------------------------------------------

alter table public.community_submissions enable row level security;

create policy community_submissions_read on public.community_submissions
  for select using (submitted_by = auth.uid() or public.is_admin());

create policy community_submissions_insert on public.community_submissions
  for insert with check (
    public.is_at_least('contributor') and submitted_by = auth.uid()
  );

create policy community_submissions_moderate on public.community_submissions
  for update using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- caches
--
-- The base table is never readable by the client: it holds the answers. The
-- browser reads public.caches_public, which projects them away.
-- ---------------------------------------------------------------------------

alter table public.caches enable row level security;

create policy caches_admin_all on public.caches
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.cache_finds enable row level security;

create policy cache_finds_read_own on public.cache_finds
  for select using (user_id = auth.uid() or public.is_admin());

-- No INSERT policy: log_cache_find() verifies the distance or the answer and
-- is the only writer. A find you can simply declare is not a find.

-- ---------------------------------------------------------------------------
-- courses & enrolments — Grow
-- ---------------------------------------------------------------------------

alter table public.courses enable row level security;

create policy courses_read_all on public.courses
  for select using (true);

create policy courses_admin_write on public.courses
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.enrolments enable row level security;

create policy enrolments_read_own on public.enrolments
  for select using (user_id = auth.uid() or public.is_admin());

-- No INSERT/UPDATE policy: enrol_in_course() and cancel_enrolment() are the
-- only writers, because taking a place has to debit points in the same
-- transaction and neither the balance nor the capacity can be trusted to the
-- client.

-- ---------------------------------------------------------------------------
-- user_journey — private, advanced only through the RPC
-- ---------------------------------------------------------------------------

alter table public.user_journey enable row level security;

create policy user_journey_read_own on public.user_journey
  for select using (user_id = auth.uid() or public.is_admin());

create policy user_journey_insert_own on public.user_journey
  for insert with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Grants
--
-- RLS decides row visibility; these decide table visibility. Guests get read
-- access to the map and calendar, and may file an anonymous safety report.
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated;

grant select on
  public.installations, public.routes, public.events, public.third_spaces
  to anon, authenticated;

-- Write-only: reports go in, nobody but a moderator reads the base table.
-- submit_feedback() is how the client files one and gets the sanitised row back.
grant insert on public.feedback to anon, authenticated;

grant select, insert, update, delete on
  public.user_saved, public.event_rsvps
  to authenticated;

-- DELETE is granted alongside the delete policies above; without both, an
-- organizer deleting their own event silently fails the privilege check.
grant select, insert, update, delete on
  public.installations, public.routes, public.events
  to authenticated;

grant select, insert, update on
  public.third_spaces, public.community_submissions
  to authenticated;

grant select, update on public.users to authenticated;
-- The trigger normally creates this row; the policy exists so signUp's
-- safety-net upsert can also do it when the trigger is absent.
grant insert on public.users to authenticated;
grant select on public.user_points, public.user_journey to authenticated;
grant select on public.user_badges to authenticated;
grant insert on public.user_journey to authenticated;

-- Re-applied after the table grants above, which would otherwise restore
-- column-level read access to the join link.
revoke select (virtual_url) on public.events from anon, authenticated;

grant execute on function public.add_user_points(uuid, integer) to authenticated;
grant execute on function public.advance_journey_stage(uuid, text) to authenticated;
grant execute on function public.approve_submission(uuid, uuid) to authenticated;
grant execute on function public.award_badge(uuid, text) to authenticated;
grant execute on function public.event_join_url(uuid) to authenticated;
grant execute on function public.submit_feedback(uuid, text, text, smallint, text, boolean)
  to anon, authenticated;

-- Night Caches: the sanitised view and the counts are public; the base table
-- (which holds the answers) is granted to nobody.
grant select on public.caches_public, public.cache_find_counts to anon, authenticated;
grant select on public.cache_finds to authenticated;
grant execute on function
  public.log_cache_find(uuid, find_method, double precision, double precision, text)
  to authenticated;

-- Grow: the catalogue and the place counts are public; taking a place is not.
grant select on public.courses, public.enrolment_counts to anon, authenticated;
grant select on public.enrolments to authenticated;
grant execute on function public.enrol_in_course(uuid) to authenticated;
grant execute on function public.cancel_enrolment(uuid) to authenticated;
