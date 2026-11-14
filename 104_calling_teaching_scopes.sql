-- 104_calling_teaching_scopes.sql
--
-- New calling-based permission to enter/edit a class's teaching
-- schedule (Teacher/Topic on YM/YW Teaching Planning and Elders
-- Quorum/Relief Society Teaching Planning), replacing the blanket
-- `youth_teaching_planning`/`adult_teaching_planning` feature-only
-- gate with 12 granular checkboxes a calling can hold, one per scope
-- -- the user's own request (2026-11-14): "I want to permit certain
-- callings to enter teaching schedules. So a calling will have the
-- option to assign teachers for all youth, all YW, all YM, specific
-- classes already in the dropdown, relief society, elders quorum,
-- any/all. These should be checkboxes. Teachers will then be plugged
-- in by these people."
--
-- Pure additive catalog rows -- no schema change to `calling_features`
-- itself needed, since `feature_key` has no CHECK constraint
-- restricting its values (this app's own documented principle after
-- one too many undocumented-CHECK-constraint incidents: the `Feature`
-- union in lib/supabase/get-session-user.ts is the real source of
-- truth, not a DB-side list). Assigned per calling via the existing
-- Calling Features checklist (/admin/calling-features) -- no new admin
-- page needed, just a new "Teaching Schedules" category there.
--
-- idempotent: safe to re-run.

insert into features (key, label, category, sort_order) values
  ('teaching_schedule_all', 'All Classes (Youth, Elders Quorum & Relief Society)', 'Teaching Schedules', 1),
  ('teaching_schedule_all_youth', 'All Youth Classes (YM & YW)', 'Teaching Schedules', 2),
  ('teaching_schedule_all_ym', 'All Young Men Classes', 'Teaching Schedules', 3),
  ('teaching_schedule_all_yw', 'All Young Women Classes', 'Teaching Schedules', 4),
  ('teaching_schedule_deacons', 'Deacons', 'Teaching Schedules', 5),
  ('teaching_schedule_teachers', 'Teachers', 'Teaching Schedules', 6),
  ('teaching_schedule_priests', 'Priests', 'Teaching Schedules', 7),
  ('teaching_schedule_gatherers_of_light', 'Gatherers of Light', 'Teaching Schedules', 8),
  ('teaching_schedule_messengers_of_hope', 'Messengers of Hope', 'Teaching Schedules', 9),
  ('teaching_schedule_builders_of_faith', 'Builders of Faith', 'Teaching Schedules', 10),
  ('teaching_schedule_elders_quorum', 'Elders Quorum', 'Teaching Schedules', 11),
  ('teaching_schedule_relief_society', 'Relief Society', 'Teaching Schedules', 12)
on conflict (key) do nothing;

-- One-time, lossless carry-over for the adult side only: every calling
-- that currently holds `adult_teaching_planning` has always seen BOTH
-- Elders Quorum and Relief Society unconditionally (that page never
-- had a per-class split before this) -- granting both new scopes here
-- is an exact equivalent, not a guess, so nobody currently using that
-- page loses access the moment this ships. Must run before the delete
-- below, which would otherwise cascade these source rows away first.
insert into calling_features (calling_id, feature_key)
select calling_id, 'teaching_schedule_elders_quorum'
from calling_features
where feature_key = 'adult_teaching_planning'
on conflict (calling_id, feature_key) do nothing;

insert into calling_features (calling_id, feature_key)
select calling_id, 'teaching_schedule_relief_society'
from calling_features
where feature_key = 'adult_teaching_planning'
on conflict (calling_id, feature_key) do nothing;

-- The youth side is deliberately NOT auto-migrated the same way --
-- `youth_teaching_planning` was only ever a blanket "can you try" gate;
-- the real per-class restriction has always come from the separate
-- `youth_class_teachers` table (one row per person + class), which
-- keeps working completely unchanged and is NOT retired by this
-- migration (see lib/data/teaching-assignments.ts). Since different
-- people holding the same calling may have been assigned different
-- individual classes under that table, there's no safe single
-- calling-level scope to infer from the old blanket feature alone --
-- dropping the feature requirement in application code needs no data
-- migration at all here, since every existing teacher's own
-- youth_class_teachers row keeps granting them access with zero gap.
-- A calling-level "all youth"/"all YM"/"all YW"/per-class scope is a
-- genuinely new, additive way to grant access going forward.

-- Both superseded blanket features are dropped outright -- after this
-- ships, nothing in the app checks either one any more (see
-- lib/data/teaching-assignments.ts, app/youth-teaching-planning/page.tsx,
-- app/adult-teaching-planning/page.tsx, lib/data/nav-sections.ts), so
-- leaving them checkable on /admin/calling-features would silently do
-- nothing and mislead whoever checks them -- same reasoning as
-- migration 061's identical cleanup of two features that had nothing
-- real left attached to them. `calling_features.feature_key`
-- references `features(key) on delete cascade`, so this also removes
-- every existing grant of either -- already carried over for the
-- adult side above before this delete runs.
delete from features where key in ('youth_teaching_planning', 'adult_teaching_planning');
