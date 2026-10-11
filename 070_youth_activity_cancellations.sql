-- 070_youth_activity_cancellations.sql
--
-- "We probably also need an activity cancellation page much like the
-- meeting cancellation page" (the user's own words, 2026-10-10, right
-- after confirming how the youth-activities-2026 backlog import
-- should handle holiday weeks). meeting_cancellations (migration 039)
-- already has a cancel_youth_activities flag, but that's tied to a
-- meeting-cancelling *reason* (General Conference, Stake Conference)
-- -- most of the real youth-activity-only holiday weeks seen in the
-- 2026 backlog (Family Week, Pioneer Day, Thanksgiving, Christmas,
-- New Year's Eve) don't cancel any ward meeting at all, so bundling
-- them into that table would mean rows with an empty
-- meeting_type_slugs purely to carry a youth-activity-only reason --
-- the wrong shape for what those actually are.
--
-- Same design as meeting_cancellations, scoped to activities instead:
-- a date range, a reason, and an admin-chosen list of which youth
-- groups it cancels -- empty means every group (the common case: a
-- holiday week cancels activities for all six classes/quorums and
-- every combined grouping alike). group_names is plain text[], not a
-- foreign key list, matching YOUTH_ACTIVITY_GROUPS' own plain-text
-- values (lib/data/youth-activity-constants.ts) -- same reasoning
-- meeting_cancellations.meeting_type_slugs already established for
-- its own column.
--
-- Idempotent: safe to re-run.

create table if not exists youth_activity_cancellations (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date not null,
  reason text not null,
  group_names text[] not null default '{}',
  created_at timestamp with time zone not null default now()
);

alter table youth_activity_cancellations enable row level security;

drop policy if exists "authenticated read youth_activity_cancellations" on youth_activity_cancellations;
create policy "authenticated read youth_activity_cancellations"
  on youth_activity_cancellations for select
  to authenticated
  using (true);

drop policy if exists "authenticated write youth_activity_cancellations" on youth_activity_cancellations;
create policy "authenticated write youth_activity_cancellations"
  on youth_activity_cancellations for all
  to authenticated
  using (true)
  with check (true);
