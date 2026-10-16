-- 077_announcement_meeting_pulls.sql
--
-- Lets one announcement be pulled into more than one Sacrament Meeting
-- at once, and re-pulled into a brand-new meeting even after already
-- being used in a past one -- the user's own report, 2026-10-15: "it
-- seems like announcements that were announced in a previous meeting
-- are now not an option to announce."
--
-- Root cause: `announcements.meeting_id`/`planned_element_id`
-- (migrations 031/074) are single-value columns -- pulling an
-- announcement into one meeting's Announcements block set them once,
-- and `getPullableAnnouncements()` only ever offered announcements
-- with `meeting_id is null`. Once used anywhere, an announcement was
-- gone from the pool for every future meeting too, permanently --
-- Sacrament Meeting auto-archives within a day or two of its own date,
-- at which point Planning (and its own Remove button) becomes
-- read-only, so there was no practical way back for a genuinely
-- recurring announcement ("Ongoing Event"/"Future - For Planning" are
-- real values on the submission form's own `announcement_type`).
--
-- Fix, per the user's own choice among three options presented in
-- chat (preserve each meeting's own history, and allow true
-- multi-meeting reuse): a real many-to-many join table replaces the
-- single-column link. `announcements.meeting_id`/`planned_element_id`
-- are left in place, untouched, simply unused by the app from here on
-- -- same "harmless but real, left unused" treatment already given to
-- `callings.title_prefix` elsewhere in this app, rather than a
-- same-day column drop that would need its own careful deploy
-- ordering (see migration 058's own "Caution for next time" note on
-- dropping a column slightly ahead of the code that stops reading it).
--
-- No Table Admin entry for this table, matching `sacrament_program_items`/
-- `sacrament_visiting_authorities` (both also pure join/ordering
-- tables with nothing of their own worth editing outside a meeting's
-- Planning view) rather than `sacrament_rabnm`'s own precedent of
-- having one -- this table has no descriptive fields at all, just
-- three ids, and the Planning view's Add/Remove controls already
-- cover everything it needs.
--
-- Idempotent: `create table if not exists`, and `create or replace
-- function` for the matching `delete_meeting_cascade` amendment below
-- (confirmed run, migration 054 -- this table didn't exist yet when
-- that function was first written, so it needs to learn about it now).

create table if not exists sacrament_announcement_pulls (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references announcements(id) on delete cascade,
  meeting_id uuid not null references meetings(id) on delete cascade,
  planned_element_id uuid not null references meeting_planned_elements(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (announcement_id, meeting_id)
);

alter table sacrament_announcement_pulls enable row level security;

drop policy if exists "authenticated access" on sacrament_announcement_pulls;
create policy "authenticated access" on sacrament_announcement_pulls
  for all to authenticated using (true) with check (true);

-- Amends delete_meeting_cascade (migration 054) to also clean up this
-- new table -- otherwise deleting a meeting would leave orphaned
-- sacrament_announcement_pulls rows pointing at a meeting_id that no
-- longer exists (the FK's own ON DELETE CASCADE would eventually
-- catch this too, but this function does every cleanup step
-- explicitly rather than relying on each table's FK behavior, per its
-- own original header comment).
create or replace function delete_meeting_cascade(p_meeting_id uuid)
returns void
language plpgsql
as $$
begin
  update calling_planning set announced_meeting_id = null where announced_meeting_id = p_meeting_id;

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
