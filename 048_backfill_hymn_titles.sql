-- 048_backfill_hymn_titles.sql
--
-- Backfills sacrament_music.piece_name from Music Reference
-- (hymnal_songs) wherever a hymn number was already entered but no
-- title ever got typed in alongside it (2026-09-10, the user's own
-- report: "I have hymn numbers that were submitted by date but they
-- weren't submitted with titles"). Root cause: the bulk paste tool at
-- /music (parseBulkMusicText) has always treated the title column as
-- optional per row -- a row with just a date/type/number left
-- piece_name null with nothing to ever fill it in later. Every write
-- path that accepts a bare hymn number now auto-fills the title going
-- forward (see lib/data/hymnal.ts) -- this migration is the matching
-- one-time catch-up for rows that were already saved blank before
-- that existed.
--
-- Matches against the 1985 Hymnal specifically -- every congregational
-- hymn type this app tracks (Opening/Sacrament/Closing/Intermediate
-- Hymn) is sung from that hymnal; Musical Number doesn't carry a
-- hymn_number in any of this app's forms, so this only ever touches
-- genuine hymn rows in practice.
--
-- Idempotent: only ever fills a row that's currently blank (null or
-- whitespace-only), so re-running this after a real title has since
-- been typed in for a row won't overwrite it.

update sacrament_music
set piece_name = hymnal_songs.title
from hymnal_songs
where sacrament_music.hymn_number is not null
  and (sacrament_music.piece_name is null or trim(sacrament_music.piece_name) = '')
  and hymnal_songs.songbook = 'hymns_1985'
  and hymnal_songs.number = sacrament_music.hymn_number::text;
