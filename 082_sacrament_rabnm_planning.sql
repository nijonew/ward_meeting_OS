-- 082_sacrament_rabnm_planning.sql
--
-- Restores a planning-ahead workflow for Ward Business's five smaller
-- subsections -- Recognitions, Advancements, Baptisms, New Members, Baby
-- Blessings -- which have had no planning-view UI at all since the
-- 2026-10-03 Ward Business rework collapsed everything down to a
-- Calling-Planning-only pull mechanism. The user's own mental model,
-- restated directly: Ward Business is the meeting section; Callings and
-- Releases (unchanged, still pulled from calling_planning) sit alongside
-- these five.
--
-- Mirrors calling_planning's own proven pool-table shape exactly: a
-- standing pool of not-yet-announced items (sacrament_rabnm_planning),
-- pulled into a specific meeting by creating a linked sacrament_rabnm row
-- and setting the pool row's announced_meeting_id; removing it from a
-- meeting clears that link so the pool row goes back into circulation
-- (or can be pulled into a different meeting later). Kept as a genuinely
-- separate table from sacrament_rabnm, not a dual-purpose reuse of its
-- own meeting_id column -- a meeting being deleted must never destroy a
-- standing pool record, only detach it (see the delete_meeting_cascade
-- amendment below).
--
-- Category mapping, confirmed directly with the user: Recognitions is a
-- new catch-all (missionary calls/farewells, Eagle Scout, a birth
-- announcement, and calling/release business handled inside a specific
-- class rather than from the stand -- announced in Sacrament Meeting as
-- having already taken place); Advancements (was "Aaronic Priesthood");
-- Baptisms; New Members (was "New Record"); Baby Blessings. "Presidency
-- Change" is dropped outright -- already redundant, since it's just a
-- Calling pull + a Release pull from the same calling_planning row.
-- "Baby Born" folds into Recognitions.
--
-- RABNM_TYPES (lib/data/sacrament-constants.ts, still used by
-- sacrament_rabnm's own Table Admin entry) is NOT renamed or trimmed --
-- every old historical value stays selectable there, matching this
-- project's own established "keep old keys, add new ones, never rename
-- or remove" precedent (e.g. migration 066's calling-status redesign).
--
-- Idempotent: `create table if not exists`, `create or replace function`.

create table if not exists sacrament_rabnm_planning (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('recognition', 'advancement', 'baptism', 'new_member', 'baby_blessing')),
  detail text,
  event_date date,
  announced_meeting_id uuid references meetings(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sacrament_rabnm_planning_people (
  id uuid primary key default gen_random_uuid(),
  rabnm_planning_id uuid not null references sacrament_rabnm_planning(id) on delete cascade,
  person_id uuid not null references people(id)
);

alter table sacrament_rabnm add column if not exists rabnm_planning_id uuid references sacrament_rabnm_planning(id) on delete set null;

alter table sacrament_rabnm_planning enable row level security;
alter table sacrament_rabnm_planning_people enable row level security;

drop policy if exists "authenticated access" on sacrament_rabnm_planning;
create policy "authenticated access" on sacrament_rabnm_planning
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated access" on sacrament_rabnm_planning_people;
create policy "authenticated access" on sacrament_rabnm_planning_people
  for all to authenticated using (true) with check (true);

-- Amends delete_meeting_cascade (migration 054, last amended by
-- migration 077) to detach -- never delete -- this new pool table's
-- rows when a meeting is deleted, same treatment as calling_planning's
-- own announced_meeting_id right above it.
create or replace function delete_meeting_cascade(p_meeting_id uuid)
returns void
language plpgsql
as $$
begin
  update calling_planning set announced_meeting_id = null where announced_meeting_id = p_meeting_id;
  update sacrament_rabnm_planning set announced_meeting_id = null where announced_meeting_id = p_meeting_id;

  delete from sacrament_rabnm_people where rabnm_id in (select id from sacrament_rabnm where meeting_id = p_meeting_id);
  delete from sacrament_rabnm where meeting_id = p_meeting_id;
  delete from sacrament_visiting_authorities where meeting_id = p_meeting_id;
  delete from sacrament_announcement_pulls where meeting_id = p_meeting_id;
  delete from sacrament_program_items where meeting_id = p_meeting_id;
  delete from sacrament_speakers_adults where meeting_id = p_meeting_id;
  delete from sacrament_speakers_youth where meeting_id = p_meeting_id;
  delete from sacrament_music where meeting_id = p_meeting_id;
  delete from sacrament_planning where meeting_id = p_meeting_id;
  delete from sacrament_assignments where meeting_id = p_meeting_id;
  delete from bishopric_assignments where meeting_id = p_meeting_id;
  delete from meeting_planned_elements where meeting_id = p_meeting_id;
  delete from meeting_element_notes where meeting_id = p_meeting_id;
  delete from agenda_items where meeting_id = p_meeting_id;
  delete from meeting_action_items where meeting_id = p_meeting_id;
  delete from council_notes where meeting_id = p_meeting_id;
  delete from bishopric_minutes where meeting_id = p_meeting_id;

  delete from meetings where id = p_meeting_id;
end;
$$;

-- Table Admin feature catalog row -- the full sortable/filterable
-- grid-with-Save-All-Changes view of this pool, same "raw-data
-- fallback, bespoke page for everyday use" split as sacrament_rabnm's
-- own entry. Nobody gets it automatically; grant it via
-- /admin/calling-features.
insert into features (key, label, category, sort_order) values
  ('table_admin_sacrament_rabnm_planning', 'Recognitions/Advancements/Baptisms/New Members Planning', 'Table Admin', 24)
on conflict (key) do nothing;
