-- 042_teaching_assignments.sql
--
-- Teaching Calendar (2026-09-08, the user's own request): a Sunday
-- teaching schedule for each YM/YW class. Deliberately NOT tied to
-- people or callings in any way -- entry is a short free-text field
-- (a name, a lesson topic, or both, whatever's useful), not a person_id
-- FK. This is a flat calendar, not a rotation: nothing here auto-fills
-- or advances a pointer the way Assignment Rotations does.
--
-- One row per (class_date, class_name) actually filled in -- a blank
-- cell in the UI just means no row exists yet, same sparse-table
-- pattern as meeting_element_notes.
--
-- Idempotent: safe to re-run.

create table if not exists teaching_assignments (
  id uuid primary key default gen_random_uuid(),
  class_date date not null,
  class_name text not null,
  entry text not null,
  updated_at timestamp with time zone not null default now(),
  unique (class_date, class_name)
);

alter table teaching_assignments enable row level security;

-- Authenticated-wide, same as most tables in this app -- the page itself
-- restricts viewing/editing to youth leaders + Bishopric (see
-- app/teaching-calendar/page.tsx). No anon policy: unlike Youth
-- Activities, this was never meant to be publicly visible.
drop policy if exists "authenticated read teaching_assignments" on teaching_assignments;
create policy "authenticated read teaching_assignments"
  on teaching_assignments for select
  to authenticated
  using (true);

drop policy if exists "authenticated write teaching_assignments" on teaching_assignments;
create policy "authenticated write teaching_assignments"
  on teaching_assignments for all
  to authenticated
  using (true)
  with check (true);
