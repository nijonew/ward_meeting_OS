-- 069_youth_activities_2026_backlog.sql
--
-- One-time bulk import of the ward's real 2026 youth activity history
-- into youth_activities, from six per-class calendars the user pasted
-- directly 2026-10-10/11 (Priests, Teachers, Deacons, Gatherers of
-- Light, Messengers of Hope, Builders of Faith -- "2026 Heritage Ward
-- Youth Activity Calendar," one Wednesday row per class per week, plus
-- the three simpler "Combined Activity"/"combined YM"/"combined YW"
-- rotation lists pasted earlier the same day).
--
-- Two separate reconciliation problems surfaced once all six class
-- calendars were in and cross-referenced against each other and
-- against the simpler lists:
--
-- 1. The simpler lists disagreed with the detailed per-class calendars
--    on two dates (March 18 and April 1) -- confirmed, once Teachers
--    and Deacons were in, that the detailed calendars agree with each
--    other and contradict the simpler lists on both.
-- 2. Migration 032 (confirmed run 2026-09-06) had already seeded Sept
--    2026 -- Feb 2027 directly from those same simpler lists, since
--    that was the only data available at the time. Three of those
--    already-seeded rows turn out to disagree with what the detailed
--    calendars say actually happened (2026-09-16, 2026-09-23,
--    2026-10-14 -- see the UPDATE statements below).
--
-- Resolved by the user's own explicit rule (2026-10-10): "the
-- individual class/quorum tables govern in the past. the rotations
-- govern after october of this year." Concretely:
--   - Jan 1 - Oct 31, 2026: the six detailed calendars are the source
--     of truth, including correcting migration 032's own already-run
--     rows where they disagree.
--   - Nov 1, 2026 onward: left completely untouched. Migration 032's
--     rotation-seeded rows for Nov 2026 -- Feb 2027 stand as-is, and
--     the youth_activity_rotations engine continues to govern future
--     occurrences beyond what's already seeded -- even though the six
--     calendars pasted this session also contain tentative Nov/Dec
--     2026 planning, none of that is imported here.
--
-- Combined-activity rows (Combined YM / Combined YW / Combined YM/YW)
-- are cross-validated across every calendar that references the same
-- date -- title and planning_group (which class is responsible for
-- planning it, a free-text column distinct from group_name, the
-- attendee scope) are taken from whichever value the calendars agree
-- on. Two genuine ambiguities, not silently guessed at:
--   - 2026-01-07 Combined YW: all three YW classes independently
--     listed themselves as planning_group for the year's kickoff week
--     (likely each class actually ran its own session despite being
--     tagged "Combined YW") -- left with planning_group null rather
--     than picking one arbitrarily.
--   - Old age-based group codes in the source data (12/13, 14/15,
--     16/17) are resolved to their current names (Gatherers of Light /
--     Messengers of Hope / Builders of Faith respectively) per the
--     permanent rename already recorded in youth-activities-2026-schedule.md.
--
-- "NO ACTIVITY" weeks (Family Week, Pioneer Day, Thanksgiving,
-- Christmas, New Year's Eve, General/Stake/Ward Conference) get no
-- row at all here, matching this app's existing "no row = nothing
-- planned" convention -- see the follow-up activity-cancellation
-- migration for a standing way to mark these without hand-entering a
-- row per class per holiday.
--
-- Built via a small one-off parsing script
-- (scratchpad/youth-activities-2026/parse.js, not committed -- the six
-- raw TSV exports were saved to scratchpad files and cross-referenced
-- mechanically rather than hand-reconciling ~300 rows across six
-- calendars by eye, same reasoning as migration 067's own script).
--
-- Caution: youth_activities.group_name has no CHECK constraint in any
-- tracked migration, but this repo has repeatedly hit undocumented
-- constraints created directly in the Supabase SQL editor (migrations
-- 038/041/063/067/068) -- if this fails with a constraint violation,
-- that's almost certainly what's going on; every group_name value
-- below already matches YOUTH_ACTIVITY_GROUPS' current canonical
-- names, so there's nothing to rename here.
--
-- Idempotent: the UPDATEs always converge to the same end state on a
-- re-run; the INSERTs are guarded by WHERE NOT EXISTS on
-- (activity_date, group_name), matching migration 032's own pattern.
--
-- **First attempt failed in production**: `null value in column
-- "title" of relation "youth_activities" violates not-null
-- constraint`, on the 2026-07-29 Combined YM row (and 20 others like
-- it) -- `youth_activities.title` has always been `not null`
-- (predates this repo's migration history), but a blank/unplanned
-- week in a source calendar legitimately has no title to give it.
-- Every such row's `title` is now the literal placeholder text
-- `(Not yet planned)` instead of `null` -- distinguishable from a real
-- title, and an admin can simply overwrite it once that week's
-- activity is actually decided.

-- Corrections to migration 032's own seed data, where the newly
-- received detailed per-class calendars disagree with the older
-- simple rotation list migration 032 was seeded from.
update youth_activities set title = 'Internet based game', planning_group = 'Deacons' where activity_date = '2026-09-02' and group_name = 'Combined YM';
update youth_activities set title = 'Temple trip', planning_group = 'Builders of Faith' where activity_date = '2026-09-16' and group_name = 'Combined YM/YW';
update youth_activities set title = 'Capture the Flag', planning_group = 'Teachers' where activity_date = '2026-10-21' and group_name = 'Combined YM/YW';
update youth_activities set title = 'Post camp party', planning_group = 'Messengers of Hope' where activity_date = '2026-09-09' and group_name = 'Combined YW';
update youth_activities set title = 'Volleyball', planning_group = 'Gatherers of Light' where activity_date = '2026-09-23' and group_name = 'Combined YW';
update youth_activities set title = 'MTC tour', planning_group = 'Builders of Faith' where activity_date = '2026-10-14' and group_name = 'Combined YW';
update youth_activities set title = 'Ward party/Halloween?', planning_group = 'Messengers of Hope' where activity_date = '2026-10-28' and group_name = 'Combined YW';
-- 2026-10-07 Combined YM: none of the three YM calendars confirm
-- migration 032's seeded "Tour MTC"/Priests for this date (all three
-- show it blank/unplanned) -- left as-is rather than overwritten,
-- since a blank newer source isn't the same as a confirmed conflict.

-- New combined-week activities, Jan-Aug 2026 (not yet seeded by any
-- prior migration -- migration 032 only covered Sept 2026 onward).
insert into youth_activities (activity_date, activity_time, title, group_name, planning_group, location, development_category, status, confirmed)
select v.activity_date::date, '19:00'::time, v.title, v.group_name, v.planning_group, v.location, v.development_category, 'draft', true
from (values
  ('2026-01-07', '(Not yet planned)', 'Combined YM', 'Priests', null, null),
  ('2026-01-07', 'Get to know you and plan activities for the yr', 'Combined YW', null, null, null),
  ('2026-01-14', 'Vision Boards', 'Combined YW', 'Builders of Faith', '700 S. Church', null),
  ('2026-01-21', 'Games and Prizes', 'Combined YM/YW', 'Deacons', '700 S. Church', null),
  ('2026-01-28', 'Making Temple Bags', 'Combined YW', 'Messengers of Hope', '700 S. Church', 'Spiritual'),
  ('2026-02-04', '(Not yet planned)', 'Combined YM', 'Teachers', '700 S. Church', null),
  ('2026-02-11', 'Baptisms Syracuse 7:30', 'Combined YW', null, '700 S. Church', null),
  ('2026-02-18', '(Not yet planned)', 'Combined YM/YW', 'Priests', '700 S. Church', 'Intellectual'),
  ('2026-02-25', 'Heart attack', 'Combined YW', 'Gatherers of Light', '700 S. Church', null),
  ('2026-03-04', 'Weight Lifting??', 'Combined YM', null, '700 S. Church', null),
  ('2026-03-11', 'Slots', 'Combined YW', 'Messengers of Hope', '700 S. Church', null),
  ('2026-03-18', 'Service project', 'Combined YM/YW', 'Builders of Faith', '700 S. Church', null),
  ('2026-03-25', 'Magnets for rooms', 'Combined YW', 'Builders of Faith', '700 S. Church', null),
  ('2026-04-08', 'Girls Camp kickoff', 'Combined YW', null, '700 S. Church', null),
  ('2026-04-15', 'BOM Cake decorating activity', 'Combined YM/YW', 'Teachers', '700 S. Church', null),
  ('2026-04-22', 'Easter Scavenger Hunt', 'Combined YW', 'Gatherers of Light', '700 S. Church', null),
  ('2026-04-29', 'Lake Powell Prep', 'Combined YM', 'Priests', '700 S. Church', null),
  ('2026-05-06', 'Temple trip (Teachers in charge)', 'Combined YM', 'Teachers', '700 S. Church', null),
  ('2026-05-13', 'Nature walk jenson park, ice crm sandwiches', 'Combined YW', 'Builders of Faith', '700 S. Church', null),
  ('2026-05-20', 'Where''s Waldo', 'Combined YM/YW', 'Messengers of Hope', '700 S. Church', null),
  ('2026-05-27', 'Baptisms arrive  6:55', 'Combined YW', 'Messengers of Hope', '700 S. Church', null),
  ('2026-06-03', 'Adams Canyon Hike (Deacons in charge)', 'Combined YM', 'Deacons', '700 S. Church', null),
  ('2026-06-17', 'Swimming', 'Combined YM/YW', 'Gatherers of Light', '700 S. Church', null),
  ('2026-06-24', 'Cultural Day', 'Combined YW', 'Builders of Faith', '700 S. Church', null),
  ('2026-07-08', 'Car Care', 'Combined YW', 'Messengers of Hope', '700 S. Church', null),
  ('2026-07-15', 'Dodgeball', 'Combined YM/YW', 'Deacons', '700 S. Church', null),
  ('2026-07-29', '(Not yet planned)', 'Combined YM', null, null, null),
  ('2026-08-05', 'Grayson activity?', 'Combined YM', null, '700 S. Church', null),
  ('2026-08-12', 'Pool Day/Swimming', 'Combined YW', 'Gatherers of Light', '700 S. Church', null),
  ('2026-08-19', 'Water Kickball', 'Combined YM/YW', 'Priests', '700 S. Church', null),
  ('2026-08-26', 'Seminary Prep', 'Combined YW', 'Builders of Faith', '700 S. Church', null)
) as v(activity_date, title, group_name, planning_group, location, development_category)
where not exists (
  select 1 from youth_activities y
  where y.activity_date = v.activity_date::date and y.group_name = v.group_name
);

-- Individual (non-combined) class weeks, Jan-Oct 2026.
insert into youth_activities (activity_date, activity_time, title, group_name, location, development_category, status, confirmed)
select v.activity_date::date, '19:00'::time, v.title, v.group_name, v.location, v.development_category, 'draft', true
from (values
  ('2026-01-14', '(Not yet planned)', 'Deacons', '700 S. Church', null),
  ('2026-01-14', '(Not yet planned)', 'Priests', '700 S. Church', null),
  ('2026-01-14', '(Not yet planned)', 'Teachers', '700 S. Church', null),
  ('2026-01-28', '(Not yet planned)', 'Deacons', '700 S. Church', null),
  ('2026-01-28', '(Not yet planned)', 'Priests', '700 S. Church', null),
  ('2026-01-28', '(Not yet planned)', 'Teachers', '700 S. Church', null),
  ('2026-02-04', 'History Center', 'Gatherers of Light', '700 S. Church', null),
  ('2026-02-11', '(Not yet planned)', 'Deacons', '700 S. Church', null),
  ('2026-02-11', '(Not yet planned)', 'Priests', '700 S. Church', null),
  ('2026-02-11', '(Not yet planned)', 'Teachers', '700 S. Church', null),
  ('2026-02-25', 'Fishing and cooking over fire', 'Deacons', '700 S. Church', null),
  ('2026-02-25', 'Missionaries church/nates', 'Priests', '700 S. Church', null),
  ('2026-03-04', 'ST. Patricks day craft', 'Builders of Faith', 'Joyce''s house', null),
  ('2026-03-04', 'Movie night', 'Gatherers of Light', '700 S. Church', null),
  ('2026-03-04', 'Sock Hockey', 'Messengers of Hope', '700 S. Church', null),
  ('2026-03-11', 'Night games', 'Deacons', '700 S. Church', null),
  ('2026-03-11', 'Powder Mountain', 'Priests', '700 S. Church', null),
  ('2026-03-11', 'Cookie make and bake competition', 'Teachers', 'Merritt''s house', null),
  ('2026-03-25', 'Tour police station/army base/fire station/car dealership', 'Deacons', '700 S. Church', null),
  ('2026-03-25', 'Bank night', 'Priests', '700 S. Church', null),
  ('2026-03-25', 'home maintenance life skills activity', 'Teachers', '700 S. Church', null),
  ('2026-04-08', 'Wood working', 'Deacons', '700 S. Church', null),
  ('2026-04-08', 'Career Night - Haulin'' Assets', 'Priests', '700 S. Church', null),
  ('2026-04-08', '(Not yet planned)', 'Teachers', '700 S. Church', null),
  ('2026-04-22', 'Farm animal tour', 'Deacons', '700 S. Church', null),
  ('2026-04-22', 'Weber State tour', 'Priests', '700 S. Church', null),
  ('2026-04-22', 'Car Life Skills Activity', 'Teachers', '700 S. Church', null),
  ('2026-04-29', 'Book of Mormon Decorating', 'Builders of Faith', '700 S. Church', null),
  ('2026-04-29', 'Baptisms - Walk-in', 'Gatherers of Light', '700 S. Church', null),
  ('2026-04-29', 'April 30 - attend River''s Play "The Little Mermaid"', 'Messengers of Hope', '700 S. Church', null),
  ('2026-05-06', 'Zeppes and Mother''s day craft', 'Builders of Faith', '700 S. Church', null),
  ('2026-05-06', 'Archery - make a bow', 'Deacons', '700 S. Church', null),
  ('2026-05-06', 'Movie Night and Coloring', 'Gatherers of Light', '700 S. Church', null),
  ('2026-05-06', 'Mother''s Day Tea Party', 'Messengers of Hope', '700 S. Church', null),
  ('2026-05-13', 'Aquatic center', 'Deacons', '700 S. Church', null),
  ('2026-05-13', 'Work tour night-Darin Zaugg?', 'Priests', '700 S. Church', null),
  ('2026-05-13', 'Escape Room. Bro Merritt will look up on AI.', 'Teachers', '700 S. Church', null),
  ('2026-05-27', 'Make Tie dye shirts/hats for camp', 'Deacons', '700 S. Church', null),
  ('2026-05-27', 'Powell planning combined with Teachers', 'Priests', '700 S. Church', null),
  ('2026-05-27', 'Prepare for Lake Powell Trip with the Priests', 'Teachers', '700 S. Church', null),
  ('2026-06-03', '(Not yet planned)', 'Builders of Faith', '700 S. Church', null),
  ('2026-06-03', 'Bike Ride -pizza', 'Gatherers of Light', '700 S. Church', null),
  ('2026-06-03', 'Hike in the morning', 'Messengers of Hope', '700 S. Church', null),
  ('2026-06-10', 'Camp this week', 'Deacons', '700 S. Church', null),
  ('2026-06-10', 'No activities', 'Priests', '700 S. Church', null),
  ('2026-06-10', 'Yard games (cross net, croquet, spike ball, etc.)', 'Teachers', '700 S. Church', null),
  ('2026-06-24', 'Shooting safety', 'Deacons', '700 S. Church', null),
  ('2026-06-24', 'Frisbee golf', 'Priests', '700 S. Church', null),
  ('2026-06-24', 'Float Weber River', 'Teachers', '700 S. Church', null),
  ('2026-07-08', 'Shooting activity?', 'Deacons', '700 S. Church', null),
  ('2026-07-08', 'Kayak Weber', 'Priests', '700 S. Church', null),
  ('2026-07-08', 'Ice blocking', 'Teachers', '700 S. Church', null),
  ('2026-08-05', 'Temple square visitors center', 'Builders of Faith', '700 S. Church', null),
  ('2026-08-05', 'Temple Square Visitors Center', 'Gatherers of Light', '700 S. Church', null),
  ('2026-08-05', 'Temple square visitors center', 'Messengers of Hope', '700 S. Church', null),
  ('2026-08-12', 'Service activity', 'Deacons', '700 S. Church', null),
  ('2026-08-12', 'Rock climbing/Rush Funplex', 'Priests', '700 S. Church', null),
  ('2026-08-12', '(Not yet planned)', 'Teachers', '700 S. Church', null),
  ('2026-08-26', 'Bow and arrow/Wood working?', 'Deacons', '700 S. Church', null),
  ('2026-08-26', 'Oil/tire change night. Mechanical night', 'Priests', '700 S. Church', null),
  ('2026-08-26', '(Not yet planned)', 'Teachers', '700 S. Church', null),
  ('2026-09-02', 'Decorating journals', 'Builders of Faith', '700 S. Church', null),
  ('2026-09-02', 'Planning meeting with class', 'Gatherers of Light', '700 S. Church', null),
  ('2026-09-02', 'Resume/Job Interview', 'Messengers of Hope', '700 S. Church', null),
  ('2026-09-09', 'One match fire challenge', 'Deacons', '700 S. Church', null),
  ('2026-09-09', 'Smoking, bbq, taco, soup night', 'Priests', '700 S. Church', null),
  ('2026-09-09', 'Yard games and smores', 'Teachers', '700 S. Church', null),
  ('2026-09-23', '(Not yet planned)', 'Deacons', '700 S. Church', null),
  ('2026-09-23', 'Gun/Knife safety night', 'Priests', '700 S. Church', null),
  ('2026-09-23', '(Not yet planned)', 'Teachers', '700 S. Church', null),
  ('2026-10-07', 'Make treat , deliver as ministering activity', 'Gatherers of Light', '700 S. Church', null),
  ('2026-10-07', 'Attend Orchestra Concert to support Brynna', 'Messengers of Hope', '700 S. Church', null),
  ('2026-10-14', 'Mountian biking', 'Deacons', '700 S. Church', null),
  ('2026-10-14', 'Religious diversity night, tour other religious churches', 'Priests', '700 S. Church', null),
  ('2026-10-14', '(Not yet planned)', 'Teachers', '700 S. Church', null),
  ('2026-10-28', 'Ward Halloween party', 'Deacons', '700 S. Church', null),
  ('2026-10-28', 'Halloween party???-game night backup plan', 'Priests', '700 S. Church', null),
  ('2026-10-28', '(Not yet planned)', 'Teachers', '700 S. Church', null)
) as v(activity_date, title, group_name, location, development_category)
where not exists (
  select 1 from youth_activities y
  where y.activity_date = v.activity_date::date and y.group_name = v.group_name
);
