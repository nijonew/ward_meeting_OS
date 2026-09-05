-- 023_sacrament_music_auto_approve.sql
--
-- Removes the manual "Approved" step for Sacrament Meeting Music.
-- Previously every music item started as status='pending' and had to be
-- checked "Approved" in the meeting's Music planning view (or it never
-- appeared on the printed/public program). Going forward, everything is
-- treated as approved the moment it's entered -- the app no longer has
-- a control that sets status to anything other than 'published'.
--
-- Idempotent: safe to re-run. Changing a column default is a no-op if
-- already set; the data backfill only touches rows still sitting in
-- 'pending' (there should be none left after the first run).

alter table sacrament_music alter column status set default 'published';

-- Backfill: flip any pre-existing pending rows. Without this, anything
-- entered before this migration would stay invisible on the public
-- program forever, since there's no more UI control to approve it.
update sacrament_music set status = 'published' where status = 'pending';
