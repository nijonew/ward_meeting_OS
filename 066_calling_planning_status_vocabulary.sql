-- 066_calling_planning_status_vocabulary.sql
--
-- Replaces calling_planning's calling_status/release_status option
-- lists in admin_select_options (originally seeded by migration 022)
-- with the user's own redesigned vocabulary (2026-10-10, given as two
-- explicit ordered lists):
--
--   Calling status: Needed, In review, Approved, Interview Set,
--   Accepted, Declined, To be Announced, To Record, Complete,
--   For Stake, Future, Hold
--
--   Release status: Previously Vacant, To be released, Interview Set,
--   Release Extended, To be Announced, Complete
--
-- Value keys are reused (not renamed) for the six stages real
-- application code branches on by value -- discussing (now labeled
-- "In Review"), to_announce ("To be Announced"), to_record, complete,
-- future, declined, previously_vacant -- see
-- lib/data/calling-planning.ts's own comment on DEFAULT_CALLING_STATUSES/
-- DEFAULT_RELEASE_STATUSES for the full reasoning, and
-- app/calling-planning/actions.ts / app/meetings/[id]/ward-business-actions.ts
-- for the auto-advance logic that depends on to_announce/to_record/
-- complete specifically. "To Be Set Apart" (the old vocabulary's own
-- `to_be_set_apart` value) has no equivalent in the new list and is
-- dropped entirely -- a pre-existing row still holding that raw value
-- (unlikely; this feature has seen light real use) will simply show up
-- unmatched against the dropdown until an admin picks a new status for
-- it, same as any other orphaned free-text value in this column.
--
-- Full delete-then-insert rather than migration 022's `on conflict do
-- nothing` -- that approach was for preserving an admin's own edits
-- across re-runs; this one is a deliberate wholesale replacement, and
-- `on conflict do update` on the second run keeps it idempotent either
-- way (a third run updates nothing further, since the rows would
-- already match).
--
-- Idempotent: safe to re-run.

delete from admin_select_options where field_key = 'calling_planning.calling_status';
delete from admin_select_options where field_key = 'calling_planning.release_status';

insert into admin_select_options (field_key, value, label, sort_order) values
  ('calling_planning.calling_status', 'needed', 'Needed', 0),
  ('calling_planning.calling_status', 'discussing', 'In Review', 1),
  ('calling_planning.calling_status', 'approved', 'Approved', 2),
  ('calling_planning.calling_status', 'interview_set', 'Interview Set', 3),
  ('calling_planning.calling_status', 'accepted', 'Accepted', 4),
  ('calling_planning.calling_status', 'declined', 'Declined', 5),
  ('calling_planning.calling_status', 'to_announce', 'To be Announced', 6),
  ('calling_planning.calling_status', 'to_record', 'To Record', 7),
  ('calling_planning.calling_status', 'complete', 'Complete', 8),
  ('calling_planning.calling_status', 'for_stake', 'For Stake', 9),
  ('calling_planning.calling_status', 'future', 'Future', 10),
  ('calling_planning.calling_status', 'hold', 'Hold', 11),
  ('calling_planning.release_status', 'previously_vacant', 'Previously Vacant', 0),
  ('calling_planning.release_status', 'to_be_released', 'To be Released', 1),
  ('calling_planning.release_status', 'interview_set', 'Interview Set', 2),
  ('calling_planning.release_status', 'release_extended', 'Release Extended', 3),
  ('calling_planning.release_status', 'to_announce', 'To be Announced', 4),
  ('calling_planning.release_status', 'complete', 'Complete', 5)
on conflict (field_key, value) do update set label = excluded.label, sort_order = excluded.sort_order;
