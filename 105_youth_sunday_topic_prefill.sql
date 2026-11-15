-- 105_youth_sunday_topic_prefill.sql
--
-- One-time data sweep, the user's own request (2026-11-14): "pre-fill
-- all youth topics in all classes based on the date with the '(Month)
-- - (Fast/Second/Third/Last) Sunday - FSY Magazine'... This first
-- sweep can skip the priests until May, but the rest need to begin
-- with the pre-fill starting tomorrow. First Sundays are called Fast
-- Sundays. The fourth sundays will be called Last Sunday. Fifth
-- sundays are already filled in and shouldn't be touched."
--
-- "Tomorrow" (2026-11-15) is itself a Sunday -- used below as a
-- literal starting date, not a relative `current_date + 1`, since the
-- whole point of this sweep is each date's own real Sunday-of-the-
-- month alignment, which shouldn't silently shift if this migration
-- happens to be run a day or two late.
--
-- Covers through 2027-05-14 -- the same rolling "today + 6 months"
-- window getTeachingAssignmentGrid (lib/data/teaching-assignments.ts)
-- already defaults every Teaching Planning page to. A later sweep can
-- extend further once this window is close to running out.
--
-- Priests are deliberately excluded from this sweep entirely, per the
-- user's own words -- their own pre-fill starts in May and is a
-- separate, later task, not part of this one.
--
-- 1st Sunday of a month -> "Fast Sunday", 2nd -> "Second Sunday",
-- 3rd -> "Third Sunday", 4th -> "Last Sunday" (literally the 4th
-- occurrence, whether or not that month goes on to have a 5th). 5th
-- Sundays are left completely untouched -- they're already covered by
-- this app's own FIFTH_SUNDAY_TOPIC default ("5th Sunday",
-- lib/data/teaching-assignments.ts), shown live whenever no real row
-- exists yet, so there's nothing for this migration to fill in there.
--
-- Idempotent: only ever fills a class/date's topic when it's currently
-- null or blank -- a second run, or a topic a real teacher has since
-- typed in by hand, is never overwritten.

with sundays as (
  select d::date as class_date
  from generate_series(date '2026-11-15', date '2027-05-14', interval '1 day') as d
  where extract(dow from d) = 0
),
labeled as (
  select
    class_date,
    ((extract(day from class_date)::int - 1) / 7) + 1 as nth,
    trim(to_char(class_date, 'FMMonth')) as month_name
  from sundays
),
topics as (
  select
    class_date,
    month_name || ' - ' ||
    case nth
      when 1 then 'Fast'
      when 2 then 'Second'
      when 3 then 'Third'
      when 4 then 'Last'
    end || ' Sunday - FSY Magazine' as topic
  from labeled
  where nth <> 5
),
classes as (
  select unnest(array[
    'Deacons', 'Teachers', 'Gatherers of Light', 'Messengers of Hope', 'Builders of Faith'
  ]) as class_name
)
insert into teaching_assignments (class_date, class_name, topic)
select t.class_date, c.class_name, t.topic
from topics t
cross join classes c
on conflict (class_date, class_name) do update
  set topic = excluded.topic, updated_at = now()
  where teaching_assignments.topic is null or trim(teaching_assignments.topic) = '';
