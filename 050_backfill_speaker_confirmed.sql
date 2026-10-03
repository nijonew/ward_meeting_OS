-- 050_backfill_speaker_confirmed.sql
--
-- One-time backfill for a real bug just fixed in app code (2026-10-03,
-- the user's own report: a speaker added through the Speakers & Music
-- list "didn't show up in the public view but they did in the
-- conducting view"). Root cause: saveProgramSpeaker
-- (app/meetings/[id]/speakers-music-actions.ts) never set `confirmed`
-- on sacrament_speakers_adults/youth -- a column that was deliberately
-- kept on those two tables (Table Admin queue item 5) and that
-- lib/data/public-view.ts and lib/data/speaker-prayer-history.ts both
-- still filter on (confirmed = true). Every speaker saved through this
-- flow since it shipped (2026-09-09) has silently stayed unconfirmed --
-- invisible to the public program and to the "who's due for a turn"
-- history -- regardless of meeting stage, while showing up fine
-- everywhere else (Conducting, Planning itself), since neither of
-- those filters on it.
--
-- Backfills every existing row that already has a real speaker (a
-- person or a guest name) to confirmed = true, matching "filled in =
-- ready" -- the same rule this app already applies everywhere else a
-- confirm step was intentionally dropped. App code now sets this on
-- every save going forward; this is the matching one-time catch-up for
-- rows saved before that fix.
--
-- Idempotent: only touches rows not already confirmed.

update sacrament_speakers_adults
set confirmed = true
where confirmed is distinct from true
  and (speaker_id is not null or guest_speaker_name is not null);

update sacrament_speakers_youth
set confirmed = true
where confirmed is distinct from true
  and (speaker_id is not null or guest_speaker_name is not null);
