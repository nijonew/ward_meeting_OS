-- 065_import_announcement_backlog.sql
--
-- One-time bulk import of real Google Form announcement responses the
-- ward had already collected before ever routing submissions through
-- this app -- pasted directly by the user 2026-10-10, in the exact
-- field layout (Timestamp, Email Address, organization, audience,
-- where-announced, type, title, description, start/end date+time,
-- location, link, attached file) that app/submit/actions.ts /
-- AnnouncementForm.tsx were themselves built from (2026-09-05, see
-- PROJECT_CONTEXT.md). Six rows: an ice cream activity, Super
-- Saturday, a Senior Missionary Devotional, Youth Choir (kept as
-- typed in the source, "Youth Chior"), the Fall self-reliance
-- classes, and Tithing Declaration. None had already ended as of
-- 2026-10-10, so all are inserted `status = 'published'`, matching
-- what submitting each live through the app would have set.
--
-- Column mapping, straight off the form's own fields:
--   organization/audience/where_announced/announcement_type -- copied
--     from the export as-is; every value already matches an option in
--     this app's own ANNOUNCEMENT_ORGANIZATIONS/_AUDIENCES/_WHERE/_TYPES
--     lists (lib/data/announcement-constants.ts) with no "Other"
--     free-text needed. announcement_type is the one field normalized
--     from the export's full radio label down to the short value this
--     app actually stores -- "Single Event (scheduled meeting,
--     activity, etc.)" -> "Single Event", "Ongoing Event (long term
--     class)" -> "Ongoing Event" -- so it reads the same as any
--     announcement submitted live through the app, not a longer
--     one-off string.
--   start/end date & time -- written as explicit date/time literals
--     regardless of this database's own DateStyle setting, to avoid
--     any M/D vs D/M ambiguity.
--   submitted_by_email -- the export's own "Email Address" column
--     (the responder's Google account email, auto-captured by the
--     form itself, not something they typed in). No name was ever
--     captured in this export, so submitted_by_name (NOT NULL) falls
--     back to that same email -- matching this app's own existing
--     "no display name -> use the email" fallback in submitAnnouncement.
--   created_at -- the export's own submission Timestamp, so each row
--     keeps its real historical submission time rather than showing
--     whenever this migration happened to be run.
--
-- This app has no "attach a file" column at all (deliberately skipped
-- when the richer announcement fields were first built, see migration
-- 031's own comment) -- where the export's own attached-file link has
-- a value, it's folded into link_url when that field was otherwise
-- empty (4 of 6 rows), or appended as its own line in the body when
-- link_url already held a different, real link (Super Saturday had
-- both a sign-up spreadsheet link and a separate attached flyer).
--
-- Idempotent: guarded by title + start_date, so re-running this after
-- it already succeeded adds nothing a second time.

insert into announcements (
  title, body, submitted_by_name, submitted_by_email, status,
  organization, announcement_type, audience, where_announced,
  start_date, start_time, end_date, end_time, location, link_url,
  created_at
)
select v.title, v.body, v.email, v.email, 'published',
       v.organization, v.announcement_type, v.audience, v.where_announced,
       v.start_date, v.start_time, v.end_date, v.end_time, v.location, v.link_url,
       v.created_at
from (
  values
    (
      'SYRACUSE STAKE 36+ SINGLES ACTIVITY',
      'ICE CREAM ACTIVITY. Please come join us for ice cream and visiting as we get to know other singles in our stake.',
      'markdy5@gmail.com',
      'Stake', 'Single Event', 'Single Adults 36-45, Single Adults 46+',
      'Ward Communications (Printed, Weekly Email, Social Media, etc.)',
      date '2026-10-12', time '19:00', date '2026-10-12', null::time,
      'THURGOOD''S CREAMERY 2432 W 1700 S SYRACUSE',
      'https://drive.google.com/open?id=1mK8x4JEx5k1yBj1HnHZ52HChFb7kFKE6',
      timestamp '2026-10-01 19:39:19'
    ),
    (
      'Super Saturday',
      'Hi Ladies! Super Saturday is coming up Saturday, October 24th 10-2! There will be multiple crafts, food, and soda bar. Come to make crafts, just hangout, or if you can’t stay too long just come drop by and grab some lunch! We’d love to see you all💛

Here is the link for the crafts sign up so we can prep the materials a head of time. Sign up on the link or text me or Kimberly Packer which crafts you want to do and we’ll mark you down! My number is (480) 550-1524 (for any and all questions)

Craft info and sign up:

Attached file: https://drive.google.com/open?id=17l8Kd9yr0eSkc4Rjc9P_ShheophB0Y9N',
      'travjstew19@gmail.com',
      'Relief Society', 'Single Event', 'Relief Society', 'Relief Society Class',
      date '2026-10-24', time '10:00', date '2026-10-24', time '14:00',
      'Cultural hall',
      'https://docs.google.com/spreadsheets/d/13jg5P3k4dSnO-nZPfXHXus5AA0xf32BS1TAqcyMSUD8/edit?usp=sharing',
      timestamp '2026-10-09 13:36:43'
    ),
    (
      'Senior Missionary Devotional',
      'More information to follow',
      'markdy5@gmail.com',
      'Stake', 'Single Event', 'Whole Ward',
      'Bishopric Meeting, Ward Council Meeting, Relief Society Class, Elders Quorum Class, Sunday School - Gospel Doctrine Class, Ward Communications (Printed, Weekly Email, Social Media, etc.)',
      date '2026-10-25', time '18:00', date '2026-10-25', null::time,
      null, null,
      timestamp '2026-08-09 18:59:40'
    ),
    (
      'Youth Chior',
      'Youth choir practices and participation for stake conference',
      'travjstew19@gmail.com',
      'Stake', 'Single Event', 'All Youth', 'Bishopric Meeting, All YM, All YW',
      date '2026-10-25', time '14:15', date '2026-10-25', time '15:15',
      'Stake Center',
      'https://drive.google.com/open?id=1ACV9JHu1W6TCABg0VSpmD9vpGgCBrVMI',
      timestamp '2026-10-06 16:05:12'
    ),
    (
      'Weekly Self Reliance Classes',
      'This Fall, our Stake will be offering two self-reliance classes: Personal Finances and Education for Better Work.',
      'markdy5@gmail.com',
      'Stake', 'Ongoing Event', 'All Adults',
      'Ward Council Meeting, Ward Communications (Printed, Weekly Email, Social Media, etc.)',
      date '2026-09-06', time '15:00', date '2026-11-22', null::time,
      '1525 building (1112 S 1525 W, Syracuse, UT 84075)',
      null,
      timestamp '2026-08-15 12:22:34'
    ),
    (
      'Tithing Declaration',
      'Full families are encouraged to attend together. Sign up digitally or contact Mark Young',
      'markdy5@gmail.com',
      'Bishopric', 'Ongoing Event', 'Whole Ward',
      'Ward Communications (Printed, Weekly Email, Social Media, etc.)',
      date '2026-09-20', null::time, date '2026-12-06', null::time,
      null, null,
      timestamp '2026-08-30 08:46:51'
    )
) as v (
  title, body, email, organization, announcement_type, audience, where_announced,
  start_date, start_time, end_date, end_time, location, link_url, created_at
)
where not exists (
  select 1 from announcements a
  where a.title = v.title and a.start_date = v.start_date
);
