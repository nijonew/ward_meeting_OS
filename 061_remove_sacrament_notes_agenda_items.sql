-- 061_remove_sacrament_notes_agenda_items.sql
--
-- Removes `sacrament_notes` and `sacrament_agenda_items` from the
-- feature catalog (migration `060`, confirmed run) -- the user's own
-- call: Sacrament Meeting has no Minutes/Action Items/Council Notes
-- concept at all (that's a Bishopric Meeting/Ward Council/Youth
-- Council thing) and no agenda-item-submission workflow either
-- (Submit an Agenda Item already excludes Sacrament Meeting from its
-- own dropdown). Both were speculative entries in the original
-- per-meeting-type × per-action matrix, never actually wired to
-- anything real for this one meeting type.
--
-- `calling_features.feature_key` is `references features(key) on
-- delete cascade`, so deleting these two catalog rows also removes
-- any grant of either to any calling automatically -- nothing extra
-- to clean up there.
--
-- Idempotent: safe to re-run.

delete from features where key in ('sacrament_notes', 'sacrament_agenda_items');
