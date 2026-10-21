-- Migration 080: calling-based rotation members.
--
-- The user's own request, 2026-10-21: "I would like to update the
-- rotations to be calling based rather than based on a person by name.
-- Then the agenda will call the person by title+last name for the
-- agenda." Generalizes the Presiding/Conducting pattern
-- (applyFixedSacramentRoles, lib/data/rotations.ts) -- which already
-- resolves a role to whoever currently holds a specific calling, read
-- fresh every time -- to the generic rotation_members table, which has
-- only ever cycled through fixed people.
--
-- Purely additive. Every existing rotation_members row keeps its
-- person_id untouched and keeps working exactly as before -- a rotation
-- becomes "calling-based" simply by having calling-based members
-- (calling_id set, person_id null) instead of, or alongside, person-based
-- ones. No change to apply_rotation_assignment() itself (migration 041):
-- resolving a calling-based member down to a concrete person id (that
-- calling's current holder) happens in TypeScript, right before that
-- RPC is called, the same approach applyFixedSacramentRoles already
-- uses -- the one piece of this app that's hardest to inspect/test
-- without live database access stays completely untouched by this.
--
-- rotation_members predates this repo's tracked migration history (no
-- CREATE TABLE for it exists in any earlier file), so person_id's
-- current NOT NULL-ness is inferred from every existing row having one,
-- not confirmed from a migration -- `alter column ... drop not null` is
-- a safe no-op if it already allows nulls.
--
-- Idempotent (if not exists / drop constraint if exists + add) since
-- partial-failure re-runs are common in this project's own history.

alter table rotation_members alter column person_id drop not null;
alter table rotation_members add column if not exists calling_id uuid references callings(id);

alter table rotation_members drop constraint if exists rotation_members_exactly_one_target;
alter table rotation_members add constraint rotation_members_exactly_one_target
  check ((person_id is not null) <> (calling_id is not null));
