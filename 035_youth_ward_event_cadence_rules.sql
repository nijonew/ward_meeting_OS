-- 035_youth_ward_event_cadence_rules.sql
-- Already run (under number 034) before this branch merged with main;
-- renumbered to 035 since main had independently gone as far as 032 by
-- then. Nothing to re-run here.
--
-- Extends the same cadence-rule + "Generate" mechanism /meeting-schedule
-- already has (weekly / nth-weekday / relative, see lib/data/cadence.ts)
-- to Youth Activities and Ward Events, per the user's request -- reusing
-- the exact same mechanism, nothing extra beyond that.
--
-- Idempotent: uses `create table if not exists`.

create table if not exists youth_activity_schedule_rules (
  id uuid primary key default gen_random_uuid(),
  cadence text not null check (cadence in ('weekly', 'nth_weekday', 'relative')),
  day_of_week integer,
  nth_occurrence integer,
  anchor_day_of_week integer,
  anchor_nth_occurrence integer,
  offset_days integer,
  activity_time time,
  title text not null,
  group_name text not null,
  development_category text,
  location text,
  active boolean not null default true,
  created_at timestamp with time zone not null default now()
);

alter table youth_activity_schedule_rules enable row level security;

drop policy if exists "authenticated read youth_activity_schedule_rules" on youth_activity_schedule_rules;
create policy "authenticated read youth_activity_schedule_rules"
  on youth_activity_schedule_rules for select
  to authenticated
  using (true);

drop policy if exists "authenticated write youth_activity_schedule_rules" on youth_activity_schedule_rules;
create policy "authenticated write youth_activity_schedule_rules"
  on youth_activity_schedule_rules for all
  to authenticated
  using (true)
  with check (true);

create table if not exists ward_event_schedule_rules (
  id uuid primary key default gen_random_uuid(),
  cadence text not null check (cadence in ('weekly', 'nth_weekday', 'relative')),
  day_of_week integer,
  nth_occurrence integer,
  anchor_day_of_week integer,
  anchor_nth_occurrence integer,
  offset_days integer,
  event_time time,
  title text not null,
  location text,
  active boolean not null default true,
  created_at timestamp with time zone not null default now()
);

alter table ward_event_schedule_rules enable row level security;

drop policy if exists "authenticated read ward_event_schedule_rules" on ward_event_schedule_rules;
create policy "authenticated read ward_event_schedule_rules"
  on ward_event_schedule_rules for select
  to authenticated
  using (true);

drop policy if exists "authenticated write ward_event_schedule_rules" on ward_event_schedule_rules;
create policy "authenticated write ward_event_schedule_rules"
  on ward_event_schedule_rules for all
  to authenticated
  using (true)
  with check (true);
