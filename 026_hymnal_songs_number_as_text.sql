-- 026_hymnal_songs_number_as_text.sql
--
-- Fixes a design mistake from migration 024: hymnal_songs.number was
-- created as `integer`, but real numbering in these collections includes
-- lettered variants -- companion pieces, rounds, or alternate verses
-- sharing a base number (e.g. Children's Songbook #20 "A Song of
-- Thanks" and #20b "Thanks to Our Father" are two different songs).
-- An integer column can't hold "20b", and stripping the letter to fit
-- would collide two different songs onto the same (songbook, number)
-- unique key. Changing to text before any real data goes in.
--
-- Idempotent: safe to re-run (alter ... type is a no-op once already text).

alter table hymnal_songs alter column number type text using number::text;
