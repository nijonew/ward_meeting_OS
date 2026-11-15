-- 106_second_hour_class_cancellations.sql
--
-- Second-hour class cancellations (2026-11-14, the user's own
-- request): "I want to add an option to cancel only the second hour
-- of church meetings. This would mean cancelling ym/yw classes and
-- adult classes. So for example on certain sundays sacrament meeting
-- is held but no second hour classes. Please add this functionality
-- into the cancellation page."
--
-- Two small, additive schema changes:
--
-- 1. `teaching_assignments` gains `cancelled`/`cancellation_note`,
--    the same shape `meetings` and `youth_activities` already use --
--    "shown, not hidden," never a row simply deleted. Needed because
--    this table is sparse (a blank cell just means no row exists yet,
--    per migration 042's own design) -- marking a Sunday's class
--    cancelled, when nothing was ever saved for it, means inserting a
--    brand-new placeholder row with cancelled=true, not just updating
--    one that happens to already exist.
-- 2. `meeting_cancellations` gains `cancel_second_hour_classes`, a
--    new flag alongside the existing `meeting_type_slugs`/
--    `cancel_youth_activities` -- orthogonal to both, so checking it
--    alone (with no meeting type checked) cancels every YM/YW and
--    adult class for the date range while Sacrament Meeting itself
--    runs completely unaffected, exactly the example the user gave.
--
-- Idempotent: safe to re-run.

alter table teaching_assignments add column if not exists cancelled boolean not null default false;
alter table teaching_assignments add column if not exists cancellation_note text;

alter table meeting_cancellations add column if not exists cancel_second_hour_classes boolean not null default false;
