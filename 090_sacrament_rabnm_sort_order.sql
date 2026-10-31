-- 090_sacrament_rabnm_sort_order.sql
--
-- New `sacrament_rabnm.sort_order` -- lets an admin reorder individual
-- Callings/Releases lines in Sacrament Meeting's Ward Business (the
-- user's own request, 2026-10-30: "I would like to be able to
-- re-order individual lines in callings/releases in sacrament meeting
-- to the order I would like to have them announced"). This table has
-- never had an ordering column of its own -- every reader
-- (lib/data/sacrament-planning.ts's getSacramentPlanningData, shared
-- by Planning, Conducting, and Archived) has always returned rows in
-- whatever order Postgres happened to hand back.

alter table sacrament_rabnm add column if not exists sort_order integer;

-- Backfill: every existing row gets a real order, scoped per
-- (meeting_id, type) so Callings and Releases each get their own
-- independent sequence -- matching how WardBusinessField.tsx already
-- treats them as two separate lists, filtered apart by type. `* 10`
-- leaves gaps for new rows to slot into without ever needing to
-- renumber siblings, matching this app's own established
-- addTemplateElement convention for the same reason. Idempotent -- a
-- second run finds nothing left with a null sort_order.
update sacrament_rabnm r
set sort_order = ranked.rn * 10
from (
  select id, row_number() over (partition by meeting_id, type order by id) as rn
  from sacrament_rabnm
  where sort_order is null
) ranked
where r.id = ranked.id;
