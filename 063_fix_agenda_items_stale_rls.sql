-- 063_fix_agenda_items_stale_rls.sql
--
-- Fixes "column c.backup_holder_id does not exist" when deleting a
-- meeting -- the third time this repo has hit an undocumented RLS
-- object created directly in the Supabase SQL editor before this
-- file's migration history started (see migrations 038 and 041 for
-- the first two). Diagnosed 2026-10-07 via a few rounds of the user
-- running diagnostic queries directly, since this assistant has no
-- live database access.
--
-- `agenda_items` had five overlapping policies. Three are stale
-- leftovers from designs this app has already moved past:
--
-- 1. "meeting participants can submit" (INSERT) and "meeting
--    participants can view" (SELECT) both call `is_meeting_participant
--    (meeting_id)`, a function (never tracked in any migration here)
--    that joins to `callings c` and reads `c.backup_holder_id` --
--    dropped from `callings` by migration 034 -- and
--    `(select person_id from profiles where id = auth.uid())`, which
--    doesn't match this app's actual, documented person-link
--    direction (`people.profile_id`, migration 030) at all.
--    `profiles.person_id` does genuinely exist as a column (confirmed
--    live), but nothing in this app's tracked history ever created or
--    populated it -- it's an orphaned artifact of whatever
--    pre-history design this function came from.
-- 2. "public submit pending" (INSERT, anon role) is a leftover from
--    before agenda-item submission required login at all (PROJECT_CONTEXT.md:
--    "Moved behind login and calling-gated, 2026-09-09"). Since
--    `submitAgendaItem` (app/submit/actions.ts) has required a signed-
--    in account ever since, this policy is a real, live gap: an
--    anonymous API call can still insert directly into `agenda_items`
--    with `status = 'pending'`, bypassing the app's own login check
--    entirely. Found and closed incidentally while fixing the delete
--    bug, same as several other gaps this app's history has turned up
--    along the way.
-- 3. "bishopric manage" (ALL) calls `app_role()`, which almost
--    certainly still reads the long-dropped `profiles.role` (migration
--    058). Hasn't visibly errored yet -- likely luck in how Postgres
--    happens to combine it with the other permissive policies below --
--    but it's also simply redundant: `"authenticated access"` already
--    grants `ALL` to any authenticated user unconditionally, matching
--    this app's own established RLS philosophy ("most tables: any
--    authenticated user, app code already gates by role" --
--    PROJECT_CONTEXT.md's own Architecture section). `app_role()`
--    itself is left alone here -- other tables may still reference it,
--    and auditing every one of those is a separate task, not part of
--    this fix.
--
-- `"authenticated access"` (`ALL`, `true`/`true`) is left completely
-- untouched and already covers every legitimate case on this table --
-- every real authorization check (who can submit for which meeting
-- type, who can review submissions) already happens in application
-- code (submitAgendaItem, the /announcements inbox), exactly like
-- every other table in this app.
--
-- Idempotent: safe to re-run.

drop policy if exists "meeting participants can submit" on agenda_items;
drop policy if exists "meeting participants can view" on agenda_items;
drop policy if exists "public submit pending" on agenda_items;
drop policy if exists "bishopric manage" on agenda_items;

drop function if exists is_meeting_participant(uuid);
