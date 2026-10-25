-- 081_primary_program_teaching_item.sql
--
-- Ties the "Primary Program" special_format back to a real Teaching
-- Program item, 2026-10-24. The user's own report, right after the new
-- freely-addable "Primary Program" Teaching Program item shipped (a
-- plain application-code change, no migration): "I thought the old
-- primary program items only related to a template that could be
-- created and designated as a primary program. That seems to have
-- been lost."
--
-- Context: `meeting_elements.key = 'primary_program'` (migration 033,
-- corrected by 036) has always been a fixed, empty banner line
-- (resolution_kind 'none', no content at all) seeded only into the
-- "Primary Program" special_format's own main-agenda-grid template, at
-- sort_order 140 between Sacrament Hymn and Closing Hymn. The new
-- Teaching Program item (lib/data/sacrament-program-shared.ts) is a
-- completely separate, free-standing thing -- addable to any Sacrament
-- Meeting's Teaching Program list regardless of special_format, with
-- no connection back to the old fixed line. Once both existed side by
-- side, a meeting actually using the "Primary Program" format would
-- have shown two separate Primary-Program-labeled lines: the old empty
-- fixed banner (nothing to fill in, nothing real happening there) and
-- the new real item (where the actual designation now has to happen
-- manually). That's the disconnect the user is describing -- "a
-- template that could be created and designated as a primary program"
-- no longer actually produces the Primary Program content on its own.
--
-- Fix: drop the old fixed banner line from the "Primary Program"
-- format's own template, and pre-seed the new Teaching Program item in
-- its place via sacrament_program_templates -- so creating a new
-- meeting with Format = "Primary Program" once again means the
-- meeting is designated as one, automatically, with no extra manual
-- step. Also repairs any already-seeded, non-archived meeting using
-- this format the same way, so an in-progress meeting isn't left
-- stuck with the old, now-orphaned fixed line. The meeting_elements
-- catalog row itself is left alone, untouched -- deleting it outright
-- would cascade-delete any ARCHIVED meeting's own already-finalized
-- meeting_planned_elements row referencing it, destroying real
-- historical record; this only ever touches the template and
-- non-archived meetings.
--
-- Idempotent: `where not exists` throughout, safe to re-run.

-- 1. Drop the old fixed line from the format's own default template --
--    new meetings created with this format from now on won't get it.
delete from meeting_templates
where meeting_type_id = (select id from meeting_types where slug = 'sacrament-meeting')
  and format_key = 'primary_program'
  and element_id = (select id from meeting_elements where key = 'primary_program');

-- 2. Pre-seed the new Teaching Program item in its place, matching the
--    exact pattern testimony_meeting -> 'testimony' already uses
--    (migration 047) -- sort_order is irrelevant once there's only one
--    row for this format, but kept consistent with that precedent.
insert into sacrament_program_templates (format_key, item_key, sort_order)
select 'primary_program', 'primary_program', 10
where not exists (
  select 1 from sacrament_program_templates existing
  where existing.format_key = 'primary_program' and existing.item_key = 'primary_program'
);

-- 3. Repair any already-seeded, non-archived meeting using this format
--    (there may be none in production yet -- these are no-ops if so).
--    Remove its own copy of the old fixed line...
delete from meeting_planned_elements
where element_id = (select id from meeting_elements where key = 'primary_program')
  and meeting_id in (
    select m.id from meetings m
    join sacrament_planning sp on sp.meeting_id = m.id
    where sp.special_format = 'primary_program' and m.stage <> 'archived'
  );

-- ...and give it the new Teaching Program item instead, if it doesn't
-- already have one (an admin may have already added it by hand since
-- the application-code change shipped).
insert into sacrament_program_items (meeting_id, item_key, sort_order)
select m.id, 'primary_program', 10
from meetings m
join sacrament_planning sp on sp.meeting_id = m.id
where sp.special_format = 'primary_program'
  and m.stage <> 'archived'
  and not exists (
    select 1 from sacrament_program_items existing
    where existing.meeting_id = m.id and existing.item_key = 'primary_program'
  );
