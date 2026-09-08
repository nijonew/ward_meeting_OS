-- 038_bishopric_assignments_role_check.sql
--
-- Fixes a real bug reported 2026-09-06: Table Admin's "Bishopric
-- Meeting Assignment Rotation" grid offered the full Sacrament Meeting
-- role list (Presiding/Conducting/Chorister/Organist/prayers) for
-- `bishopric_assignments.role`, since registry.ts had been reusing
-- ASSIGNMENT_ROLES wholesale -- but Presiding/Conducting/Chorister/
-- Organist are Sacrament-Meeting-only concepts that only ever go into
-- `sacrament_assignments` (Conducting is fixed by calling via
-- applyFixedSacramentRoles, not even the generic rotation table).
-- Picking "Presiding" hit `bishopric_assignments_role_check` and
-- failed to save. Fixed at the UI layer too (registry.ts now uses the
-- new BISHOPRIC_ASSIGNMENT_ROLES constant) -- this migration
-- (re)documents the DB-side constraint explicitly, since it predates
-- this repo's migration history and was never captured in a file.
--
-- Valid roles confirmed against migration 034's real rotation seed
-- data: bishopric_assignments (shared by Bishopric Meeting, Ward
-- Council, and Youth Council) only ever configures opening_prayer,
-- closing_prayer, spiritual_thought, and handbook_training rotations.
--
-- Idempotent: safe to re-run.

alter table bishopric_assignments drop constraint if exists bishopric_assignments_role_check;
alter table bishopric_assignments add constraint bishopric_assignments_role_check
  check (role in ('opening_prayer', 'closing_prayer', 'spiritual_thought', 'handbook_training'));
