-- 054_delete_meeting_cascade.sql
--
-- A "Delete Meeting" action (2026-10-03, the user's own request,
-- distinct from Cancel -- see app/dashboard/actions.ts's own comment
-- on deleteMeeting for the full distinction): "I accidentally added a
-- second sacrament meeting for a date that was already planned. I want
-- to be able to delete that meeting." Deleting a meeting needs to clean
-- up every table that holds data scoped to that one meeting's own
-- `id` -- several of these predate this repo's migration history, so
-- their `meetings` foreign key's own ON DELETE behavior isn't
-- something this file can assume one way or the other (RESTRICT would
-- just make the final delete fail; CASCADE on some but not others
-- would leave an inconsistent mix). Doing every cleanup step
-- explicitly, in one Postgres function, sidesteps needing to know or
-- change any of that: it works regardless of each table's actual FK
-- behavior, and runs as a single atomic unit -- a failure partway
-- through rolls the whole thing back rather than leaving orphaned rows
-- (which a sequence of separate `.delete()` calls from application
-- code couldn't guarantee).
--
-- `calling_planning.announced_meeting_id` is a reference *to* a
-- meeting (recording which meeting a calling/release was pushed to
-- announce in), not a row that belongs to the meeting -- it's set to
-- null rather than deleted, so real calling-planning history is never
-- destroyed just because the meeting it was once announced in gets
-- removed.
--
-- `sacrament_rabnm_people` is a composite-key join table on
-- `sacrament_rabnm.id`, not `meeting_id` directly (see
-- lib/admin/registry.ts's own comment on it) -- cleaned up via a
-- subquery before the `sacrament_rabnm` rows themselves.
--
-- Idempotent by nature (safe to re-run this file -- `create or
-- replace function` always succeeds; calling the function itself on an
-- already-deleted meeting id is a no-op, since every delete/update
-- below simply matches zero rows).

create or replace function delete_meeting_cascade(p_meeting_id uuid)
returns void
language plpgsql
as $$
begin
  update calling_planning set announced_meeting_id = null where announced_meeting_id = p_meeting_id;

  delete from sacrament_rabnm_people where rabnm_id in (select id from sacrament_rabnm where meeting_id = p_meeting_id);
  delete from sacrament_rabnm where meeting_id = p_meeting_id;
  delete from sacrament_visiting_authorities where meeting_id = p_meeting_id;
  delete from sacrament_program_items where meeting_id = p_meeting_id;
  delete from sacrament_speakers_adults where meeting_id = p_meeting_id;
  delete from sacrament_speakers_youth where meeting_id = p_meeting_id;
  delete from sacrament_music where meeting_id = p_meeting_id;
  delete from sacrament_planning where meeting_id = p_meeting_id;
  delete from sacrament_assignments where meeting_id = p_meeting_id;
  delete from bishopric_assignments where meeting_id = p_meeting_id;
  delete from meeting_planned_elements where meeting_id = p_meeting_id;
  delete from meeting_element_notes where meeting_id = p_meeting_id;
  delete from agenda_items where meeting_id = p_meeting_id;
  delete from meeting_action_items where meeting_id = p_meeting_id;
  delete from council_notes where meeting_id = p_meeting_id;
  delete from bishopric_minutes where meeting_id = p_meeting_id;

  delete from meetings where id = p_meeting_id;
end;
$$;
