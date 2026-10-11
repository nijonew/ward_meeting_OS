-- 074_announcements_multiple_blocks.sql
--
-- "Two independent blocks, each its own pool" -- the user's own
-- choice (2026-10-11), answering a direct scoping question about what
-- "I just want the ability to add a second announcement block before
-- the closing hymn/prayer" should actually mean (the real need behind
-- migration 072, which is on hold -- see PROJECT_CONTEXT.md's Known
-- open items for the full writeup of both).
--
-- Two schema changes:
--
-- 1. `meeting_planned_elements` has had `unique (meeting_id,
--    element_id)` since migration 033 -- a meeting could never have
--    the same catalog element twice. Dropping it is what actually
--    makes "add Announcements a second time" possible at all --
--    confirmed no application code relies on this constraint being
--    enforced (no ON CONFLICT target anywhere against it, nothing
--    else assumes exactly one row per element). Name matches the
--    conventional Postgres auto-generated name for an inline
--    `unique (a, b)` column-list constraint, same naming migration
--    033 itself already confirmed correct for the sibling
--    `meeting_templates` table's own equivalent constraint.
--
-- 2. `announcements` gains `planned_element_id`, a nullable FK to the
--    SPECIFIC `meeting_planned_elements` row an announcement was
--    pulled into -- not just which meeting (the existing `meeting_id`,
--    migration 031, untouched). Without this, two Announcements
--    blocks on the same meeting would have no way to tell which block
--    a given pulled announcement belongs to, and both would show the
--    exact same list. `on delete set null` (not cascade) -- removing
--    the *block* itself (the Agenda Elements editor's own Remove
--    button, which deletes the `meeting_planned_elements` row) should
--    put its announcements back in the general pool, the same as
--    un-pulling each one by hand, not silently delete real
--    announcement content.
--
-- Backfill: any announcement already pulled into a meeting before
-- this shipped has `meeting_id` set but `planned_element_id` still
-- null -- resolved here to that meeting's own first (lowest
-- sort_order) Announcements block, if one exists. (At the time this
-- was written, the Announcements feature itself had only just shipped
-- this same session and had not yet been used in production, so this
-- backfill is precautionary, not a known-needed fix.)
--
-- Idempotent: safe to re-run.

alter table meeting_planned_elements
  drop constraint if exists meeting_planned_elements_meeting_id_element_id_key;

alter table announcements
  add column if not exists planned_element_id uuid references meeting_planned_elements(id) on delete set null;

update announcements a
set planned_element_id = first_block.id
from (
  select distinct on (mpe.meeting_id) mpe.id, mpe.meeting_id
  from meeting_planned_elements mpe
  join meeting_elements me on me.id = mpe.element_id
  where me.key = 'announcements'
  order by mpe.meeting_id, mpe.sort_order asc
) as first_block
where a.meeting_id = first_block.meeting_id
  and a.meeting_id is not null
  and a.planned_element_id is null;
