-- 075_fix_stale_anon_sacrament_assignments_policy.sql
--
-- "People are able to see today's sacrament meeting... but could only
-- see the music" (the user's own report, 2026-10-11) -- confirmed via
-- a direct `pg_policies` query the user ran at this file's own
-- request. `sacrament_assignments` carried an anon-facing SELECT
-- policy, "public read ready sacrament assignments," gated on
-- `meetings.stage in ('ready', 'live')` -- stages Sacrament Meeting
-- stopped reaching entirely once its own lifecycle was simplified
-- down to template -> planning -> archived (2026-09-10, "we can
-- remove the review, ready, live statuses for sacrament meeting").
--
-- Same class of problem as migrations 038, 041, 063, 067, 068, 069
-- before it: an undocumented RLS object, created directly in the
-- Supabase SQL editor before this repo's migration history started,
-- left pointing at a stage value the app stopped using once that
-- simplification shipped. Since a real Sacrament Meeting's stage can
-- now only ever be template/planning/archived, this policy's own
-- condition could never match -- an anonymous (not-logged-in)
-- visitor's query against `sacrament_assignments` always returned
-- zero rows, hiding Presiding/Conducting/every prayer from the public
-- program, while an admin saw it fine via the separate "authenticated
-- access" policy (ALL/true, any logged-in account regardless of
-- role). Music showed correctly in the same view because its own anon
-- policy is gated on `status = 'published'`, not meeting stage --
-- confirming this table specifically, not the public page's own logic
-- or the 6 AM visibility gate, was the actual gap.
--
-- Replaces the condition with the same rule this app's own Vision
-- workflow already states for this table's real visibility ("public
-- with no login... editable at all times until archived"): not
-- archived. Deliberately coarser than the application-level gate in
-- app/meetings/[id]/public/page.tsx (which also enforces the real
-- date and the 6 AM Mountain floor) -- that's fine, RLS here is a
-- backstop, not the only gate, matching how every other narrow anon
-- policy in this app already works (scoped to what the public UI
-- already filters to client-side, not a stricter gate of its own).
-- Renamed (dropping "ready" from the policy's own name, which no
-- longer describes its condition) -- both the old and new names are
-- dropped first so this stays safe to re-run regardless of which one
-- currently exists.
--
-- **Amended in place, same day, before this migration was ever run**
-- (same "amend rather than renumber" precedent as migrations 047/065):
-- a second, matching gap confirmed via the same `pg_policies` query,
-- against `sacrament_program_items` -- the table determining WHICH
-- items are in the Teaching Program (Speakers & Music) list and in
-- what order (migration 046). It had only `authenticated` policies, no
-- `anon` row at all -- not a stale condition this time, just one never
-- written in the first place. With RLS enabled and no matching policy,
-- Postgres denies by default, so `getSacramentProgramItems` returned
-- an empty list for every anonymous visitor regardless of whether the
-- underlying speaker/music rows were confirmed or published correctly
-- -- the whole Teaching Program loop in `getPublicSacramentView` never
-- executed, which is why the pasted public-page screenshot that
-- surfaced the `sacrament_assignments` bug above also showed zero
-- Speaker/Musical Number/Testimony lines, not even blank ones.
--
-- This table itself holds no sensitive content -- just an `item_key`
-- and `sort_order` per meeting, no names or free text -- the real
-- content stays protected by the underlying tables' own anon policies
-- (`confirmed = true` for speakers, `status = 'published'` for music).
-- Still scoped to "not archived," matching `sacrament_assignments`'
-- own fix just above and this app's Vision workflow's "no public
-- access at all once archived" rule, rather than an unconditional
-- `true` -- cheap to include and keeps every meeting-scoped anon
-- policy in this app following the same one rule.
--
-- Idempotent: safe to re-run.

drop policy if exists "public read ready sacrament assignments" on sacrament_assignments;
drop policy if exists "public read sacrament assignments" on sacrament_assignments;

create policy "public read sacrament assignments"
  on sacrament_assignments for select
  to anon
  using (
    exists (
      select 1 from meetings
      where meetings.id = sacrament_assignments.meeting_id
        and meetings.stage <> 'archived'
    )
  );

drop policy if exists "public read sacrament program items" on sacrament_program_items;

create policy "public read sacrament program items"
  on sacrament_program_items for select
  to anon
  using (
    exists (
      select 1 from meetings
      where meetings.id = sacrament_program_items.meeting_id
        and meetings.stage <> 'archived'
    )
  );
