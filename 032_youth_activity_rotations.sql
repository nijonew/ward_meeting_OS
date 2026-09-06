-- 032_youth_activity_rotations.sql
--
-- Builds the "Adult leaders planning youth activities" workflow (see
-- PROJECT_CONTEXT.md and youth-activities-2026-schedule.md):
--
-- 1. youth_activities gains the tentative/confirmed and
--    cancelled-but-still-shown fields the workflow calls for -- both
--    independent of the existing draft/published `status` column,
--    which is about public visibility, not planning settledness. It
--    also gains `planning_group`, separate from the existing
--    `group_name`: for a combined week, `group_name` stays the
--    attendee scope (one of the existing "Combined YM"/"Combined YW"/
--    "Combined YM/YW" pseudo-values -- everyone in that scope attends),
--    while `planning_group` records which single class is on the hook
--    to plan it that time, per the workflow's "rotation of which
--    groups *plan* which events." A non-combined activity leaves
--    planning_group null -- group_name alone already means both
--    attendee and planner there.
--
-- 2. A lightweight, purpose-built rotation engine for the three
--    combined-week patterns (Combined YM: 1st Wednesday; Combined
--    YM/YW: 3rd Wednesday; Combined YW: 2nd & 4th Wednesday),
--    deliberately separate from the existing rotations/rotation_members
--    tables: those rotate *people* (a hard FK into `people`) onto a
--    *meeting*-scoped role; this rotates *youth groups* (plain text,
--    matching YOUTH_ACTIVITY_GROUPS) onto a youth_activities row, on a
--    monthly nth-Wednesday cadence unrelated to meetings/meeting_types.
--    Same underlying design principle as the existing rotations,
--    though: an ordered member list + a next_index pointer that
--    advances once per occurrence *generated* (see
--    lib/data/youth-activity-schedule.ts), so a one-off manual
--    override (editing group_name on a single row via Table Admin)
--    never skips anyone in future occurrences.
--
-- 3. Seeds the three rotations from the real 2026 schedule the user
--    provided, simplified to a clean repeating cycle per
--    youth-activities-2026-schedule.md's own analysis -- explicitly
--    authorized by the user as "a starter" that may be updated later.
--    next_index on each is set to continue correctly *after* the real
--    seeded rows below (through Feb 2027), not from scratch.
--
-- 4. Seeds the real, already-known near-term activities (Sept 2026 --
--    Feb 2027) directly from the schedule the user provided, rather
--    than re-deriving them from the rotation (avoids getting the
--    transition-period/exception months wrong -- e.g. December 2026's
--    Combined YM repeats Teachers, a confirmed one-off override, not
--    part of the base cycle). Dates verified independently (1st/2nd/
--    3rd/4th Wednesday of each month), not copied from memory. Every
--    5th Wednesday and every non-combined week is deliberately left
--    ungenerated -- the individual-group weekly rotation hasn't been
--    provided yet.
--
-- Idempotent: safe to re-run.

alter table youth_activities add column if not exists confirmed boolean not null default false;
alter table youth_activities add column if not exists cancelled boolean not null default false;
alter table youth_activities add column if not exists cancellation_note text;
alter table youth_activities add column if not exists planning_group text;

create table if not exists youth_activity_rotations (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  next_index integer not null default 0
);

create table if not exists youth_activity_rotation_members (
  id uuid primary key default gen_random_uuid(),
  rotation_id uuid not null references youth_activity_rotations(id) on delete cascade,
  group_name text not null,
  sort_order integer not null,
  unique (rotation_id, sort_order)
);

alter table youth_activity_rotations enable row level security;
alter table youth_activity_rotation_members enable row level security;

drop policy if exists "authenticated read youth_activity_rotations" on youth_activity_rotations;
create policy "authenticated read youth_activity_rotations"
  on youth_activity_rotations for select
  to authenticated
  using (true);

drop policy if exists "authenticated write youth_activity_rotations" on youth_activity_rotations;
create policy "authenticated write youth_activity_rotations"
  on youth_activity_rotations for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "authenticated read youth_activity_rotation_members" on youth_activity_rotation_members;
create policy "authenticated read youth_activity_rotation_members"
  on youth_activity_rotation_members for select
  to authenticated
  using (true);

drop policy if exists "authenticated write youth_activity_rotation_members" on youth_activity_rotation_members;
create policy "authenticated write youth_activity_rotation_members"
  on youth_activity_rotation_members for all
  to authenticated
  using (true)
  with check (true);

insert into youth_activity_rotations (key, label, next_index) values
  ('combined_ym', 'Combined YM (1st Wednesday)', 2),
  ('combined_ym_yw', 'Combined YM/YW (3rd Wednesday)', 0),
  ('combined_yw', 'Combined YW (2nd & 4th Wednesday)', 1)
