-- 037_meeting_cancellation.sql
--
-- "Cancel a meeting from the dashboard" (Known open items): a status
-- control separate from the planning-progress `stage` field. Same
-- shape as `youth_activities.cancelled`/`cancellation_note` (migration
-- 032) -- shown, not hidden, per that same precedent -- rather than a
-- new/different design for meetings specifically.
--
-- Idempotent: safe to re-run.

alter table meetings add column if not exists cancelled boolean not null default false;
alter table meetings add column if not exists cancellation_note text;
