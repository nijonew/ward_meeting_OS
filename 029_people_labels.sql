-- 029_people_labels.sql
--
-- Adds the label fields requested in the "Adding new people" privacy
-- workflow: age group (adult/youth/child) and attendance status
-- (attending/not attending/moved), beyond the existing single `active`
-- boolean. `active` is left exactly as-is -- it's already used
-- elsewhere (rotation eligibility, speaker/accompanist pickers, etc.)
-- to mean "show up in picker lists," and these new fields don't change
-- that meaning.
--
-- Idempotent: safe to re-run.

alter table people add column if not exists age_group text
  check (age_group in ('adult', 'youth', 'child'));

alter table people add column if not exists attendance_status text
  check (attendance_status in ('attending', 'not_attending', 'moved'))
  not null default 'attending';
