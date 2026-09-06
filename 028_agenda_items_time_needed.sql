-- 028_agenda_items_time_needed.sql
--
-- Adds a "how much time do you need" field to agenda_items, matching
-- the real public agenda-item form the ward already uses (fetched and
-- confirmed 2026-09-05: Email, Name, Desired Meeting, Date of Meeting,
-- Description, and time needed -- 1-2 / 3-5 / 6+ minutes).
--
-- Idempotent: safe to re-run.

alter table agenda_items add column if not exists time_needed text;
