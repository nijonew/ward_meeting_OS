-- 073_master_schedule_rotation_import.sql
--
-- "Please migrate this data into rotations" (the user's own request,
-- 2026-10-11, pasting the ward's real "2026 Syracuse Heritage Ward -
-- Master Meeting Schedule & Assignments," 52 weeks, Dec 28 2025 --
-- Dec 27 2026). Covers the 10 columns that map directly onto this
-- app's existing generic rotations (`rotations`/`rotation_members`,
-- migration 034's own 10 rows -- opening prayer/closing prayer/
-- spiritual thought/handbook training across Bishopric Meeting/Ward
-- Council/Youth Council): Bishopric ST/Hdbk/OP/CP, WC OP/CP/ST, WYC
-- OP/Thought/CP.
--
-- Member order for each rotation was derived from the real sequence in
-- the pasted data (a small one-off script, scratchpad/rotations-import/
-- parse.js, not committed -- same reasoning as every other bulk-import
-- script this session) -- the first several months of every column
-- show a perfectly clean repeating cycle with zero deviation, and the
-- handful of later gaps all land exactly on General Conference/Stake
-- Conference weeks (where Bishopric Meeting/Ward Council/Youth Council
-- plausibly didn't meet) or a one-off Tuesday duplicate (7/19 and
-- 7/21/2026 show identical assignments across every column) -- real,
-- explainable gaps, not cycle breaks. `next_index` is derived from
-- each rotation's own LAST real assignment (12/27/2026 for the weekly
-- Bishopric Meeting rotations, 12/20/2026 for the monthly Ward
-- Council/Youth Council ones), not a naive occurrence count, so it's
-- correct regardless of how many meetings were actually skipped along
-- the way.
--
-- **Caution, read before running**: the spreadsheet gives informal
-- names ("Bro Nemrow," "Pres Smith," "Bishop Newbold") for the
-- Bishopric Meeting/Ward Council columns -- these can't exact-match
-- `people.name` (presumably real full names), so this migration
-- resolves them by SURNAME via `ilike '%Surname%'`, only when exactly
-- one `people` row matches (an ambiguous or zero match silently omits
-- that member rather than guessing wrong -- add them to
-- `rotation_members` by hand afterward once you know who they are).
-- That's still a real collision risk: the Youth Council columns give
-- full names instead (Kevin Bott, Naomi Smith, Emery Young), and at
-- least three of those SHARE A SURNAME with a Bishopric/Ward Council
-- adult (Bott, Smith, Young) -- almost certainly a parent/child
-- relationship, not the same person. Youth Council names are matched
-- exactly (case-insensitive, no wildcard) for exactly this reason;
-- only the Bishopric Meeting/Ward Council informal names use
-- surname-only matching.
--
-- **Run this verification query FIRST, on its own, and check every
-- row resolves to the person you actually expect** before running the
-- rest of this file:
--
-- select surname, (select string_agg(name, ', ') from people where name ilike '%' || surname || '%') as matches
-- from (values ('Nemrow'),('Newbold'),('Bott'),('Young'),('Anderson'),
--   ('VanderStappen'),('Hardman'),('Zaugg'),('Smith'),('Millgate'),
--   ('Merkling'),('Rawlin')) as v(surname);
--
-- Idempotent: safe to re-run (replaces each rotation's whole member
-- list rather than appending).

-- ===== Bishopric Meeting: opening_prayer =====
delete from rotation_members where rotation_id = (
  select r.id from rotations r join meeting_types mt on mt.id = r.meeting_type_id
  where mt.slug = 'bishopric-meeting' and r.element_key = 'opening_prayer'
);
insert into rotation_members (rotation_id, person_id, sort_order)
select (select r.id from rotations r join meeting_types mt on mt.id = r.meeting_type_id where mt.slug = 'bishopric-meeting' and r.element_key = 'opening_prayer'),
  v.person_id, v.sort_order
from (values
  (0, (select id from people where name ilike '%Nemrow%' and (select count(*) from people where name ilike '%Nemrow%') = 1)),
  (1, (select id from people where name ilike '%Young%' and (select count(*) from people where name ilike '%Young%') = 1)),
  (2, (select id from people where name ilike '%Anderson%' and (select count(*) from people where name ilike '%Anderson%') = 1)),
  (3, (select id from people where name ilike '%Newbold%' and (select count(*) from people where name ilike '%Newbold%') = 1)),
  (4, (select id from people where name ilike '%Bott%' and (select count(*) from people where name ilike '%Bott%') = 1))
) as v(sort_order, person_id)
where v.person_id is not null;
update rotations set next_index = 3 where id = (
  select r.id from rotations r join meeting_types mt on mt.id = r.meeting_type_id
  where mt.slug = 'bishopric-meeting' and r.element_key = 'opening_prayer'
);

