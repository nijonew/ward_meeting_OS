-- 045_youth_class_teachers.sql
--
-- Youth Teaching Planning access control (2026-09-09, the user's own
-- request): "authenticate the specific people assigned to the youth
-- group to see only their group unless it is the bishopric or young
-- women presidency." Before this, viewing/editing the whole Teaching
-- Calendar was all-or-nothing by role (any of the 5 youth-leader roles,
-- or Bishopric) -- this table narrows that down to specific class(es)
-- per person, for everyone except Bishopric (sees every class) and
-- Young Women Presidency (sees every YW class), both of which stay
-- role-based -- see getAccessibleClasses in lib/data/teaching-assignments.ts.
--
-- Deliberately separate from `callings` -- not every class-teacher
-- relationship maps to a distinct calling in this ward's real roster,
-- and this is a pure access-control mapping (who may view/edit a
-- class's schedule), not a calling record. class_name is free text
-- matching one of the 6 real class values in
-- lib/data/youth-activity-constants.ts's YOUTH_ACTIVITY_GROUPS (minus
-- the "Combined ..." pseudo-values) rather than its own FK table, same
-- reasoning teaching_assignments.class_name already uses.
--
-- Idempotent: safe to re-run.

create table if not exists youth_class_teachers (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  class_name text not null,
  created_at timestamp with time zone not null default now(),
  unique (person_id, class_name)
);

alter table youth_class_teachers enable row level security;

-- Authenticated-wide, same as most tables in this app -- Table Admin
-- itself (bishopric-only) is the only place this gets edited.
drop policy if exists "authenticated read youth_class_teachers" on youth_class_teachers;
create policy "authenticated read youth_class_teachers"
  on youth_class_teachers for select
  to authenticated
  using (true);

drop policy if exists "authenticated write youth_class_teachers" on youth_class_teachers;
create policy "authenticated write youth_class_teachers"
  on youth_class_teachers for all
  to authenticated
  using (true)
  with check (true);
