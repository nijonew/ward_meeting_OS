-- 030_people_profile_link.sql
--
-- Lets an admin match an authenticated login account (profiles) to an
-- existing person (people) -- the gap flagged in the "Adding new
-- people" privacy workflow: these two tables have no connection today.
--
-- Note: this migration ALSO adds a new RLS policy on `profiles`
-- (currently only ever queried for a user's own row anywhere in the
-- app, per a code search -- worth your attention when you run this,
-- since it's the one part of this migration that isn't purely additive
-- schema). It allows any authenticated user to SELECT the full
-- `profiles` row (id, role, display_name, email), matching this
-- project's general RLS convention of "any authenticated user, app
-- code gates by role" -- Postgres RLS can't restrict to just some
-- columns (that needs a view), so this is full-row access, not just
-- display_name. If you'd rather keep profiles fully private to each
-- user's own row, don't run this migration as-is -- say so and it can
-- be redone with a restricted view instead.
--
-- Idempotent: safe to re-run.

alter table people add column if not exists profile_id uuid references profiles(id);
create unique index if not exists people_profile_id_unique on people (profile_id) where profile_id is not null;

alter table profiles enable row level security;

drop policy if exists "authenticated read profiles" on profiles;
create policy "authenticated read profiles"
  on profiles for select
  to authenticated
  using (true);