-- ===== Bishopric Meeting: closing_prayer =====
delete from rotation_members where rotation_id = (
  select r.id from rotations r join meeting_types mt on mt.id = r.meeting_type_id
  where mt.slug = 'bishopric-meeting' and r.element_key = 'closing_prayer'
);
insert into rotation_members (rotation_id, person_id, sort_order)
select (select r.id from rotations r join meeting_types mt on mt.id = r.meeting_type_id where mt.slug = 'bishopric-meeting' and r.element_key = 'closing_prayer'),
  v.person_id, v.sort_order
from (values
  (0, (select id from people where name ilike '%Young%' and (select count(*) from people where name ilike '%Young%') = 1)),
  (1, (select id from people where name ilike '%Anderson%' and (select count(*) from people where name ilike '%Anderson%') = 1)),
  (2, (select id from people where name ilike '%Newbold%' and (select count(*) from people where name ilike '%Newbold%') = 1)),
  (3, (select id from people where name ilike '%Bott%' and (select count(*) from people where name ilike '%Bott%') = 1)),
  (4, (select id from people where name ilike '%Nemrow%' and (select count(*) from people where name ilike '%Nemrow%') = 1))
) as v(sort_order, person_id)
where v.person_id is not null;
update rotations set next_index = 3 where id = (
  select r.id from rotations r join meeting_types mt on mt.id = r.meeting_type_id
  where mt.slug = 'bishopric-meeting' and r.element_key = 'closing_prayer'
);

-- ===== Bishopric Meeting: spiritual_thought =====
delete from rotation_members where rotation_id = (
  select r.id from rotations r join meeting_types mt on mt.id = r.meeting_type_id
  where mt.slug = 'bishopric-meeting' and r.element_key = 'spiritual_thought'
);
insert into rotation_members (rotation_id, person_id, sort_order)
select (select r.id from rotations r join meeting_types mt on mt.id = r.meeting_type_id where mt.slug = 'bishopric-meeting' and r.element_key = 'spiritual_thought'),
  v.person_id, v.sort_order
from (values
  (0, (select id from people where name ilike '%Newbold%' and (select count(*) from people where name ilike '%Newbold%') = 1)),
  (1, (select id from people where name ilike '%Bott%' and (select count(*) from people where name ilike '%Bott%') = 1)),
  (2, (select id from people where name ilike '%Nemrow%' and (select count(*) from people where name ilike '%Nemrow%') = 1)),
  (3, (select id from people where name ilike '%Young%' and (select count(*) from people where name ilike '%Young%') = 1)),
  (4, (select id from people where name ilike '%Anderson%' and (select count(*) from people where name ilike '%Anderson%') = 1))
) as v(sort_order, person_id)
where v.person_id is not null;
update rotations set next_index = 3 where id = (
  select r.id from rotations r join meeting_types mt on mt.id = r.meeting_type_id
  where mt.slug = 'bishopric-meeting' and r.element_key = 'spiritual_thought'
);

-- ===== Bishopric Meeting: handbook_training =====
delete from rotation_members where rotation_id = (
  select r.id from rotations r join meeting_types mt on mt.id = r.meeting_type_id
  where mt.slug = 'bishopric-meeting' and r.element_key = 'handbook_training'
);
insert into rotation_members (rotation_id, person_id, sort_order)
select (select r.id from rotations r join meeting_types mt on mt.id = r.meeting_type_id where mt.slug = 'bishopric-meeting' and r.element_key = 'handbook_training'),
  v.person_id, v.sort_order
from (values
  (0, (select id from people where name ilike '%Bott%' and (select count(*) from people where name ilike '%Bott%') = 1)),
  (1, (select id from people where name ilike '%Nemrow%' and (select count(*) from people where name ilike '%Nemrow%') = 1)),
  (2, (select id from people where name ilike '%Young%' and (select count(*) from people where name ilike '%Young%') = 1)),
  (3, (select id from people where name ilike '%Anderson%' and (select count(*) from people where name ilike '%Anderson%') = 1)),
  (4, (select id from people where name ilike '%Newbold%' and (select count(*) from people where name ilike '%Newbold%') = 1))
) as v(sort_order, person_id)
where v.person_id is not null;
update rotations set next_index = 3 where id = (
  select r.id from rotations r join meeting_types mt on mt.id = r.meeting_type_id
  where mt.slug = 'bishopric-meeting' and r.element_key = 'handbook_training'
);

