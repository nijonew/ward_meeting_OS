-- 056_bishop_role.sql
--
-- Splits "bishop" out as its own profiles.role value, distinct from
-- the shared "bishopric" role (Counselors / Exec Sec / Clerk) -- the
-- user's own request (2026-10-03): "let's make the bishop its own
-- role rather than lumping it in the bishopric role. A bishop can
-- essentially give ownership to the next bishop and is the one that
-- can grant that access." The app normalizes a stored "bishop" back
-- down to "bishopric" for every existing permission check (see
-- lib/supabase/get-session-user.ts's SessionProfile.role) and exposes
-- a separate `isBishop` flag for the one new place that needs to tell
-- them apart -- granting the "bishop" role itself (succession),
-- restricted to whoever already holds it.
--
-- `profiles` predates this repo's migration history entirely (same
-- situation already found and documented elsewhere for other DB
-- objects -- the bishopric_assignments check constraint, two old RLS
-- policies on sacrament_assignments), so this migration can't know for
-- certain whether `role` is already constrained to a fixed list at
-- the database level, or by what name. This dynamically finds and
-- drops any CHECK constraint on profiles.role (by inspecting its
-- definition, not assuming a name) before adding a fresh one that
-- includes "bishop" -- idempotent (the constraint it just added also
-- mentions "role", so a second run finds and replaces that one too,
-- rather than stacking a redundant second constraint).
--
-- If `role` turns out not to have been constrained at the database
-- level at all before this (plausible -- most "status"-like columns in
-- this app are plain text), this simply adds one for the first time,
-- matching exactly the set of values the app's own AppRole/StoredRole
-- TypeScript types already enforce.
--
-- Verify after running: an admin should still be able to set every
-- existing role value via Supabase's Table Editor, plus the new
-- "bishop" value, with nothing rejected.
--
-- Separately, confirm what a brand-new signup's profiles row actually
-- gets for `role` -- whatever trigger/default creates that row isn't
-- in this repo's migration history either, and the whole "needs
-- verification" banner (lib/data/profile-verification.ts) depends on
-- it coming in as null, not some other default.

do $$
declare
  existing_constraint text;
begin
  select con.conname into existing_constraint
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  where rel.relname = 'profiles'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%role%'
  limit 1;

  if existing_constraint is not null then
    execute format('alter table profiles drop constraint %I', existing_constraint);
  end if;
end $$;

alter table profiles add constraint profiles_role_check
  check (role is null or role in (
    'bishop',
    'bishopric',
    'music_planner',
    'communications_specialist',
    'yw_presidency',
    'yw_advisor',
    'yw_specialist',
    'ym_advisor',
    'ym_specialist'
  ));
