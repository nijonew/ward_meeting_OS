-- 051_sacrament_music_hymn_number_as_text.sql
--
-- Changes sacrament_music.hymn_number from integer to text (2026-10-03,
-- the user's own request: distinguish Children's Songbook numbers from
-- the 1985 Hymnal's by typing a "C" prefix, e.g. "C20" vs "220" -- an
-- integer column can't hold a letter prefix. Same fix hymnal_songs.number
-- already needed for its own lettered variants (migration 026) -- same
-- idiom, applied here for the same reason.
--
-- Idempotent: safe to re-run (alter ... type is a no-op once already text).

alter table sacrament_music alter column hymn_number type text using hymn_number::text;