-- ===== Ward Council: opening_prayer =====
delete from rotation_members where rotation_id = (
  select r.id from rotations r join meeting_types mt on mt.id = r.meeting_type_id
  where mt.slug = 'ward-council' and r.element_key = 'opening_prayer'
);
insert into rotation_members (rotation_id, person_id, sort_order)
select (select r.id from rotations r join meeting_types mt on mt.id = r.meeting_type_id where mt.slug = 'ward-council' and r.element_key = 'opening_prayer'),
  v.person_id, v.sort_order
from (values
  (0, (select id from people where name ilike '%VanderStappen%' and (select count(*) from people where name ilike '%VanderStappen%') = 1)),
  (1, (select id from people where name ilike '%Hardman%' and (select count(*) from people where name ilike '%Hardman%') = 1)),
  (2, (select id from people where name ilike '%Zaugg%' and (select count(*) from people where name ilike '%Zaugg%') = 1)),
  (3, (select id from people where name ilike '%Smith%' and (select count(*) from people where name ilike '%Smith%') = 1)),
  (4, (select id from people where name ilike '%Millgate%' and (select count(*) from people where name ilike '%Millgate%') = 1)),
  (5, (select id from people where name ilike '%Merkling%' and (select count(*) from people where name ilike '%Merkling%') = 1)),
  (6, (select id from people where name ilike '%Rawlin%' and (select count(*) from people where name ilike '%Rawlin%') = 1))
) as v(sort_order, person_id)
where v.person_id is not null;
update rotations set next_index = 3 where id = (
  select r.id from rotations r join meeting_types mt on mt.id = r.meeting_type_id
  where mt.slug = 'ward-council' and r.element_key = 'opening_prayer'
);

-- ===== Ward Council: closing_prayer =====
delete from rotation_members where rotation_id = (
  select r.id from rotations r join meeting_types mt on mt.id = r.meeting_type_id
  where mt.slug = 'ward-council' and r.element_key = 'closing_prayer'
);
insert into rotation_members (rotation_id, person_id, sort_order)
select (select r.id from rotations r join meeting_types mt on mt.id = r.meeting_type_id where mt.slug = 'ward-council' and r.element_key = 'closing_prayer'),
  v.person_id, v.sort_order
from (values
  (0, (select id from people where name ilike '%Hardman%' and (select count(*) from people where name ilike '%Hardman%') = 1)),
  (1, (select id from people where name ilike '%Zaugg%' and (select count(*) from people where name ilike '%Zaugg%') = 1)),
  (2, (select id from people where name ilike '%Smith%' and (select count(*) from people where name ilike '%Smith%') = 1)),
  (3, (select id from people where name ilike '%Millgate%' and (select count(*) from people where name ilike '%Millgate%') = 1)),
  (4, (select id from people where name ilike '%Merkling%' and (select count(*) from people where name ilike '%Merkling%') = 1)),
  (5, (select id from people where name ilike '%Rawlin%' and (select count(*) from people where name ilike '%Rawlin%') = 1)),
  (6, (select id from people where name ilike '%VanderStappen%' and (select count(*) from people where name ilike '%VanderStappen%') = 1))
) as v(sort_order, person_id)
where v.person_id is not null;
update rotations set next_index = 3 where id = (
  select r.id from rotations r join meeting_types mt on mt.id = r.meeting_type_id
  where mt.slug = 'ward-council' and r.element_key = 'closing_prayer'
);

-- ===== Ward Council: spiritual_thought =====
delete from rotation_members where rotation_id = (
  select r.id from rotations r join meeting_types mt on mt.id = r.meeting_type_id
  where mt.slug = 'ward-council' and r.element_key = 'spiritual_thought'
);
insert into rotation_members (rotation_id, person_id, sort_order)
select (select r.id from rotations r join meeting_types mt on mt.id = r.meeting_type_id where mt.slug = 'ward-council' and r.element_key = 'spiritual_thought'),
  v.person_id, v.sort_order
from (values
  (0, (select id from people where name ilike '%Zaugg%' and (select count(*) from people where name ilike '%Zaugg%') = 1)),
  (1, (select id from people where name ilike '%Smith%' and (select count(*) from people where name ilike '%Smith%') = 1)),
  (2, (select id from people where name ilike '%Millgate%' and (select count(*) from people where name ilike '%Millgate%') = 1)),
  (3, (select id from people where name ilike '%Merkling%' and (select count(*) from people where name ilike '%Merkling%') = 1)),
  (4, (select id from people where name ilike '%Rawlin%' and (select count(*) from people where name ilike '%Rawlin%') = 1)),
  (5, (select id from people where name ilike '%VanderStappen%' and (select count(*) from people where name ilike '%VanderStappen%') = 1)),
  (6, (select id from people where name ilike '%Hardman%' and (select count(*) from people where name ilike '%Hardman%') = 1))
) as v(sort_order, person_id)
where v.person_id is not null;
update rotations set next_index = 3 where id = (
  select r.id from rotations r join meeting_types mt on mt.id = r.meeting_type_id
  where mt.slug = 'ward-council' and r.element_key = 'spiritual_thought'
);

