-- "Youth Teaching Planning" renamed to "YM/YW Teaching Planning" on
-- the app's own pages, 2026-11-08 (the user's own request, splitting a
-- plain read-only "Lessons" view out of what used to be one combined
-- viewing+editing page -- see PROJECT_CONTEXT.md's Known open items
-- for the full writeup). This just carries that same display rename
-- into /admin/calling-features' own checklist label -- the underlying
-- feature key (`youth_teaching_planning`) is untouched on purpose, so
-- every existing calling_features grant keeps working exactly as it
-- already does; only the human-readable label shown there changes.

update features set label = 'YM/YW Teaching Planning' where key = 'youth_teaching_planning';
