-- 109_agenda_items_sort_order.sql
--
-- Adds a real sort_order to agenda_items so a meeting's own Discussion
-- section list can get a drag handle, same "apply broadly everywhere"
-- treatment every other reorderable list in this app already got
-- (2026-10-31, the user's own request: "I would like to have a way to
-- reorder agenda items with a handle like we have done in other
-- meetings. Please make this ubiquitous in all non-sacrament
-- meetings."). Agenda Items never got this earlier -- it didn't exist
-- as its own reorderable grid until the 2026-10-19 sectioned-agenda
-- rework, and has always just sorted by created_at since.
--
-- Backfilled per meeting_id, in the existing created_at order, so
-- nothing visibly reorders the moment this runs. An item with no
-- meeting_id yet (a public submission still sitting in the "Assign to
-- a meeting" queue, getUnassignedAgendaItems) gets no sort_order at
-- all -- that list has never been orderable and isn't being changed
-- now; it's still sorted by created_at.
--
-- Idempotent: `add column if not exists`, and the backfill only ever
-- touches rows where sort_order is still null, so a second run is a
-- no-op.

alter table agenda_items add column if not exists sort_order integer;

with ranked as (
  select id, (row_number() over (partition by meeting_id order by created_at, id) - 1) * 10 as new_order
  from agenda_items
  where meeting_id is not null
)
update agenda_items
set sort_order = ranked.new_order
from ranked
where agenda_items.id = ranked.id
  and agenda_items.sort_order is null;
