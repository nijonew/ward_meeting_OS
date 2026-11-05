-- 100_teaching_assignments_topic_and_adult_classes.sql
--
-- Youth Teaching Planning rework (2026-11-05, the user's own request):
-- split the old single free-text `entry` column into two real fields,
-- Teacher and Topic, so the grid can show both side by side instead of
-- one combined cell. The same teaching_assignments table/mechanism is
-- also reused, unchanged, for a brand-new Elders Quorum / Relief
-- Society Teaching Planning page -- "Elders Quorum" and "Relief
-- Society" are simply two more class_name values on this same table,
-- rendered on their own page rather than Youth Teaching Planning's
-- per-class hub.
--
-- Idempotent: safe to re-run. The rename is wrapped in a DO block
-- rather than a bare `rename column`, since Postgres has no
-- `rename column if exists` and a second run would otherwise fail
-- once `entry` no longer exists.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'teaching_assignments' and column_name = 'entry'
  ) then
    alter table teaching_assignments rename column entry to teacher_name;
  end if;
end $$;

alter table teaching_assignments add column if not exists topic text;

-- A row can now exist with only one of the two fields filled in (e.g.
-- a topic chosen before a teacher is decided) -- the old `entry text
-- not null` constraint (back when this was a single combined field)
-- would block that.
alter table teaching_assignments alter column teacher_name drop not null;

insert into features (key, label, category, sort_order) values
  ('adult_teaching_planning', 'Elders Quorum / Relief Society Teaching Planning', 'Tools', 16),
  ('table_admin_teaching_assignments', 'Teaching Assignments', 'Table Admin', 25)
on conflict (key) do nothing;
