-- 107_meetings_date_type_unique.sql
--
-- Closes a real race condition in getOrCreateMeetingId
-- (lib/data/meetings.ts): a plain SELECT-then-INSERT with no
-- database-level guarantee behind it. Two concurrent calls for the
-- same (date, meeting_type_id) -- two admins, or an admin colliding
-- with the auto-generation sweep -- can both pass the SELECT seeing
-- nothing, then both INSERT, producing a genuine duplicate meeting
-- row. Found 2026-11-14 while auditing concurrency pinch points ahead
-- of the app's own first real multi-user rollout. The matching
-- application-code fix (lib/data/meetings.ts) is already live and
-- degrades gracefully whether or not this migration has been run yet
-- -- see that file's own comment on the insert-error branch.
--
-- Guarded, not a bare `alter table ... add constraint` -- if
-- duplicate (date, meeting_type_id) rows already exist in production
-- (a real possibility this app has already hit by hand before --
-- Delete Meeting, migration 054, exists specifically for cleaning up
-- an accidental duplicate), adding a unique constraint directly would
-- fail outright and this migration would error with nothing fixed.
-- Checks first and only adds the constraint when the data is already
-- clean; otherwise leaves everything exactly as it was and says why,
-- rather than failing the whole run.
--
-- Idempotent: safe to re-run.

do $$
begin
  if exists (
    select 1 from meetings
    group by date, meeting_type_id
    having count(*) > 1
  ) then
    raise notice 'meetings has duplicate (date, meeting_type_id) rows -- skipping the unique constraint. Find and resolve the duplicates (Delete Meeting on /dashboard, or Table Admin) and re-run this migration.';
  else
    if not exists (
      select 1 from pg_constraint where conname = 'meetings_date_meeting_type_id_key'
    ) then
      alter table meetings add constraint meetings_date_meeting_type_id_key unique (date, meeting_type_id);
    end if;
  end if;
end $$;
