-- 053_sacrament_visiting_authorities.sql
--
-- Visiting Authorities becomes a real, freely add/remove multi-select +
-- write-in list (2026-10-03, the user's own request: "I would like to
-- have a dropdown that includes those in Stake Presidency callings
-- (President and Counselors) and any in High Council callings. I would
-- like there to be a potential write-in option as well and allow for
-- multiple visiting authorities to be recognized").
--
-- Previously "Visiting Authorities" was cataloged as a plain free-text
-- element (resolution_kind 'free_text', writing one string to
-- meeting_element_notes) -- it was never actually wired into the
-- agenda grid, the public program, or the conducting script anywhere
-- in the app (checked directly before writing this migration: no
-- reference to the key anywhere outside the original template seed
-- rows and Table Admin's raw sacrament_planning grid). A single
-- free-text field can't hold a real multi-select of structured
-- person-or-guest entries, so this is a new table instead -- same
-- "dynamic add/remove list" pattern already used for Speakers & Music
-- (sacrament_program_items) and RABNM (sacrament_rabnm).
--
-- One row per recognized visiting authority for a meeting -- a real
-- person (calling-restricted, see lib/data/rotations.ts's new
-- VISITING_AUTHORITY_CALLING_NAMES) or a write-in guest name, never
-- both. sort_order lets them be listed in whatever order they were
-- added, matching every other ordered list in this app.
--
-- Note: sacrament_planning.visiting_authorities (a separate, dead text
-- column -- never read or written by any live code path) is left
-- alone, not dropped -- same "harmless but real, unused" treatment
-- already given to a few other columns in this app (e.g.
-- callings.title_prefix).
--
-- Idempotent: safe to re-run (create table if not exists).

create table if not exists sacrament_visiting_authorities (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings(id) on delete cascade,
  person_id uuid references people(id),
  guest_name text,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now()
);

create index if not exists sacrament_visiting_authorities_meeting_id_idx
  on sacrament_visiting_authorities (meeting_id);

alter table sacrament_visiting_authorities enable row level security;

drop policy if exists "authenticated all sacrament_visiting_authorities" on sacrament_visiting_authorities;
create policy "authenticated all sacrament_visiting_authorities"
  on sacrament_visiting_authorities for all
  to authenticated
  using (true)
  with check (true);
