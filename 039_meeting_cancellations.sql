-- 039_meeting_cancellations.sql
--
-- Generalized from an earlier "conference schedule" design per the
-- user's own follow-up (2026-09-06): "there are other specific
-- holidays and events where sacrament meeting is held but other
-- meetings on that day should be cancelled... a date, a reason, and a
-- list of meeting cancellations for the date." Rather than a fixed
-- General/Stake Conference enum with hardcoded cancellation rules per
-- type, this is a general-purpose date range + reason + an
-- admin-chosen list of which meeting types (and optionally youth
-- activities) get cancelled -- General Conference and Stake Conference
-- become two examples an admin enters, not two hardcoded cases in
-- application code. See lib/data/meeting-cancellations.ts for the
-- actual sweep logic and PROJECT_CONTEXT.md for the full design
-- history.
--
-- Idempotent: safe to re-run.

create table if not exists meeting_cancellations (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date not null,
  reason text not null,
  meeting_type_slugs text[] not null default '{}',
  cancel_youth_activities boolean not null default false,
  created_at timestamp with time zone not null default now()
);

alter table meeting_cancellations enable row level security;

drop policy if exists "authenticated read meeting_cancellations" on meeting_cancellations;
create policy "authenticated read meeting_cancellations"
  on meeting_cancellations for select
  to authenticated
  using (true);

drop policy if exists "authenticated write meeting_cancellations" on meeting_cancellations;
create policy "authenticated write meeting_cancellations"
  on meeting_cancellations for all
  to authenticated
  using (true)
  with check (true);
