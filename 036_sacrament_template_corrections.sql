-- 036_sacrament_template_corrections.sql
--
-- Corrects the 4 sacrament_meeting formats migration 033 flagged as
-- unconfirmed (see its own comments and PROJECT_CONTEXT.md), per the
-- user's review (2026-09-06):
--
-- - "For all meetings keep visiting authorities, stake business,
--   closing hymn." -- Primary Program's original best-effort guess had
--   dropped all three; added back here.
-- - Primary Program: leave out Speaker/Youth Speaker/musical numbers
--   (the `intermediate_hymn` slot doubles as the musical-numbers slot
--   in this catalog), include `primary_program` in their place.
--   (Already had this part right -- kept.)
-- - Christmas Meeting / Easter Meeting: same as Standard, but leave out
--   Speaker/Youth Speaker/musical numbers -- "those will be added to
--   the meeting later" (per-meeting, via that meeting's own Agenda
--   Elements page, not as a template default).
-- - Baby Blessing: confirmed identical to Standard as-is (the blessing
--   itself is recorded through the existing Ward Business element, via
--   sacrament_rabnm's `baby_blessing` type) -- no template change
--   needed, nothing to do here.
--
-- Rebuilds each corrected format's element list from scratch (delete +
-- reinsert) rather than patching individual rows, since no meetings
-- have been created against these rare formats yet (nothing to
-- preserve) and it avoids sort_order collision bookkeeping. Idempotent:
-- safe to re-run -- produces the same end state each time.

delete from meeting_templates
where meeting_type_id = (select id from meeting_types where slug = 'sacrament-meeting')
  and format_key in ('primary_program', 'christmas_meeting', 'easter_meeting');

-- PRIMARY_PROGRAM
insert into meeting_templates (meeting_type_id, format_key, element_id, sort_order, slot_count)
select (select id from meeting_types where slug = 'sacrament-meeting'), 'primary_program', me.id, v.sort_order, v.slot_count
from (values
  ('presiding', 10, null::int),
  ('conducting', 20, null),
  ('chorister', 30, null),
  ('organist', 40, null),
  ('pianist', 50, null),
  ('visiting_authorities', 60, null),
  ('announcements', 70, null),
  ('opening_hymn', 80, null),
  ('opening_prayer', 90, null),
  ('recognize_music', 100, null),
  ('ward_business', 110, null),
  ('stake_business', 120, null),
  ('sacrament_hymn', 130, null),
  ('primary_program', 140, null),
  ('closing_hymn', 150, null),
  ('closing_prayer', 160, null)
) as v(key, sort_order, slot_count)
join meeting_elements me on me.key = v.key;

-- CHRISTMAS_MEETING and EASTER_MEETING -- identical to each other:
-- Standard minus Speaker/Youth Speaker/musical numbers.
insert into meeting_templates (meeting_type_id, format_key, element_id, sort_order, slot_count)
select (select id from meeting_types where slug = 'sacrament-meeting'), fmt.format_key, me.id, v.sort_order, v.slot_count
from (values ('christmas_meeting'), ('easter_meeting')) as fmt(format_key)
cross join (values
  ('presiding', 10, null::int),
  ('conducting', 20, null),
  ('chorister', 30, null),
  ('organist', 40, null),
  ('pianist', 50, null),
  ('visiting_authorities', 60, null),
  ('announcements', 70, null),
  ('opening_hymn', 80, null),
  ('opening_prayer', 90, null),
  ('recognize_music', 100, null),
  ('ward_business', 110, null),
  ('stake_business', 120, null),
  ('sacrament_hymn', 130, null),
  ('closing_hymn', 140, null),
  ('closing_prayer', 150, null)
) as v(key, sort_order, slot_count)
join meeting_elements me on me.key = v.key;
