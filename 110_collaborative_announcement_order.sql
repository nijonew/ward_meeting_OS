-- 110_collaborative_announcement_order.sql
--
-- Lets a Bishopric Meeting/Ward Council/Youth Council's own Review
-- section drag-reorder the announcements it's showing, same request
-- as migration 109's agenda-items handle (2026-10-31, the user's own
-- words: "Same with announcements").
--
-- Review's own announcements list (getAnnouncementsForMeetingReview,
-- lib/data/meeting-review.ts) has never been a stored membership at
-- all -- it's computed fresh every time by matching each announcement's
-- own `where_announced` field against this meeting type's label, then
-- sorted by event date. There's no existing row per (meeting,
-- announcement) to hang a sort_order on, unlike Sacrament Meeting's own
-- Announcements block (sacrament_announcement_pulls, migration 077),
-- which is a real, explicit pull with a row to reorder.
--
-- This table is a pure per-meeting ORDER OVERRIDE, not a pull/consume
-- mechanism -- membership in the list is still decided entirely by
-- where_announced, same as today; this only remembers the order an
-- admin dragged a given meeting's own matched announcements into.
-- getAnnouncementsForMeetingReview lazily materializes a row here (in
-- the existing schedule-based order) for any matched announcement that
-- doesn't have one yet, the first time it's computed for that meeting
-- -- the same "a blank entry just means nothing's touched it yet"
-- lazy-row convention this app already uses elsewhere (e.g. the
-- second-hour class cancellation placeholder rows). From then on, every
-- currently-shown item already has a row, so the drag handle's own
-- write (writeSortOrder, lib/data/reorder.ts) can rely on its usual
-- UPDATE-only behavior with no bespoke upsert variant needed.
--
-- `on delete cascade` on both FKs means a deleted meeting or a deleted
-- announcement already cleans this table up on its own -- the explicit
-- delete_meeting_cascade line below is redundant with that but matches
-- every other per-meeting table this app has added since migration 054
-- (077, 082, 083, 084 all do the same), so a meeting delete's own
-- documented behavior stays in one place.
--
-- Idempotent: `create table if not exists`, and `create or replace
-- function` for the matching delete_meeting_cascade amendment.

create table if not exists collaborative_announcement_order (
  meeting_id uuid not null references meetings(id) on delete cascade,
  announcement_id uuid not null references announcements(id) on delete cascade,
  sort_order integer not null,
  primary key (meeting_id, announcement_id)
);

alter table collaborative_announcement_order enable row level security;

drop policy if exists "authenticated access" on collaborative_announcement_order;
create policy "authenticated access" on collaborative_announcement_order
  for all to authenticated using (true) with check (true);

-- Amends delete_meeting_cascade (migration 054, last amended by
-- migration 084) to also clean up this new table when a meeting is
-- deleted.
create or replace function delete_meeting_cascade(p_meeting_id uuid)
returns void
language plpgsql
as $$
begin
  update calling_planning set announced_meeting_id = null where announced_meeting_id = p_meeting_id;
  update sacrament_rabnm_planning set announced_meeting_id = null where announced_meeting_id = p_meeting_id;

  delete from collaborative_announcement_order where meeting_id = p_meeting_id;
  delete from calling_planning_meeting_exclusions where meeting_id = p_meeting_id;
  delete from sacrament_announcement_exclusions where meeting_id = p_meeting_id;
  delete from sacrament_rabnm_people where rabnm_id in (select id from sacrament_rabnm where meeting_id = p_meeting_id);
  delete from sacrament_rabnm where meeting_id = p_meeting_id;
  delete from sacrament_visiting_authorities where meeting_id = p_meeting_id;
  delete from sacrament_announcement_pulls where meeting_id = p_meeting_id;
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