on conflict (key) do nothing;

insert into youth_activity_rotation_members (rotation_id, group_name, sort_order)
select r.id, m.group_name, m.sort_order
from youth_activity_rotations r
join (values
  ('combined_ym', 'Deacons', 0),
  ('combined_ym', 'Priests', 1),
  ('combined_ym', 'Teachers', 2)
) as m(key, group_name, sort_order) on m.key = r.key
on conflict (rotation_id, sort_order) do nothing;

insert into youth_activity_rotation_members (rotation_id, group_name, sort_order)
select r.id, m.group_name, m.sort_order
from youth_activity_rotations r
join (values
  ('combined_ym_yw', 'Gatherers of Light', 0),
  ('combined_ym_yw', 'Teachers', 1),
  ('combined_ym_yw', 'Messengers of Hope', 2),
  ('combined_ym_yw', 'Builders of Faith', 3),
  ('combined_ym_yw', 'Deacons', 4),
  ('combined_ym_yw', 'Priests', 5)
) as m(key, group_name, sort_order) on m.key = r.key
on conflict (rotation_id, sort_order) do nothing;

insert into youth_activity_rotation_members (rotation_id, group_name, sort_order)
select r.id, m.group_name, m.sort_order
from youth_activity_rotations r
join (values
  ('combined_yw', 'Gatherers of Light', 0),
  ('combined_yw', 'Messengers of Hope', 1),
  ('combined_yw', 'Builders of Faith', 2)
) as m(key, group_name, sort_order) on m.key = r.key
on conflict (rotation_id, sort_order) do nothing;

-- December 2026's Combined YM (planning_group 'Teachers') is a
-- confirmed one-off override, not part of the base cycle -- see
-- PROJECT_CONTEXT.md. The rotation's next_index above already accounts
-- for it (continues as if this month had been 'Deacons').
insert into youth_activities (activity_date, activity_time, title, group_name, planning_group, development_category, status, confirmed)
select v.activity_date::date, '19:00'::time, v.title, v.group_name, v.planning_group, v.development_category, 'draft', false
from (values
  -- Combined YM/YW -- 3rd Wednesday
  ('2026-09-16', 'Youth Conference 18-20 / Temple Trip', 'Combined YM/YW', 'Gatherers of Light', 'Spiritual'),
  ('2026-10-21', 'Capture the Flag', 'Combined YM/YW', 'Teachers', 'Physical/Social'),
  ('2026-11-18', 'Etiquette Dinner', 'Combined YM/YW', 'Messengers of Hope', 'Social/Intellectual'),
  ('2026-12-16', 'Service/Care Packages/Sub for Santa', 'Combined YM/YW', 'Builders of Faith', 'Service'),
  ('2027-01-20', 'Bowling', 'Combined YM/YW', 'Deacons', 'Physical/Social'),
  ('2027-02-17', 'USU Tour', 'Combined YM/YW', 'Priests', 'Intellectual/Social'),
  -- Combined YM -- 1st Wednesday
  ('2026-09-02', 'Internet-based game', 'Combined YM', 'Deacons', 'Intellectual/Social'),
  ('2026-10-07', 'Tour MTC', 'Combined YM', 'Priests', 'Spiritual'),
  ('2026-11-04', 'Glow in the dark Frisbee', 'Combined YM', 'Teachers', 'Physical'),
  ('2026-12-02', 'Indoor hockey', 'Combined YM', 'Teachers', 'Physical'),
  ('2027-01-06', 'Ice fishing', 'Combined YM', 'Deacons', 'Physical/Intellectual'),
  ('2027-02-03', 'Tour Hanks work', 'Combined YM', 'Priests', 'Intellectual'),
  -- Combined YW -- 2nd & 4th Wednesday (December's 4th Wednesday has no
  -- given activity -- a real gap in the source data, left ungenerated)
  ('2026-09-09', 'Post Camp Party', 'Combined YW', 'Messengers of Hope', 'Social'),
  ('2026-09-23', 'Self care / Spa day', 'Combined YW', 'Builders of Faith', 'Social'),
  ('2026-10-14', 'Interior Design night', 'Combined YW', 'Gatherers of Light', 'Intellectual'),
  ('2026-10-28', 'Ward party / Halloween?', 'Combined YW', 'Messengers of Hope', 'Social'),
  ('2026-11-11', 'Volleyball lesson / play Volleyball', 'Combined YW', 'Builders of Faith', 'Physical'),
  ('2026-12-09', '"Bunko" Game activity', 'Combined YW', 'Gatherers of Light', 'Social')
) as v(activity_date, title, group_name, planning_group, development_category)
where not exists (
  select 1 from youth_activities y
  where y.activity_date = v.activity_date::date and y.group_name = v.group_name
);