-- ===== Youth Council: opening_prayer =====
delete from rotation_members where rotation_id = (
  select r.id from rotations r join meeting_types mt on mt.id = r.meeting_type_id
  where mt.slug = 'youth-council' and r.element_key = 'opening_prayer'
);
insert into rotation_members (rotation_id, person_id, sort_order)
select (select r.id from rotations r join meeting_types mt on mt.id = r.meeting_type_id where mt.slug = 'youth-council' and r.element_key = 'opening_prayer'),
  v.person_id, v.sort_order
from (values
  (0, (select id from people where name ilike '%Newbold%' and (select count(*) from people where name ilike '%Newbold%') = 1)),
  (1, (select id from people where name ilike '%Millgate%' and (select count(*) from people where name ilike '%Millgate%') = 1)),
  (2, (select id from people where name ilike 'Kevin Bott')),
  (3, (select id from people where name ilike 'Preston Merrit')),
  (4, (select id from people where name ilike 'Dalton Griffin')),
  (5, (select id from people where name ilike 'Naomi Smith')),
  (6, (select id from people where name ilike 'River Hull')),
  (7, (select id from people where name ilike 'Emery Young'))
) as v(sort_order, person_id)
where v.person_id is not null;
update rotations set next_index = 5 where id = (
  select r.id from rotations r join meeting_types mt on mt.id = r.meeting_type_id
  where mt.slug = 'youth-council' and r.element_key = 'opening_prayer'
);

-- ===== Youth Council: closing_prayer =====
delete from rotation_members where rotation_id = (
  select r.id from rotations r join meeting_types mt on mt.id = r.meeting_type_id
  where mt.slug = 'youth-council' and r.element_key = 'closing_prayer'
);
insert into rotation_members (rotation_id, person_id, sort_order)
select (select r.id from rotations r join meeting_types mt on mt.id = r.meeting_type_id where mt.slug = 'youth-council' and r.element_key = 'closing_prayer'),
  v.person_id, v.sort_order
from (values
  (0, (select id from people where name ilike 'Kevin Bott')),
  (1, (select id from people where name ilike 'Preston Merrit')),
  (2, (select id from people where name ilike 'Dalton Griffin')),
  (3, (select id from people where name ilike 'Naomi Smith')),
  (4, (select id from people where name ilike 'River Hull')),
  (5, (select id from people where name ilike 'Emery Young')),
  (6, (select id from people where name ilike '%Newbold%' and (select count(*) from people where name ilike '%Newbold%') = 1)),
  (7, (select id from people where name ilike '%Millgate%' and (select count(*) from people where name ilike '%Millgate%') = 1))
) as v(sort_order, person_id)
where v.person_id is not null;
update rotations set next_index = 5 where id = (
  select r.id from rotations r join meeting_types mt on mt.id = r.meeting_type_id
  where mt.slug = 'youth-council' and r.element_key = 'closing_prayer'
);

-- ===== Youth Council: spiritual_thought =====
delete from rotation_members where rotation_id = (
  select r.id from rotations r join meeting_types mt on mt.id = r.meeting_type_id
  where mt.slug = 'youth-council' and r.element_key = 'spiritual_thought'
);
insert into rotation_members (rotation_id, person_id, sort_order)
select (select r.id from rotations r join meeting_types mt on mt.id = r.meeting_type_id where mt.slug = 'youth-council' and r.element_key = 'spiritual_thought'),
  v.person_id, v.sort_order
from (values
  (0, (select id from people where name ilike '%Millgate%' and (select count(*) from people where name ilike '%Millgate%') = 1)),
  (1, (select id from people where name ilike 'Kevin Bott')),
  (2, (select id from people where name ilike 'Preston Merrit')),
  (3, (select id from people where name ilike 'Dalton Griffin')),
  (4, (select id from people where name ilike 'Naomi Smith')),
  (5, (select id from people where name ilike 'River Hull')),
  (6, (select id from people where name ilike 'Emery Young')),
  (7, (select id from people where name ilike '%Newbold%' and (select count(*) from people where name ilike '%Newbold%') = 1))
) as v(sort_order, person_id)
where v.person_id is not null;
update rotations set next_index = 5 where id = (
  select r.id from rotations r join meeting_types mt on mt.id = r.meeting_type_id
  where mt.slug = 'youth-council' and r.element_key = 'spiritual_thought'
);
