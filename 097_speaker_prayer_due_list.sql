-- 097_speaker_prayer_due_list.sql
--
-- "Due" list for Speaker & Prayer History, 2026-11-01 -- a real, new
-- design, not a revival of the computed "Due" lists the user had
-- removed on 2026-10-30. The user's own words, once asked how a due
-- list should actually work here: "the intent is that when a member
-- of the bishopric is looking at the list of people and when they
-- last spoke they can easily identify who they might want to reach
-- out to. How about we add a checkbox next to someone's listing so
-- that they can be added to a curated list of who is due. That list
-- should appear next to the overall list with people who are
-- checked."
--
-- Manually curated, not computed -- a person is "due" exactly when an
-- admin has checked them, independent of how long it's actually been
-- since their last turn. Scoped per category (speaker_adult/
-- speaker_youth/prayer, the same three splits /speaker-prayer-history
-- already renders as its own three history cards) since someone could
-- be due to speak but not due to pray, or vice versa.
--
-- Idempotent: safe to re-run.

create table if not exists speaker_prayer_due_list (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  category text not null,
  created_at timestamptz not null default now(),
  unique (person_id, category)
);

alter table speaker_prayer_due_list enable row level security;

drop policy if exists "authenticated access" on speaker_prayer_due_list;
create policy "authenticated access"
  on speaker_prayer_due_list for all
  to authenticated
  using (true)
  with check (true);
