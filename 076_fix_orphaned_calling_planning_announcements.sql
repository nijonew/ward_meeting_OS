-- 076_fix_orphaned_calling_planning_announcements.sql
--
-- One-time repair for calling_planning rows left permanently stuck by
-- a real, now-fixed bug -- found 2026-10-15 from the user's own
-- detailed report of a calling that "showed up at the bottom of the
-- calling planning page," got pushed to a sacrament meeting, then
-- "didn't show up on the bottom of that page" again after being
-- removed, and could never be re-pushed.
--
-- Root cause: pushCallingToSacramentMeeting (app/calling-planning/
-- actions.ts, the "Ready to Announce" button on /calling-planning
-- itself) has always inserted its sacrament_rabnm row WITHOUT setting
-- calling_planning_id -- unlike pullCallingPlanningIntoMeeting (the
-- Ward Business side's own pull, app/meetings/[id]/ward-business-actions.ts),
-- which always has. Ward Business's own Remove button
-- (WardBusinessField.tsx's ExistingRow) branches on whether that link
-- is set: when it is, it calls removeCallingPlanningFromMeeting, which
-- correctly clears the calling_planning row's announced_meeting_id and
-- resets its status; when it's NOT set -- which was every single row
-- ever pushed from Calling Planning's own page -- it falls back to a
-- bare deleteRabnmItem, which only deletes the sacrament_rabnm row.
-- The calling_planning row is left with announced_meeting_id still
-- pointing at an announcement that no longer exists, and its status
-- never gets reset -- permanently excluded from the "Ready to
-- Announce" list (which requires announced_meeting_id is null) and
-- from ever being pushed again (pushCallingToSacramentMeeting requires
-- status = 'to_announce', which it's stuck away from), with no UI
-- anywhere to clear announced_meeting_id directly (calling_planning is
-- deliberately excluded from Table Admin, and the grid has no column
-- for it).
--
-- The matching code fix (same day) adds calling_planning_id to that
-- insert so this can't happen again going forward -- this migration
-- only repairs rows already stuck from before that fix shipped.
--
-- Finds every calling_planning row whose announced_meeting_id is set
-- but has no sacrament_rabnm row actually referencing it back -- which
-- can only mean it's exactly this kind of orphan, never a real,
-- still-current announcement (a genuine one always has a live
-- sacrament_rabnm.calling_planning_id row pointing back) -- and clears
-- announced_meeting_id. calling_status/release_status are reset back
-- to 'to_announce' ONLY when they're still sitting at the exact values
-- the old auto-advance bug (also fixed 2026-10-13) would have left
-- them at ('to_record'/'complete') -- not a blanket reset, so a row
-- genuinely at some other status for an unrelated reason isn't
-- clobbered.
--
-- Idempotent: a repaired row's announced_meeting_id is null afterward,
-- so it no longer matches this migration's own WHERE clause on re-run.

update calling_planning
set
  announced_meeting_id = null,
  calling_status = case when calling_status = 'to_record' then 'to_announce' else calling_status end,
  release_status = case when release_status = 'complete' then 'to_announce' else release_status end,
  updated_at = now()
where announced_meeting_id is not null
  and not exists (
    select 1 from sacrament_rabnm
    where sacrament_rabnm.calling_planning_id = calling_planning.id
  );
