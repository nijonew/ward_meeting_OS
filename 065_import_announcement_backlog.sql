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
-- Saturday, a Senior Missionary Devotional, a youth choir performance,
-- the Fall self-reliance classes, and Tithing Declaration. None had
-- already ended as of 2026-10-10, so all are inserted
-- `status = 'published'`, matching what submitting each live through
-- the app would have set.
--
-- **Amended in place, same day, before this migration was ever run**
-- (the user's own two follow-ups, so no new migration number needed --
-- same precedent as migration 047's own in-place amendment):
--   - The youth choir row's title/body/dates were rewritten from the
--     real flyer the user shared (a "Walk With Me" Stake Conference
--     Youth Choir Performance flyer): the earlier placeholder title,
--     "Youth Chior" (the typo, kept verbatim from the original tracking
--     form's own short title field), is corrected to "Youth Choir
--     Performance" now that there's an authoritative source for it, not
--     an unrequested copy-edit -- the body gained both real practice
--     dates (Oct 25 and Nov 1, 2:15 PM, Stake Center) and the actual
--     Nov 8 performance date (Stake Conference's general session),
--     which the original tracking-form row never had at all.
--   - Super Saturday's body lost its own "Attached file: <url>" line --
--     see the public announcements page's own comment (app/announcements/
--     public/page.tsx) for why: the user asked that page to stop
--     showing a literal "attached file" reference, and there's nowhere
--     else in this schema to put a second link alongside the real
--     link_url (the crafts sign-up sheet) already carries.
--   - Tithing Declaration's `link_url` is now a real Google Calendar
--     appointment-scheduling link, decoded from a QR code image the
--     user shared directly (the Google Form export itself had no link
--     for this row at all) -- matches the body's own existing "Sign up
--     digitally" line, which previously had nothing to point to.
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
-- 031's own comment) -- where the export's own attached-file link had
-- a value and link_url was otherwise empty, it's folded into link_url
-- directly (3 of 6 rows); where link_url already held a different,
-- real link (Super Saturday had both a sign-up spreadsheet link and a
-- separate attached flyer), the attachment link is simply dropped --
-- see the amendment note above.
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

Craft info and sign up:',
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
      'Youth Choir Performance',
      'The Stake Presidency has asked that we have a youth choir performance for the general session of Stake Conference. Stake Conference is November 8. We will be singing the 2026 Youth Theme, "Walk With Me."

Practice dates:
Saturday, October 25th, 2:15 PM
Saturday, November 1st, 2:15 PM
Stake Center

All youth who are interested in singing are invited to come to these practices! If you can only make one practice, we would still love for you to come, even though being at both is ideal.

We’d love to get as many youth as possible, so please spread the word and reminders!',
      'travjstew19@gmail.com',
      'Stake', 'Single Event', 'All Youth', 'Bishopric Meeting, All YM, All YW',
      date '2026-10-25', time '14:15', date '2026-11-08', null::time,
      'Stake Center',
      null,
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
      null,
      'https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ0HkXFGpjqSOVTunLkpNj-95d09rx6afXFzGqXy5Q8tMku0rLT7JPb1L7QjmZT9DDCxkpK3UcnC',
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
