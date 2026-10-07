-- 062_meetings_with_real_activity_function.sql
--
-- Performance fix for the dashboard's lazy auto-archive sweep (the
-- user's own report: "the app is extremely slow"). getUpcomingMeetings()
-- (lib/data/meetings.ts) runs this sweep on every single /dashboard and
-- /calling-planning load -- the two most-visited admin pages -- and the
-- old TypeScript version checked each past, not-yet-archived meeting
-- against 9 separate tables ONE AT A TIME, sequentially, in a loop:
-- up to 9 network round trips per meeting, times however many past
-- meetings haven't been archived yet. A meeting with genuinely no
-- activity (the common case for a type where notes/minutes aren't
-- always filled in) never gets skipped on a later load either -- it
-- gets re-checked, in full, every single time, forever, so this only
-- gets worse as more unarchived meetings accumulate week over week.
--
-- This function does the same check -- "does any of these 9 tables
-- have a row for this meeting" -- entirely inside Postgres, for every
-- candidate meeting at once, in one round trip from the app instead of
-- up to 9 × N. `security invoker` matches every other custom function
-- in this app (025, 054) -- runs with the calling user's own
-- RLS-governed privileges, nothing elevated.
--
-- Idempotent: safe to re-run.

drop function if exists meetings_with_real_activity(uuid[]);

create function meetings_with_real_activity(p_meeting_ids uuid[])
returns table(meeting_id uuid)
language sql
stable
security invoker
as $$
  select distinct meeting_id from (
    select meeting_id from meeting_element_notes where meeting_id = any(p_meeting_ids)
    union
    select meeting_id from sacrament_music where meeting_id = any(p_meeting_ids)
    union
    select meeting_id from sacrament_speakers_adults where meeting_id = any(p_meeting_ids)
    union
    select meeting_id from sacrament_speakers_youth where meeting_id = any(p_meeting_ids)
    union
    select meeting_id from sacrament_rabnm where meeting_id = any(p_meeting_ids)
    union
    select meeting_id from agenda_items where meeting_id = any(p_meeting_ids)
    union
    select meeting_id from meeting_action_items where meeting_id = any(p_meeting_ids)
    union
    select meeting_id from council_notes where meeting_id = any(p_meeting_ids)
    union
    select meeting_id from bishopric_minutes where meeting_id = any(p_meeting_ids)
  ) combined;
$$;
