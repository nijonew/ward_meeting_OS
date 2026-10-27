-- 086_fix_chorister_organist_element_key_casing.sql
--
-- Bug found and fixed 2026-10-27: pushing the Chorister/Organist
-- rotations on /rotations reported a real "Filled N meetings" success
-- message, but a refresh of the Assignment Grid -- and even Table
-- Admin's own raw sacrament_assignments grid -- showed no change at
-- all. The user's own report, confirmed by checking Table Admin's
-- /admin/rotations grid directly: the Chorister/Organist rows' own
-- `element_key` column holds "Chorister"/"Organist" (capitalized),
-- not the lowercase "chorister"/"organist" every other code path in
-- this app uses -- the catalog (ASSIGNMENT_ROLES,
-- lib/data/sacrament-constants.ts), the Assignment Grid's own column
-- keys (GRID_COLUMN_KEYS_BY_TYPE), and every read of
-- sacrament_assignments.role everywhere else.
--
-- Root cause: pushRotationToUpcomingMeetings
-- (lib/data/rotations.ts) writes/deletes sacrament_assignments rows
-- keyed by `rotation.element_key` directly, whatever that literal
-- string happens to be -- it has no reason to assume anything other
-- than that the data matches the app's own lowercase convention.
-- Because these two rows held a capitalized value, the push's own
-- delete step (`.eq("role", "Chorister")`) could never touch the
-- real, already-correct lowercase row, and its insert created a new,
-- orphaned "Chorister"/"Organist" row that nothing else in the app
-- ever reads -- both invisible to the grid and silently leaving the
-- old lowercase assignment in place, which is exactly why the push
-- looked like it did nothing even though it genuinely wrote a row.
--
-- Two-part fix:
-- 1. Corrects the two rotations.element_key values to lowercase, so
--    every future push/read for these two rotations lines up with
--    the rest of the app the same way every other rotation already
--    does.
-- 2. Cleans up the orphaned capitalized-role rows the broken push(es)
--    already created in sacrament_assignments -- dead data nothing
--    reads, left behind by the bug above.
--
-- Scoped to Sacrament Meeting specifically (not a blanket
-- capitalization fix across every rotation) -- this is the one
-- meeting type where Chorister/Organist exist at all.
--
-- Idempotent: both statements are no-ops once the casing is already
-- correct and the orphaned rows are already gone.

update rotations
set element_key = 'chorister'
where element_key = 'Chorister'
  and meeting_type_id = (select id from meeting_types where slug = 'sacrament-meeting');

update rotations
set element_key = 'organist'
where element_key = 'Organist'
  and meeting_type_id = (select id from meeting_types where slug = 'sacrament-meeting');

delete from sacrament_assignments where role in ('Chorister', 'Organist');
