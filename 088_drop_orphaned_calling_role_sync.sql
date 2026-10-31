-- 088_drop_orphaned_calling_role_sync.sql
--
-- Drops a leftover trigger chain from the abandoned first-pass
-- permissions design (profiles.role/role_source, superseded by
-- migration 057/060's calling_features many-to-many model) -- never
-- captured in this repo's migration history, created directly in the
-- Supabase SQL editor at some point during that first pass, and never
-- cleaned up once the design was abandoned. Root-caused 2026-10-30
-- from the user's own report: "column role_source does not exist"
-- when saving either Calling Planning's own grid or
-- /admin/person-callings. Both write to callings.current_holder_id --
-- exactly what this trigger fires on -- which is why the same error
-- showed up in two seemingly unrelated places.
--
-- Confirmed directly against the live database (this assistant has no
-- live DB access, so the user ran these diagnostics in the Supabase
-- SQL editor and pasted back the results):
--   - A trigger `calling_role_sync` on `callings`, firing on insert
--     and update, calling `sync_calling_role()`.
--   - `sync_calling_role()` calls `recompute_role_for_person(person_id)`
--     for whichever person just gained or lost a calling.
--   - `recompute_role_for_person()` reads/writes `profiles.role`/
--     `role_source` (both dropped by migration 058) and joins against
--     `calling_role_mappings` (a table from the same abandoned design)
--     -- the exact "undocumented object created directly in the SQL
--     editor, never updated when the design it belonged to changed"
--     class of bug this project has hit repeatedly (migrations
--     038/041/063/067/068/069/075/078).
--
-- Dropped outright, not recreated against anything -- nothing in the
-- current app reads profiles.role/role_source or calling_role_mappings
-- any more; the real, current permissions model is the features/
-- calling_features join (migration 060), which needs no trigger-based
-- auto-sync at all.

drop trigger if exists calling_role_sync on callings;
drop function if exists sync_calling_role();
drop function if exists recompute_role_for_person(uuid);
drop table if exists calling_role_mappings;
