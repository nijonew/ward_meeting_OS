-- 078_collaborative_meeting_sections.sql
--
-- Bishopric Meeting / Ward Council / Youth Council agenda restructure
-- (2026-10-19), the user's own request: "I want them to also have a
-- planning view... with a devotional portion in the beginning (opening
-- prayer, spiritual thought) a section break, a review section
-- (announcements, previous meeting minutes), a discussion section
-- (agenda items and pre-planned topics), and then a closing section
-- (closing prayer)." Section dividers must be genuinely movable, not
-- hardcoded by adjacency the way Sacrament Meeting's own dividers are
-- -- so these are real `meeting_elements` catalog rows
-- (resolution_kind = 'section'), freely reorderable via the existing
-- Agenda Elements editor, same as any other agenda line.
--
-- Also adds the user's named Discussion-section topics: Ward Council
-- gets "Focus on People"; Youth Council gets "Upcoming Combined
-- Activities," "Recent Successful Activities," and "Focus on People"
-- (the same catalog row, shared with Ward Council).
--
-- Also adds `agenda_items.notes` -- each agenda item gets its own
-- inline notes field in the Discussion section, rather than a single
-- notes block at the bottom of the page.
--
-- Idempotent: safe to re-run. Anchors every new row's sort_order
-- relative to the real opening_prayer/spiritual_thought/closing_prayer
-- rows already confirmed to exist for all three types (migrations
-- 034/073), not a hardcoded absolute number -- same `+/-N` convention
-- as migration 046's Sacrament Administered insert. **Not verified
-- against live data** (no database access this session) -- if any of
-- these land out of order once applied, the fix is a follow-up
-- `update meeting_templates set sort_order = ...` by key, not a new
-- migration number.
--
-- **First attempt failed in production** --
-- `new row for relation "meeting_elements" violates check constraint
-- "meeting_elements_resolution_kind_check"` inserting `'section'`.
-- Same class of problem as migrations 038/041/063/067/068/069/075: an
-- undocumented CHECK constraint, created directly in the Supabase SQL
-- editor before this repo's migration history started, hardcoded
-- against whatever `resolution_kind` values existed back then and
-- never updated since. The real, documented set of valid values is
-- `buildAgendaRows`'s switch (`lib/data/agenda-rows.ts`) and
-- `archived/page.tsx`'s matching one -- a DB-side CHECK duplicating
-- that list is exactly what just broke, same reasoning migrations
-- 068/069 already used. File updated to drop it outright, not
-- recreate it against an expanded list.

-- 0. Drop the undocumented resolution_kind CHECK constraint -- see
--    the note above. Not recreated.
alter table meeting_elements drop constraint if exists meeting_elements_resolution_kind_check;

-- 1. New catalog elements.
insert into meeting_elements (key, label, resolution_kind, repeatable, max_slots, sort_order)
select v.key, v.label, 'section', false, null, 0
from (values
  ('devotional_section', 'Devotional'),
  ('review_section', 'Review'),
  ('discussion_section', 'Discussion'),
  ('closing_section', 'Closing')
) as v(key, label)
where not exists (select 1 from meeting_elements where key = v.key);

insert into meeting_elements (key, label, resolution_kind, repeatable, max_slots, sort_order)
select 'focus_on_people', 'Focus on People', 'free_text', false, null, 0
where not exists (select 1 from meeting_elements where key = 'focus_on_people');

insert into meeting_elements (key, label, resolution_kind, repeatable, max_slots, sort_order)
select v.key, v.label, 'free_text', false, null, 0
from (values
  ('upcoming_combined_activities', 'Upcoming Combined Activities'),
  ('recent_successful_activities', 'Recent Successful Activities')
) as v(key, label)
where not exists (select 1 from meeting_elements where key = v.key);

-- 2. meeting_element_types -- which meeting types each new element
--    applies to. The four section dividers apply to all three
--    collaborative types; the three new topics apply only where named.
insert into meeting_element_types (meeting_type_id, element_id)
select mt.id, me.id
from meeting_types mt
join meeting_elements me on me.key in ('devotional_section', 'review_section', 'discussion_section', 'closing_section')
where mt.slug in ('bishopric-meeting', 'ward-council', 'youth-council')
  and not exists (
    select 1 from meeting_element_types met
    where met.meeting_type_id = mt.id and met.element_id = me.id
  );

