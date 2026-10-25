-- 083_announcement_recurrence_and_sacrament_autopull.sql
--
-- Two related changes to Announcements, requested together 2026-10-25:
--
-- 1. A real recurring-schedule shape, so a weekly/monthly class doesn't
--    have to be described with a single start/end date range that
--    reads like a multi-day event (the user's own example: "Weekly
--    Self Reliance Classes Sunday, September 6th at 3:00 PM -- Sunday,
--    November 22nd" looked like it ran every day from Sept 6 to Nov
--    22, not "weekly on Sundays"). `start_date`/`end_date` keep their
--    existing meaning (the series' own first/last occurrence date, end
--    nullable = ongoing) and `start_time`/`end_time` keep theirs (each
--    occurrence's own time) -- only the *cadence* is new. Three shapes,
--    confirmed directly with the user: weekly, monthly on the same
--    weekday ("2nd Tuesday"), monthly on the same date ("the 15th").
--    No CHECK constraint on `recurrence` -- same reasoning as every
--    other admin-facing vocabulary column in this app (`feedback.type`,
--    etc.): `lib/data/announcement-constants.ts`'s
--    `ANNOUNCEMENT_RECURRENCE_TYPES` is the real source of truth, not a
--    DB-side list that has already drifted out of sync and broken a
--    migration more than once in this project's history (migrations
--    038/041/063/067/068/069/075/078).
--
-- 2. "Sacrament Meeting" as a real `where_announced` option, with a
--    genuinely automatic landing in the program -- the user's own
--    words: "I want items with that option selected automatically
--    landing in the Sacrament meeting programs up until the time the
--    announced item has lapsed or occurred." Confirmed with the user:
--    a recurring item should land in EVERY applicable Sacrament
--    Meeting during its active window, not just once. Reuses the
--    existing `sacrament_announcement_pulls` table (migration 077)
--    for the actual link -- the auto-pull sweep
--    (`autoPullSacramentAnnouncements`, lib/data/sacrament-announcements.ts)
--    just creates those same rows automatically instead of requiring a
--    manual pick every week.
--
--    New `sacrament_announcement_exclusions` table: an admin's own
--    manual "Remove" on an auto-pulled announcement (the same Remove
--    button Announcements has always had) needs to actually stick --
--    without recording that, the sweep would just re-add the exact
--    same pull the next time that meeting's Planning page loads, since
--    the announcement would still be "in window." Recording an
--    exclusion lets Remove mean "not in this one meeting," while a
--    manual re-add from the pull dropdown clears the exclusion again
--    (so an admin can always bring it back).
--
-- Idempotent: `add column if not exists`, `create table if not exists`.

alter table announcements add column if not exists recurrence text;
alter table announcements add column if not exists recurrence_day_of_week smallint;
alter table announcements add column if not exists recurrence_nth_occurrence smallint;
alter table announcements add column if not exists recurrence_day_of_month smallint;

create table if not exists sacrament_announcement_exclusions (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references announcements(id) on delete cascade,
  meeting_id uuid not null references meetings(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (announcement_id, meeting_id)
);

alter table sacrament_announcement_exclusions enable row level security;

drop policy if exists "authenticated access" on sacrament_announcement_exclusions;
create policy "authenticated access" on sacrament_announcement_exclusions
  for all to authenticated using (true) with check (true);

-- Amends delete_meeting_cascade (migration 054, last amended by
-- migration 082) to also clean up this new table when a meeting is
-- deleted.
create or replace function delete_meeting_cascade(p_meeting_id uuid)
returns void
language plpgsql
as $$
begin
  update calling_planning set announced_meeting_id = null where announced_meeting_id = p_meeting_id;
  update sacrament_rabnm_planning set announced_meeting_id = null where announced_meeting_id = p_meeting_id;

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
