-- 071_feedback_widget.sql
--
-- The persistent "suggest a fix or an upgrade" widget the user asked
-- for -- a real home for feedback about the app itself, reviewed from
-- Table Admin during a coding session rather than living only in chat.
-- See the approved plan (elegant-wishing-fountain) for the full design
-- writeup; summary: a bug/fix report is a priority as soon as it's
-- filed, a suggestion needs the user's own approval (a Status change)
-- before it's fair game to build.
--
-- No CHECK constraint on type/status -- deliberately, after this
-- repo's own calling_planning CHECK-constraint incident (migrations
-- 067/068): Table Admin's `select` column type constrains the UI
-- dropdown instead, matching `announcements.status`'s precedent.
--
-- Idempotent: safe to re-run.

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  body text not null,
  page_path text,
  submitted_by_name text,
  submitted_by_email text,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

alter table feedback enable row level security;

drop policy if exists "authenticated access" on feedback;
create policy "authenticated access"
  on feedback for all
  to authenticated
  using (true)
  with check (true);

-- Table Admin feature catalog row -- the review/management gate.
-- Nobody gets it automatically; grant it to whichever calling(s)
-- should triage feedback via /admin/calling-features, same one-time
-- bootstrapping step every new feature needs.
insert into features (key, label, category, sort_order) values
  ('table_admin_feedback', 'Feedback', 'Table Admin', 22)
on conflict (key) do nothing;