insert into meeting_element_types (meeting_type_id, element_id)
select mt.id, me.id
from meeting_types mt
join meeting_elements me on me.key = 'focus_on_people'
where mt.slug in ('ward-council', 'youth-council')
  and not exists (
    select 1 from meeting_element_types met
    where met.meeting_type_id = mt.id and met.element_id = me.id
  );

insert into meeting_element_types (meeting_type_id, element_id)
select mt.id, me.id
from meeting_types mt
join meeting_elements me on me.key in ('upcoming_combined_activities', 'recent_successful_activities')
where mt.slug = 'youth-council'
  and not exists (
    select 1 from meeting_element_types met
    where met.meeting_type_id = mt.id and met.element_id = me.id
  );

-- 3. Seed section dividers into each type's default template
--    (format_key is always null for these three types -- they have no
--    special_format concept). Devotional anchors right before Opening
--    Prayer; Closing anchors right before Closing Prayer; Review and
--    Discussion anchor right after Spiritual Thought (the last
--    Devotional element) -- Review's own content (Announcements,
--    Previous Meeting Minutes) is synthesized at render time, not
--    stored as catalog rows, so its divider needs no gap of its own
--    beyond sitting ahead of Discussion's.
insert into meeting_templates (meeting_type_id, format_key, element_id, sort_order, slot_count)
select mt.meeting_type_id, mt.format_key, de.id, mt.sort_order - 1, null
from meeting_templates mt
join meeting_elements me on me.id = mt.element_id and me.key = 'opening_prayer'
cross join (select id from meeting_elements where key = 'devotional_section') de
where mt.meeting_type_id in (select id from meeting_types where slug in ('bishopric-meeting', 'ward-council', 'youth-council'))
  and not exists (
    select 1 from meeting_templates existing
    join meeting_elements eme on eme.id = existing.element_id
    where existing.meeting_type_id = mt.meeting_type_id
      and coalesce(existing.format_key, '') = coalesce(mt.format_key, '')
      and eme.key = 'devotional_section'
  );

insert into meeting_templates (meeting_type_id, format_key, element_id, sort_order, slot_count)
select mt.meeting_type_id, mt.format_key, re.id, mt.sort_order + 1, null
from meeting_templates mt
join meeting_elements me on me.id = mt.element_id and me.key = 'spiritual_thought'
cross join (select id from meeting_elements where key = 'review_section') re
where mt.meeting_type_id in (select id from meeting_types where slug in ('bishopric-meeting', 'ward-council', 'youth-council'))
  and not exists (
    select 1 from meeting_templates existing
    join meeting_elements eme on eme.id = existing.element_id
    where existing.meeting_type_id = mt.meeting_type_id
      and coalesce(existing.format_key, '') = coalesce(mt.format_key, '')
      and eme.key = 'review_section'
  );

insert into meeting_templates (meeting_type_id, format_key, element_id, sort_order, slot_count)
select mt.meeting_type_id, mt.format_key, dse.id, mt.sort_order + 2, null
from meeting_templates mt
join meeting_elements me on me.id = mt.element_id and me.key = 'spiritual_thought'
cross join (select id from meeting_elements where key = 'discussion_section') dse
where mt.meeting_type_id in (select id from meeting_types where slug in ('bishopric-meeting', 'ward-council', 'youth-council'))
  and not exists (
    select 1 from meeting_templates existing
    join meeting_elements eme on eme.id = existing.element_id
    where existing.meeting_type_id = mt.meeting_type_id
      and coalesce(existing.format_key, '') = coalesce(mt.format_key, '')
      and eme.key = 'discussion_section'
  );

insert into meeting_templates (meeting_type_id, format_key, element_id, sort_order, slot_count)
select mt.meeting_type_id, mt.format_key, ce.id, mt.sort_order - 1, null
from meeting_templates mt
join meeting_elements me on me.id = mt.element_id and me.key = 'closing_prayer'
cross join (select id from meeting_elements where key = 'closing_section') ce
where mt.meeting_type_id in (select id from meeting_types where slug in ('bishopric-meeting', 'ward-council', 'youth-council'))
  and not exists (
    select 1 from meeting_templates existing
    join meeting_elements eme on eme.id = existing.element_id
    where existing.meeting_type_id = mt.meeting_type_id
      and coalesce(existing.format_key, '') = coalesce(mt.format_key, '')
      and eme.key = 'closing_section'
  );

