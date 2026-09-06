-- 031_announcements_richer.sql
--
-- Rebuilds the public announcement-submission workflow ("adding an
-- announcement of an upcoming event") to match Heritage Ward's real
-- announcement form. The linked Google Form 401'd on every WebFetch
-- attempt, so the user pasted its actual field list directly
-- (2026-09-05) -- see PROJECT_CONTEXT.md. The old `announcements` table
-- only had title/body, far thinner than the real form, which also asks
-- for the originating organization, target audience, where it should
-- be announced, an announcement type, an optional date/time range, a
-- location, and a link.
--
-- `audience` and `where_announced` are the form's checkbox
-- (multi-select) questions -- stored as a single comma-joined text
-- column rather than a real Postgres array, since the generic Table
-- Admin engine (lib/admin/types.ts) has no multi-select column type
-- yet and this is a two-column, not-yet-common need, not worth a new
-- engine feature on its own. `organization` and `announcement_type` are
-- the form's radio (single-select) questions, per the user's own
-- radio-vs-checkbox rule (2026-09-05) -- both stored as plain text
-- (not a `select`-typed admin column) so a submitter's free-text
-- "Other" answer isn't stranded outside a fixed option list.
--
-- File attachment (the form's last question) is deliberately NOT
-- built -- the user asked to skip file sharing for now; would need
-- Supabase Storage plus an upload UI, a separate piece of work.
--
-- Idempotent: safe to re-run.

alter table announcements add column if not exists organization text;
alter table announcements add column if not exists audience text;
alter table announcements add column if not exists where_announced text;
alter table announcements add column if not exists announcement_type text;
alter table announcements add column if not exists start_date date;
alter table announcements add column if not exists start_time time;
alter table announcements add column if not exists end_date date;
alter table announcements add column if not exists end_time time;
alter table announcements add column if not exists location text;
alter table announcements add column if not exists link_url text;
