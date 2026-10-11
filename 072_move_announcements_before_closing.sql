-- 072_move_announcements_before_closing.sql
--
-- "Can we add an announcement section before the closing hymn and
-- prayer?" (the user's own request, 2026-10-11, right after
-- Announcements became a real, pullable agenda element). It already
-- existed in every Sacrament Meeting format that has it -- sort_order
-- 70, right after Visiting Authorities and before the Opening Hymn
-- (migration 033's original order) -- just not where the real meeting
-- flow actually wants it: announcements are given near the end, not
-- near the beginning. Moves it to immediately before Closing Hymn
-- (whatever that format's own sort_order for Closing Hymn happens to
-- be, computed relatively rather than hardcoded -- same reasoning as
-- migration 046's `mt.sort_order + 1` trick for Sacrament Administered,
-- just subtracting instead of adding) across every format_key that has
-- both elements at once, not just 'standard'.
--
-- Same update applied to already-seeded, non-archived meetings'
-- meeting_planned_elements (per meeting_id this time, not format_key,
-- since that table has no format_key column of its own) -- otherwise
-- every Sacrament Meeting already in planning would keep showing
-- Announcements in its old spot until archived, matching migration
-- 046's own precedent for exactly this situation.
--
-- Idempotent: safe to re-run (recomputes the same target position
-- every time rather than applying a one-time relative shift).

update meeting_templates ann
set sort_order = closing.sort_order - 5
from meeting_templates closing
join meeting_elements closing_el on closing_el.id = closing.element_id and closing_el.key = 'closing_hymn'
join meeting_elements ann_el on ann_el.id = ann.element_id and ann_el.key = 'announcements'
where ann.meeting_type_id = (select id from meeting_types where slug = 'sacrament-meeting')
  and closing.meeting_type_id = ann.meeting_type_id
  and coalesce(closing.format_key, '') = coalesce(ann.format_key, '')
  and ann.element_id = ann_el.id;

update meeting_planned_elements ann
set sort_order = closing.sort_order - 5
from meeting_planned_elements closing
join meeting_elements closing_el on closing_el.id = closing.element_id and closing_el.key = 'closing_hymn'
join meeting_elements ann_el on ann_el.id = ann.element_id and ann_el.key = 'announcements'
join meetings m on m.id = ann.meeting_id
where closing.meeting_id = ann.meeting_id
  and m.meeting_type_id = (select id from meeting_types where slug = 'sacrament-meeting')
  and m.stage <> 'archived';