-- 4. Seed the new topics into Ward Council's / Youth Council's default
--    templates, right after Spiritual Thought (ahead of whatever else
--    already follows it) -- shares the same meeting type, so a single
--    statement each.
insert into meeting_templates (meeting_type_id, format_key, element_id, sort_order, slot_count)
select mt.meeting_type_id, mt.format_key, fop.id, mt.sort_order + 3, null
from meeting_templates mt
join meeting_elements me on me.id = mt.element_id and me.key = 'spiritual_thought'
cross join (select id from meeting_elements where key = 'focus_on_people') fop
where mt.meeting_type_id in (select id from meeting_types where slug in ('ward-council', 'youth-council'))
  and not exists (
    select 1 from meeting_templates existing
    join meeting_elements eme on eme.id = existing.element_id
    where existing.meeting_type_id = mt.meeting_type_id
      and coalesce(existing.format_key, '') = coalesce(mt.format_key, '')
      and eme.key = 'focus_on_people'
  );

insert into meeting_templates (meeting_type_id, format_key, element_id, sort_order, slot_count)
select mt.meeting_type_id, mt.format_key, uca.id, mt.sort_order + 4, null
from meeting_templates mt
join meeting_elements me on me.id = mt.element_id and me.key = 'spiritual_thought'
cross join (select id from meeting_elements where key = 'upcoming_combined_activities') uca
where mt.meeting_type_id = (select id from meeting_types where slug = 'youth-council')
  and not exists (
    select 1 from meeting_templates existing
    join meeting_elements eme on eme.id = existing.element_id
    where existing.meeting_type_id = mt.meeting_type_id
      and coalesce(existing.format_key, '') = coalesce(mt.format_key, '')
      and eme.key = 'upcoming_combined_activities'
  );

insert into meeting_templates (meeting_type_id, format_key, element_id, sort_order, slot_count)
select mt.meeting_type_id, mt.format_key, rsa.id, mt.sort_order + 5, null
from meeting_templates mt
join meeting_elements me on me.id = mt.element_id and me.key = 'spiritual_thought'
cross join (select id from meeting_elements where key = 'recent_successful_activities') rsa
where mt.meeting_type_id = (select id from meeting_types where slug = 'youth-council')
  and not exists (
    select 1 from meeting_templates existing
    join meeting_elements eme on eme.id = existing.element_id
    where existing.meeting_type_id = mt.meeting_type_id
      and coalesce(existing.format_key, '') = coalesce(mt.format_key, '')
      and eme.key = 'recent_successful_activities'
  );

-- 5. Same seeding, for already-seeded non-archived meetings of these
--    three types -- otherwise every meeting already in planning would
--    keep its old flat layout until archived.
insert into meeting_planned_elements (meeting_id, element_id, sort_order, slot_count)
select mpe.meeting_id, de.id, mpe.sort_order - 1, null
from meeting_planned_elements mpe
join meeting_elements me on me.id = mpe.element_id and me.key = 'opening_prayer'
join meetings m on m.id = mpe.meeting_id
cross join (select id from meeting_elements where key = 'devotional_section') de
where m.meeting_type_id in (select id from meeting_types where slug in ('bishopric-meeting', 'ward-council', 'youth-council'))
  and m.stage <> 'archived'
  and not exists (
    select 1 from meeting_planned_elements existing
    join meeting_elements eme on eme.id = existing.element_id
    where existing.meeting_id = mpe.meeting_id and eme.key = 'devotional_section'
  );

insert into meeting_planned_elements (meeting_id, element_id, sort_order, slot_count)
select mpe.meeting_id, re.id, mpe.sort_order + 1, null
from meeting_planned_elements mpe
join meeting_elements me on me.id = mpe.element_id and me.key = 'spiritual_thought'
join meetings m on m.id = mpe.meeting_id
cross join (select id from meeting_elements where key = 'review_section') re
where m.meeting_type_id in (select id from meeting_types where slug in ('bishopric-meeting', 'ward-council', 'youth-council'))
  and m.stage <> 'archived'
  and not exists (
    select 1 from meeting_planned_elements existing
    join meeting_elements eme on eme.id = existing.element_id
    where existing.meeting_id = mpe.meeting_id and eme.key = 'review_section'
  );

