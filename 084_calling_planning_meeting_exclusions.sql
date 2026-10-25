-- 084_calling_planning_meeting_exclusions.sql
--
-- Bug fix: removing a released (or newly-called) individual from a
-- Sacrament Meeting's own Ward Business didn't actually stick -- the
-- user's own report, 2026-10-25: "I am not able to remove released
-- individuals from sacrament meeting planning."
--
-- Root cause, traced through the code (no live database access to
-- reproduce directly, but the logic is unambiguous): `removeCallingPlanningFromMeeting`
-- (app/meetings/[id]/ward-business-actions.ts) deletes the
-- sacrament_rabnm row and clears calling_planning.announced_meeting_id
-- back to null -- but `autoAnnounceReadyCallingPlanningItems`
-- (lib/data/calling-planning.ts, the lazy sweep that runs on every
-- Sacrament Meeting Planning page load) re-checks "is calling_status/
-- release_status still 'to_announce' AND not yet linked to the single
-- nearest-upcoming meeting" -- which, for the single most common case
-- of all (removing something from the meeting that currently IS the
-- nearest-upcoming one, i.e. the one actually being worked on this
-- week), is exactly true again the instant the link is cleared. The
-- very next page render re-runs the sweep and re-creates the identical
-- row, making Remove look like it does nothing at all.
--
-- Same class of bug as the Announcements auto-pull sweep's own
-- equivalent problem, fixed the same way (migration 083,
-- sacrament_announcement_exclusions): a real exclusion record so a
-- deliberate Remove sticks against the sweep, while a deliberate
-- manual re-add (pullCallingPlanningIntoMeeting or
-- pushCallingToSacramentMeeting) clears it again. `side` distinguishes
-- the Calling and Release halves of one calling_planning row, which
-- can each be independently pulled/removed/re-added -- stores the
-- exact same "new_calling"/"release" values sacrament_rabnm.type
-- already uses, one shared vocabulary rather than a second one that
-- means the same thing.
--
-- No CHECK constraint on `side` -- same reasoning as every other
-- admin-facing vocabulary column in this app's own history; the real
-- values are defined in the TypeScript layer, not duplicated as a
-- DB-side list that has already broken a migration more than once in
-- this project.
--
-- Idempotent: `create table if not exists`.

create table if not exists calling_planning_meeting_exclusions (
  id uuid primary key default gen_random_uuid(),
  calling_planning_id uuid not null references calling_planning(id) on delete cascade,
  meeting_id uuid not null references meetings(id) on delete cascade,
  side text not null,
  created_at timestamptz not null default now(),
  unique (calling_planning_id, meeting_id, side)
);

alter table calling_planning_meeting_exclusions enable row level security;

drop policy if exists "authenticated access" on calling_planning_meeting_exclusions;
create policy "authenticated access" on calling_planning_meeting_exclusions
  for all to authenticated using (true) with check (true);

-- Amends delete_meeting_cascade (migration 054, last amended by
-- migration 083) to also clean up this new table when a meeting is
-- deleted.
create or replace function delete_meeting_cascade(p_meeting_id uuid)
returns void
language plpgsql
as $$
begin
  update calling_planning set announced_meeting_id = null where announced_meeting_id = p_meeting_id;
  update sacrament_rabnm_planning set announced_meeting_id = null where announced_meeting_id = p_meeting_id;

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
