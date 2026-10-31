-- 093_sacrament_rabnm_baby_name.sql
--
-- Carries `baby_name` from the planning pool
-- (sacrament_rabnm_planning.baby_name, migration 085) through to the
-- announced row -- needed for the Conducting script rewrite's "family
-- name" derivation (2026-10-31): the pull (pullRabnmPlanningIntoMeeting)
-- never copied this field over, so once a baby blessing was actually
-- pulled into a meeting, the baby's own name was lost from that point
-- on -- only ever visible back on the pool page before the pull.

alter table sacrament_rabnm add column if not exists baby_name text;