insert into meeting_planned_elements (meeting_id, element_id, sort_order, slot_count)
select mpe.meeting_id, dse.id, mpe.sort_order + 2, null
from meeting_planned_elements mpe
join meeting_elements me on me.id = mpe.element_id and me.key = 'spiritual_thought'
join meetings m on m.id = mpe.meeting_id
cross join (select id from meeting_elements where key = 'discussion_section') dse
where m.meeting_type_id in (select id from meeting_types where slug in ('bishopric-meeting', 'ward-council', 'youth-council'))
  and m.stage <> 'archived'
  and not exists (
    select 1 from meeting_planned_elements existing
    join meeting_elements eme on eme.id = existing.element_id
    where existing.meeting_id = mpe.meeting_id and eme.key = 'discussion_section'
  );

insert into meeting_planned_elements (meeting_id, element_id, sort_order, slot_count)
select mpe.meeting_id, ce.id, mpe.sort_order - 1, null
from meeting_planned_elements mpe
join meeting_elements me on me.id = mpe.element_id and me.key = 'closing_prayer'
join meetings m on m.id = mpe.meeting_id
cross join (select id from meeting_elements where key = 'closing_section') ce
where m.meeting_type_id in (select id from meeting_types where slug in ('bishopric-meeting', 'ward-council', 'youth-council'))
  and m.stage <> 'archived'
  and not exists (
    select 1 from meeting_planned_elements existing
    join meeting_elements eme on eme.id = existing.element_id
    where existing.meeting_id = mpe.meeting_id and eme.key = 'closing_section'
  );

insert into meeting_planned_elements (meeting_id, element_id, sort_order, slot_count)
select mpe.meeting_id, fop.id, mpe.sort_order + 3, null
from meeting_planned_elements mpe
join meeting_elements me on me.id = mpe.element_id and me.key = 'spiritual_thought'
join meetings m on m.id = mpe.meeting_id
cross join (select id from meeting_elements where key = 'focus_on_people') fop
where m.meeting_type_id in (select id from meeting_types where slug in ('ward-council', 'youth-council'))
  and m.stage <> 'archived'
  and not exists (
    select 1 from meeting_planned_elements existing
    join meeting_elements eme on eme.id = existing.element_id
    where existing.meeting_id = mpe.meeting_id and eme.key = 'focus_on_people'
  );

insert into meeting_planned_elements (meeting_id, element_id, sort_order, slot_count)
select mpe.meeting_id, uca.id, mpe.sort_order + 4, null
from meeting_planned_elements mpe
join meeting_elements me on me.id = mpe.element_id and me.key = 'spiritual_thought'
join meetings m on m.id = mpe.meeting_id
cross join (select id from meeting_elements where key = 'upcoming_combined_activities') uca
where m.meeting_type_id = (select id from meeting_types where slug = 'youth-council')
  and m.stage <> 'archived'
  and not exists (
    select 1 from meeting_planned_elements existing
    join meeting_elements eme on eme.id = existing.element_id
    where existing.meeting_id = mpe.meeting_id and eme.key = 'upcoming_combined_activities'
  );

insert into meeting_planned_elements (meeting_id, element_id, sort_order, slot_count)
select mpe.meeting_id, rsa.id, mpe.sort_order + 5, null
from meeting_planned_elements mpe
join meeting_elements me on me.id = mpe.element_id and me.key = 'spiritual_thought'
join meetings m on m.id = mpe.meeting_id
cross join (select id from meeting_elements where key = 'recent_successful_activities') rsa
where m.meeting_type_id = (select id from meeting_types where slug = 'youth-council')
  and m.stage <> 'archived'
  and not exists (
    select 1 from meeting_planned_elements existing
    join meeting_elements eme on eme.id = existing.element_id
    where existing.meeting_id = mpe.meeting_id and eme.key = 'recent_successful_activities'
  );

-- 6. Per-item notes for Agenda Items -- rendered inline in the
--    Discussion section, right under each item, rather than a single
--    notes block at the bottom of the page.
alter table agenda_items add column if not exists notes text;
