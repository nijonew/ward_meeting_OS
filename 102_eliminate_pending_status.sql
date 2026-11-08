-- "Pending" removed from the announcements/agenda_items status
-- vocabulary entirely, 2026-11-08 (the user's own words: "let's
-- eliminate the pending state in all places. That assumes someone
-- will gate it forward. That isn't going to happen regularly.").
--
-- Neither table's own real submission path (submitAnnouncement,
-- submitAgendaItem, both in app/submit/actions.ts) has ever created a
-- "pending" row -- both have always published immediately -- so
-- "Pending" only ever existed as a manually-settable value in Table
-- Admin/Manage Announcements' own Status dropdown (SUBMISSION_STATUSES,
-- lib/admin/registry.ts), with nothing in the app that ever moves a
-- row back out of it automatically. One real announcement was found
-- stuck there in production.
--
-- One-time, idempotent: flips any row still sitting at 'pending' in
-- either table to 'published' (the behavior every real submission
-- already defaults to) now that the option itself is gone from both
-- grids' own Status dropdowns -- without this, that one row would
-- just show its Status cell as blank/unselected forever, since the
-- dropdown no longer has a matching option to display it with.

update announcements set status = 'published' where status = 'pending';
update agenda_items set status = 'published' where status = 'pending';
