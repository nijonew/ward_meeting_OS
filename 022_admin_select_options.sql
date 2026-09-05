-- 022_admin_select_options.sql
--
-- Admin-editable option lists for select fields the app used to hardcode
-- (starting with calling_planning.calling_status / release_status).
-- lib/data/select-options.ts reads from this table at render time, with
-- the app's original hardcoded list as a fallback if a field_key has no
-- rows here yet -- so a field never ends up with zero choices.
--
-- Idempotent: safe to re-run. Uses `create table if not exists` (not
-- drop+recreate) and `on conflict do nothing` for the seed data
-- specifically so re-running this after admins have already customized
-- the lists (added/removed/renamed an option) doesn't wipe that out.

create table if not exists admin_select_options (
  id uuid primary key default gen_random_uuid(),
  field_key text not null,
  value text not null,
  label text not null,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  unique (field_key, value)
);

alter table admin_select_options enable row level security;

drop policy if exists "authenticated read admin_select_options" on admin_select_options;
create policy "authenticated read admin_select_options"
  on admin_select_options for select
  to authenticated
  using (true);

drop policy if exists "authenticated write admin_select_options" on admin_select_options;
create policy "authenticated write admin_select_options"
  on admin_select_options for all
  to authenticated
  using (true)
  with check (true);

-- Seed with today's hardcoded values (see lib/data/calling-planning.ts
-- DEFAULT_CALLING_STATUSES / DEFAULT_RELEASE_STATUSES) so switching the
-- app over to reading from this table is a no-op on day one.
insert into admin_select_options (field_key, value, label, sort_order) values
  ('calling_planning.calling_status', 'discussing', 'Discussing', 0),
  ('calling_planning.calling_status', 'future', 'Future', 1),
  ('calling_planning.calling_status', 'declined', 'Declined', 2),
  ('calling_planning.calling_status', 'to_announce', 'To Announce in Sacrament', 3),
  ('calling_planning.calling_status', 'to_be_set_apart', 'To Be Set Apart', 4),
  ('calling_planning.calling_status', 'to_record', 'To Record', 5),
  ('calling_planning.calling_status', 'complete', 'Complete', 6),
  ('calling_planning.release_status', 'previously_vacant', 'Previously Vacant', 0),
  ('calling_planning.release_status', 'discussing', 'Discussing', 1),
  ('calling_planning.release_status', 'to_announce', 'To Announce in Sacrament', 2),
  ('calling_planning.release_status', 'to_record', 'To Record', 3),
  ('calling_planning.release_status', 'complete', 'Complete', 4)
on conflict (field_key, value) do nothing;
