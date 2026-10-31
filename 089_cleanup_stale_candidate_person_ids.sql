-- 089_cleanup_stale_candidate_person_ids.sql
--
-- One-time cleanup: strips any person id out of
-- calling_planning.candidate_person_ids that no longer corresponds to
-- a real row in `people`. Root-caused 2026-10-30 from the user's own
-- report: saving a Calling Planning status change produced
-- "Saved. Couldn't update the roster for: Ward Assistant Executive
-- Secretary (insert or update on table "callings" violates foreign
-- key constraint "callings_current_holder_id_fkey")" -- the roster
-- sync (lib/data/calling-planning.ts's syncCallingRosterFromPlanning,
-- added earlier the same day) tried to set that calling's real holder
-- to the row's one narrowed-down candidate, and that candidate's
-- person_id doesn't exist in `people` at all.
--
-- `candidate_person_ids` is a plain `uuid[]` column (migration 044) --
-- Postgres cannot enforce element-wise foreign keys on an array
-- column, so nothing has ever stopped a person referenced there from
-- being deleted later, leaving a silently dangling id behind. This had
-- no real consequence before today (the array was purely informational
-- until this session's own roster-sync feature started actually
-- *using* its one narrowed-down value to write to a real,
-- FK-enforced column) -- it's a latent gap in old data, not something
-- introduced today.
--
-- The UI itself (MultiPersonSelect.tsx) had no way to see or remove a
-- stale entry like this either -- it only ever rendered a chip for an
-- id it could resolve to a real person, so a dangling id was
-- completely invisible. That's fixed in the same commit as this
-- migration (a stale id now renders as a removable "(missing person
-- record)" chip), so this one-time cleanup won't need repeating by
-- hand if it ever happens again -- an admin can just remove the ghost
-- chip and save.
--
-- Idempotent -- re-running finds nothing left to strip.

update calling_planning
set candidate_person_ids = (
  select coalesce(array_agg(pid), '{}')
  from unnest(candidate_person_ids) as pid
  where pid in (select id from people)
)
where candidate_person_ids is not null
  and exists (
    select 1 from unnest(candidate_person_ids) as pid
    where pid not in (select id from people)
  );
