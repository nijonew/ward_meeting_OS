-- 058_drop_profiles_role.sql
--
-- Removes the role system this app's `profiles` table carried up to
-- this point -- superseded entirely by migration `057`'s per-calling
-- feature flags (see that file's own comment, and
-- lib/supabase/get-session-user.ts). Needs its own migration, unlike
-- `057`'s own superseded draft: `profiles.role` and its CHECK
-- constraint were added by migration `056`, which IS already
-- confirmed run in production, so it can't be amended away in place
-- the way an unrun file can.
--
-- `profiles.role_source` never shipped to production at all (it only
-- ever existed in `057`'s deleted, never-run draft) -- dropped here
-- too, defensively, in case this runs against a database where that
-- draft was tried first.
--
-- Does not touch `profiles.display_name`/`profiles.email`, or the
-- table itself -- those are unrelated to the role system and are still
-- read by getSessionUser() for display purposes.
--
-- Idempotent: safe to re-run.

alter table profiles drop constraint if exists profiles_role_check;
alter table profiles drop column if exists role;
alter table profiles drop column if exists role_source;
