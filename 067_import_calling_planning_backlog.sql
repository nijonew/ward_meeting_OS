-- 067_import_calling_planning_backlog.sql
--
-- One-time bulk import of the ward's real calling-tracker spreadsheet
-- into calling_planning -- 119 source rows pasted directly by the user
-- 2026-10-10 (Sort, Date Initiated, Calling, Full Name, Status, Date
-- Set Apart, Notes, Full Name2, Status2 -- "New Callings" / "To Be
-- Released" side by side). Depends on migration 066
-- (calling_planning_status_vocabulary) having already run, since this
-- migration writes calling_status/release_status values from that
-- same new vocabulary.
--
-- Three steps, matching this app's own existing conventions:
--   1. Create any `calling` not already in the roster (case-insensitive
--      exact-name match) -- 79 distinct calling names in this sheet.
--   2. Create any `people` row not already in the roster, same
--      case-insensitive exact-name pattern as migration 049's bulk
--      import -- 141 distinct names, name-only (no email/age/other
--      PII), `active = true`, `attendance_status = 'attending'`.
--   3. Insert the 123 resulting calling_planning rows (119 source rows,
--      two with two calling titles in one cell and two with two
--      release names in one cell -- see below), resolving calling/
--      person names to ids via steps 1-2's tables by join/subquery
--      rather than hardcoded ids (this assistant has no live database
--      access, so every lookup has to happen at migration-run time
--      against whatever the real roster turns out to be).
--
-- Status-word mapping (the source sheet's free text -> this app's real
-- value keys from migration 066), confirmed with the user before this
-- file was written:
--   Calling status: Complete->complete, Future->future,
--   Needed->needed, In discussion->discussing (labeled "In Review"),
--   Hold->hold, Approved->approved, Interview Set->interview_set,
--   To be Set Apart->to_record (the new vocabulary has no "set apart"
--   stage at all; "To Record" is the closest surviving one -- see
--   lib/data/calling-planning.ts's own comment). A single row with a
--   genuinely blank Status (115, a pure release with nothing decided
--   yet on the new-calling side) defaults to needed.
--   Release status: Complete->complete, Previously Vacant->previously_vacant,
--   To Release->to_be_released, Verbal Release->release_extended,
--   In discussion->to_be_released (no "discussing" stage survives in
--   the new release vocabulary either). A row with a release name but
--   no Status2 at all defaults to to_be_released; a row with neither
--   defaults to previously_vacant.
--
-- Data-quality fixes made while building this (not silent -- flagged
-- here since they're judgment calls on the source data, not just
-- mechanical transcription):
--   - Rows 20 ("Ward Social Media Specialist, Ward Bulletin Board
--     Specialist") and 113 ("Email Communication Specialist, Ward
--     Bulletin Specialist") each name two real, distinct callings in
--     one cell -- split into two calling_planning rows apiece rather
--     than invented as one fake combined calling.
--   - Rows 68 ("Bryce Gates, Ashley Gates") and 95 ("Cory Hardman,
--     Jeremy Hardman") each name two real people being released
--     together in the single release-name cell -- release_person_id
--     is a single FK, so these also split into two rows apiece (same
--     calling/candidates/status/notes, one release person each)
--     rather than being inserted as one bogus "Bryce Gates, Ashley
--     Gates"-named person.
--   - Row 47's own Full Name2 cell read "called to CTR 4&5 class" --
--     not a person, clearly a copy/paste slip from row 45's Notes
--     text for the same calling (which already carries that exact
--     note). Treated as blank rather than inserted as a fabricated
--     "person."
--   - A handful of Date Set Apart values were partial/non-standard
--     ("1-18", "Jan18", "Jan 18", "2/1", "4/21") -- resolved to full
--     ISO dates from each row's own Date Initiated context (all
--     unambiguous within this sheet's own Nov 2025 - Sep 2026 window).
--
-- Idempotent: the callings/people steps use the same "insert only what
-- doesn't already exist, matched case-insensitively by trimmed name"
-- pattern as migration 049. The calling_planning step guards on
-- (calling_id, date_initiated, notes) -- not a perfect natural key, but
-- enough to stop a retried/partial run from double-inserting, which is
-- the realistic failure mode for a migration this size; it was not
-- designed to detect an admin's own later manual entry that happens to
-- coincide with one of these historical rows.

insert into callings (name, active)
select v.name, true
from (values
  ('Choir Accompanist'),
  ('Deacons Quorum Adviser'),
  ('Deacons Quorum First Counselor'),
  ('Deacons Quorum President'),
  ('Deacons Quorum Second Counselor'),
  ('Deacons Quorum Secretary'),
  ('Elders Quorum President'),
  ('Email Communication Specialist'),
  ('Gospel Doctrine Teacher'),
  ('History Specialist'),
  ('Music Coordinator'),
  ('Priest Quorum First Assistant'),
  ('Priest Quorum Second Assistant'),
  ('Priests Quorum Adviser'),
  ('Priests Quorum Secretary'),
  ('Priests Quorum Specialist - Camp Coordinator'),
  ('Primary Activities Girls'),
  ('Primary First Counselor'),
  ('Primary Music Leader'),
  ('Primary President'),
  ('Primary Second Counselor'),
  ('Primary Secretary'),
  ('Primary Teacher'),
  ('Primary Teacher - CTR 4, CTR 5'),
  ('Primary Teacher - CTR 6'),
  ('Primary Teacher - Nursery Class'),
  ('Primary Teacher - Sunbeam Class'),
  ('Primary Teacher - Valiant 10'),
  ('Primary Teacher - Valiant 7'),
  ('Primary Teacher - Valiant 8'),
  ('Primary Teacher - Valiant 9'),
  ('Relief Society Activity Committee Member'),
  ('Relief Society Activity Coordinator'),
  ('Relief Society Assistant Service Coordinator'),
  ('Relief Society First Counselor'),
  ('Relief Society Pianist'),
  ('Relief Society President'),
  ('Relief Society Second Counselor'),
  ('Relief Society Secretary'),
  ('Relief Society Service Committee Member'),
  ('Relief Society Service Coordinator'),
  ('Relief Society Teacher'),
  ('Self-Reliance Specialist'),
  ('Single Adult Representative'),
  ('Sunday School Teacher'),
  ('Teachers Quorum Adviser'),
  ('Teachers Quorum First Counselor'),
  ('Teachers Quorum President'),
  ('Teachers Quorum Second Counselor'),
  ('Teachers Quorum Secretary'),
  ('Technology Specialist'),
  ('Temple Prep. Teacher'),
  ('Valiant Activities Leader'),
  ('Ward Assistant Executive Secretary'),
  ('Ward Bulletin Board Specialist'),
  ('Ward Bulletin Specialist'),
  ('Ward Social Media Specialist'),
  ('Ward Temple and Family History Consultant'),
  ('Ward Temple and Family History Leader'),
  ('Young Single Adult Leader'),
  ('Young Women Class Adviser'),
  ('Young Women Class First Counselor - 12-13'),
  ('Young Women Class First Counselor - 14-15'),
  ('Young Women Class First Counselor - 16-18'),
  ('Young Women Class President - 12-13'),
  ('Young Women Class President - 14-15'),
  ('Young Women Class President - 16-18'),
  ('Young Women Class Second Counselor'),
  ('Young Women Class Second Counselor - 12-13'),
  ('Young Women Class Second Counselor - 14-15'),
  ('Young Women Class Second Counselor - 16-18'),
  ('Young Women Class Secretary - 12-13'),
  ('Young Women Class Secretary - 14-15'),
  ('Young Women Class Secretary - 16-18'),
  ('Young Women President'),
  ('Young Women Second Counselor'),
  ('Young Women Specialist'),
  ('Young Women Specialist - Camp Director'),
  ('Youth Camp Leader - Young Women')
) as v(name)
where not exists (
  select 1 from callings c where lower(trim(c.name)) = lower(trim(v.name))
);

insert into people (name, active, attendance_status)
select v.name, true, 'attending'
from (values
  ('Aaron Chamberlain'),
  ('Addelyn Jane King'),
  ('Addelyn King'),
  ('Alexander Daniel Solomon'),
  ('Amber King'),
  ('Amy Marie Honsvick'),
  ('Anne Wilkinson'),
  ('Arick Sorensen'),
  ('Arick Trent Sorensen'),
  ('Ashley Gates'),
  ('Ashlyn Welch'),
  ('Baylie Griffin'),
  ('Beckham Zaugg'),
  ('Becky Snarr'),
  ('Ben Allen'),
  ('Benjamin Lund'),
  ('Brent Zimmerman'),
  ('Bryce Gates'),
  ('Bryce Young'),
  ('Brynna Smith'),
  ('Carlee King'),
  ('Chaylyn Miles'),
  ('Christine Earl'),
  ('Chuck Vaughan'),
  ('Colten Bingham'),
  ('Colten Jared Bingham'),
  ('Colton Miles'),
  ('Cory Hardman'),
  ('Curt King'),
  ('Dalton Griffin'),
  ('Danielle Bennett'),
  ('Darin Zaugg'),
  ('Dean Kreger'),
  ('Denise Krauss'),
  ('Devin Jenkins'),
  ('Eli Packer'),
  ('Elijah Bruce Packer'),
  ('Elisabeth Anne Nebeker'),
  ('Elisabeth Nebeker'),
  ('Elise Nemrow'),
  ('Ellis Gates'),
  ('Emery Young'),
  ('Emily Adams'),
  ('Emma Rose Brunson'),
  ('Ethan Taylor'),
  ('Gavin Wycherly'),
  ('Hajnalka Olsen'),
  ('Hanna Olsen'),
  ('Heidi Brophy'),
  ('Heidi Merritt'),
  ('Henry Newbold'),
  ('Holly Dawn Lund'),
  ('Holly Lund'),
  ('Jace Eric Jones'),
  ('Jack Taylor Beutler'),
  ('Jacob Brunson'),
  ('Jacob Packer'),
  ('Jared Hiatt'),
  ('Jaylen Linsley'),
  ('Jennifer Zaugg'),
  ('Jeremy Cardon'),
  ('Jeremy Hardman'),
  ('Jessica Brunson'),
  ('John Hernandez'),
  ('Joseph Alan Nemrow'),
  ('Joshua Snarr'),
  ('Joyce Kearl'),
  ('Joyce Marie Kearl'),
  ('Kara Bott'),
  ('Karen La Ree Andreasen'),
  ('Kasey Allen Krauss'),
  ('Kassidy Weiss'),
  ('Kathy Smith'),
  ('Kaylie Jones'),
  ('Kelly Graham'),
  ('Kelly M Graham'),
  ('Kelsey Brown'),
  ('Kevin Bott'),
  ('Kimberly Packer'),
  ('La Ree Andreasen'),
  ('Landon Bott'),
  ('Lauren Reay Solomon'),
  ('Lorelei Bennett'),
  ('Lori Vaughan'),
  ('Lorie Newbold'),
  ('Lucy Hardman'),
  ('Lydia Chamberlain'),
  ('Lyndsey Griffin'),
  ('Lyndzi Packer'),
  ('Macoll Sorensen'),
  ('Madilyn Christine Zimmerman'),
  ('Madilyn Zimmerman'),
  ('Mallory Rhen Smith'),
  ('Mallory Smith'),
  ('Malynn Young'),
  ('Marie Young'),
  ('Marlene Merkling'),
  ('McKenzie Zimmerman'),
  ('Melanie Anderson'),
  ('Melisa Hiatt'),
  ('Naomi Faith Smith'),
  ('Naomi Smith'),
  ('Natalie Gerlach'),
  ('Nicole King'),
  ('Nixon J Rappleye'),
  ('Nora Gerlach'),
  ('Oakley Bott'),
  ('Olivia Hiatt'),
  ('Pamela Eileen Gerlach'),
  ('Parker Zaugg'),
  ('Peyton Sellers'),
  ('Preston Merritt'),
  ('Rachel Nemrow'),
  ('Rebecca Ellen Rhodes'),
  ('Rebekah Ann Snarr'),
  ('River Hull'),
  ('Ron Francis'),
  ('Russell Howell'),
  ('Ryan Snarr'),
  ('Sally Francis'),
  ('Scott Merritt'),
  ('Scott Thorne'),
  ('Shane Dee Amidan'),
  ('Shauna Millgate'),
  ('Shauntae Rose Engberg'),
  ('Shayne Bingham'),
  ('Shelly Thorne'),
  ('Spencer Jason Gerlach'),
  ('Steve Brown'),
  ('Steven Kearl'),
  ('Stockton Hall'),
  ('Susy Warburton'),
  ('Tandon Mark Packer'),
  ('Tandon Packer'),
  ('Tanner Linsley'),
  ('Teresa Kreger'),
  ('Toni Wycherly'),
  ('Travis Stewart'),
  ('Walter Krauss'),
  ('Wayne Taylor'),
  ('Zane Bott')
) as v(name)
where not exists (
  select 1 from people p where lower(trim(p.name)) = lower(trim(v.name))
);

insert into calling_planning (
  calling_id, date_initiated, candidate_person_ids, calling_status,
  date_set_apart, release_person_id, release_status, notes
)
select
  c.id,
  v.date_initiated,
  coalesce(
    (select array_agg(p.id order by p.name) from people p where lower(trim(p.name)) = any(
      select lower(trim(x)) from unnest(v.candidate_names) as x
    )),
    '{}'::uuid[]
  ),
  v.calling_status,
  v.date_set_apart,
  (select p2.id from people p2 where lower(trim(p2.name)) = lower(trim(v.release_name))),
  v.release_status,
  v.notes
from (values
  ('Primary President', '2025-11-23', array['Kathy Smith']::text[], 'complete', null, 'Lorie Newbold', 'complete', 'Set apart by Bishop 12/28/2025'),
  ('Primary First Counselor', '2025-11-23', array['Holly Dawn Lund']::text[], 'complete', null, 'Kathy Smith', 'complete', 'Set apart by Bishopric 12/28/2025'),
  ('Primary Second Counselor', '2025-11-23', array['Heidi Merritt']::text[], 'complete', null, 'Emily Adams', 'complete', 'Set apart by Bishopric 12/28/2025'),
  ('Primary Secretary', '2025-11-23', array['Emily Adams']::text[], 'complete', null, 'Jaylen Linsley', 'complete', 'Set Apart by Andrew Bott Jann 4th'),
  ('Young Women Second Counselor', '2025-11-23', array['Joyce Marie Kearl']::text[], 'complete', null, 'Rebekah Ann Snarr', 'complete', 'Requested by Shauna set apart by bishop on 12/14/25'),
  ('Self-Reliance Specialist', '2025-11-23', array['Tandon Mark Packer']::text[], 'complete', null, 'Joseph Alan Nemrow', 'complete', 'Set Apart by Andrew Bott Jann 4th'),
  ('Ward Assistant Executive Secretary', '2025-11-23', array['Arick Sorensen']::text[], 'complete', null, null, 'previously_vacant', null),
  ('Relief Society Pianist', null, array['Kassidy Weiss']::text[], 'complete', null, null, 'previously_vacant', 'Set apart by Joe Nemrow 11/30'),
  ('Relief Society President', '2025-12-07', array['Jennifer Zaugg']::text[], 'complete', '2026-02-22', 'Susy Warburton', 'complete', 'Early 2026'),
  ('Relief Society First Counselor', '2025-12-07', array['Heidi Brophy']::text[], 'complete', '2026-02-22', 'Lori Vaughan', 'complete', 'coordinate w/ new president'),
  ('Relief Society Second Counselor', '2025-12-07', array['Kimberly Packer']::text[], 'complete', '2026-02-22', 'Melanie Anderson', 'complete', 'coordinate w/ new president'),
  ('Relief Society Secretary', '2025-12-07', array['Melisa Hiatt']::text[], 'complete', null, 'La Ree Andreasen', 'complete', 'coordinate w/ new president'),
  ('Sunday School Teacher', '2025-12-07', array['Becky Snarr']::text[], 'complete', null, 'Carlee King', 'complete', 'Set apart 4/11/25 course 14, course 15 - Currently teaching with Sister Sellars'),
  ('Relief Society Activity Committee Member', '2025-12-21', array['Rebecca Ellen Rhodes']::text[], 'complete', null, null, 'previously_vacant', 'Rebecca was called in prior bishopric not sure if set apart. Still not recorded.Inserted by Mark'),
  ('Relief Society Activity Committee Member', '2025-12-21', array['Elisabeth Anne Nebeker']::text[], 'complete', null, null, 'previously_vacant', 'Elisabeth was called in prior bishopric not sure if set apart. Still not recorded.Inserted by Mark'),
  ('Sunday School Teacher', '2025-12-21', array['Shauntae Rose Engberg']::text[], 'complete', null, null, 'previously_vacant', 'was called in prior bishopric not sure if set apart. Still not recorded.Inserted by Mark gospel doc teacher for younger class'),
  ('Sunday School Teacher', '2025-12-21', array['Spencer Jason Gerlach']::text[], 'complete', null, null, 'previously_vacant', 'was called in prior bishopric not sure if set apart. Still not recorded.Inserted by Mark gospel doc teacher for younger class'),
  ('Young Women Class Second Counselor', '2025-12-21', array['Naomi Faith Smith']::text[], 'complete', null, null, 'previously_vacant', '2nd counselor 12/13 class. was called in prior bishopric not sure if set apart. Still not recorded.Inserted by Mark'),
  ('Relief Society Service Coordinator', '2025-12-26', array['Jaylen Linsley']::text[], 'complete', '2026-02-08', null, 'complete', null),
  ('Ward Social Media Specialist', '2025-12-26', array['Toni Wycherly']::text[], 'interview_set', null, null, 'previously_vacant', 'Meetinng Sunday'),
  ('Ward Bulletin Board Specialist', '2025-12-26', array['Toni Wycherly']::text[], 'interview_set', null, null, 'previously_vacant', 'Meetinng Sunday'),
  ('Deacons Quorum Adviser', '2025-12-26', array['Jared Hiatt']::text[], 'complete', '2026-02-22', null, 'previously_vacant', null),
  ('Deacons Quorum President', '2025-12-26', array['Dalton Griffin']::text[], 'complete', null, 'Zane Bott', 'complete', null),
  ('Deacons Quorum First Counselor', '2025-12-26', array['Bryce Young']::text[], 'complete', null, 'Beckham Zaugg', 'complete', null),
  ('Deacons Quorum Second Counselor', '2025-12-26', array['Ellis Gates']::text[], 'complete', null, null, 'complete', null),
  ('Deacons Quorum Secretary', '2025-12-26', array['Landon Bott']::text[], 'complete', null, 'Jack Taylor Beutler', 'complete', null),
  ('Teachers Quorum President', '2025-12-26', array['Preston Merritt']::text[], 'complete', null, 'Jacob Brunson', 'complete', null),
  ('Teachers Quorum First Counselor', '2025-12-26', array['Henry Newbold']::text[], 'complete', null, 'Joshua Snarr', 'complete', 'Approved by Nick Newbold'),
  ('Teachers Quorum Second Counselor', '2025-12-26', array['Zane Bott']::text[], 'complete', null, 'Henry Newbold', 'complete', 'Approved by Andrew Bott'),
  ('Teachers Quorum Secretary', '2025-12-26', array['Nixon J Rappleye']::text[], 'complete', null, 'Eli Packer', 'complete', 'Approved by Bro Rappleye'),
  ('Priest Quorum First Assistant', '2025-12-26', array['Kevin Bott']::text[], 'complete', null, 'Ethan Taylor', 'complete', null),
  ('Priest Quorum Second Assistant', '2025-12-26', array['Parker Zaugg']::text[], 'complete', null, 'Oakley Bott', 'complete', 'Still needs to be set apart'),
  ('Priests Quorum Secretary', '2025-12-26', array['Benjamin Lund']::text[], 'complete', null, 'Steven Kearl', 'complete', null),
  ('Young Women Class President - 12-13', '2025-12-26', array['Naomi Smith']::text[], 'complete', null, 'Malynn Young', 'complete', null),
  ('Young Women Class First Counselor - 12-13', '2025-12-26', array['Rachel Nemrow']::text[], 'complete', null, 'Baylie Griffin', 'complete', null),
  ('Young Women Class Second Counselor - 12-13', '2025-12-26', array['Hanna Olsen']::text[], 'complete', null, null, 'complete', '(Joe)Approved by Bro Olsen. (Mark)sis olsen finally responded but they haven''t scheduled a time to meet yet'),
  ('Young Women Class Secretary - 12-13', '2025-12-26', array['McKenzie Zimmerman']::text[], 'complete', null, 'Hanna Olsen', 'complete', 'Bro Zimmerman approved'),
  ('Young Women Class President - 14-15', '2025-12-26', array['River Hull']::text[], 'complete', null, 'Addelyn King', 'complete', null),
  ('Young Women Class First Counselor - 14-15', '2025-12-26', array['Baylie Griffin']::text[], 'complete', null, 'Brynna Smith', 'complete', 'coordinate w/ new president'),
  ('Young Women Class Second Counselor - 14-15', '2025-12-26', array['Malynn Young']::text[], 'complete', null, 'Emma Rose Brunson', 'complete', 'coordinate w/ new president'),
  ('Young Women Class Secretary - 14-15', '2025-12-26', array['Brynna Smith']::text[], 'complete', null, 'River Hull', 'complete', 'coordinate w/ new president'),
  ('Young Women Class President - 16-18', '2025-12-26', array['Emery Young']::text[], 'complete', '2026-06-14', 'Mallory Smith', 'to_be_released', null),
  ('Young Women Class First Counselor - 16-18', '2025-12-26', array['Nora Gerlach']::text[], 'complete', '2026-06-23', 'Emery Young', 'to_be_released', null),
  ('Young Women Class Second Counselor - 16-18', '2025-12-26', array['Addelyn Jane King']::text[], 'complete', '2026-06-14', 'Madilyn Zimmerman', 'to_be_released', null),
  ('Young Women Class Secretary - 16-18', '2025-12-26', array['Mallory Rhen Smith']::text[], 'complete', '2026-06-14', 'Peyton Sellers', 'to_be_released', null),
  ('Primary Teacher - CTR 4, CTR 5', '2025-12-26', array['Jennifer Zaugg']::text[], 'complete', '2026-01-18', 'Heidi Merritt', 'complete', 'called to CTR 4&5 class'),
  ('Primary Teacher - Sunbeam Class', '2025-12-26', array['Colten Bingham', 'Shayne Bingham']::text[], 'complete', null, null, 'previously_vacant', 'called to Sunbeam class'),
  ('Primary Teacher - CTR 4, CTR 5', '2025-12-26', array['Hajnalka Olsen']::text[], 'complete', null, null, 'previously_vacant', 'she said she was already set apart not sure the date'),
  ('Primary Teacher - CTR 6', '2025-12-26', array['Aaron Chamberlain', 'Lydia Chamberlain']::text[], 'complete', null, null, 'previously_vacant', 'called to CTR 6 class'),
  ('Primary Teacher - Valiant 7', '2025-12-26', array['Elise Nemrow']::text[], 'complete', null, null, 'previously_vacant', 'called to Valiant 7 class'),
  ('Primary Teacher - Valiant 7', '2025-12-26', array['Kara Bott']::text[], 'complete', '2026-01-18', null, 'previously_vacant', '*need replacement for Kara ASAP. She is call to RS teacher now.'),
  ('Primary Teacher - Valiant 8', '2025-12-26', array['Jessica Brunson']::text[], 'complete', null, null, 'previously_vacant', 'called to Valiant 8 class'),
  ('Primary Teacher - Valiant 9', '2025-12-26', array['Tanner Linsley']::text[], 'complete', null, null, 'previously_vacant', 'called to Valiant 9 class'),
  ('Choir Accompanist', '2026-02-17', array[]::text[], 'complete', null, 'Heidi Brophy', 'complete', null),
  ('Primary Teacher - Valiant 9', '2025-12-26', array['Russell Howell']::text[], 'complete', null, null, 'previously_vacant', 'called to Valiant 9 class'),
  ('Primary Teacher - Valiant 10', '2025-12-26', array['Steve Brown']::text[], 'complete', null, 'Kelsey Brown', 'complete', 'called to Valiant 10 class'),
  ('Relief Society Teacher', '2025-12-26', array['Kara Bott']::text[], 'complete', '2026-01-18', 'Holly Lund', 'complete', 'When to release from primary?'),
  ('Primary Teacher - Valiant 10', '2025-12-26', array['Ryan Snarr']::text[], 'complete', '2026-01-18', null, 'complete', 'To serve in Valiant 10 class with Steve Brown'),
  ('Email Communication Specialist', '2026-01-10', array[]::text[], 'complete', null, 'Teresa Kreger', 'complete', 'Sis Kreger was just release & leave vacant'),
  ('Technology Specialist', '2026-01-10', array['Wayne Taylor']::text[], 'complete', '2026-02-22', null, 'previously_vacant', null),
  ('Ward Bulletin Board Specialist', '2026-01-11', array[]::text[], 'complete', null, 'Cory Hardman', 'complete', null),
  ('Primary Teacher - Valiant 7', '2026-01-13', array['Lyndzi Packer']::text[], 'complete', '2026-02-22', 'Kara Bott', 'complete', null),
  ('Youth Camp Leader - Young Women', '2026-01-17', array['Addelyn King']::text[], 'complete', null, null, 'previously_vacant', null),
  ('Youth Camp Leader - Young Women', '2026-01-17', array['Emery Young']::text[], 'complete', '2026-02-01', null, 'previously_vacant', null),
  ('Youth Camp Leader - Young Women', '2026-01-17', array['Mallory Smith']::text[], 'complete', null, null, 'previously_vacant', 'Arick to reach out'),
  ('Youth Camp Leader - Young Women', '2026-01-17', array['Nora Gerlach']::text[], 'complete', null, null, 'previously_vacant', 'Arick to reach out'),
  ('Valiant Activities Leader', '2026-01-28', array['Kassidy Weiss']::text[], 'complete', '2026-02-22', 'Ashley Gates', 'complete', 'To replace Sister Gates'),
  ('Deacons Quorum Adviser', '2026-01-18', array['Ben Allen']::text[], 'complete', null, null, 'previously_vacant', null),
  ('Temple Prep. Teacher', '2026-01-24', array['Ron Francis', 'Sally Francis']::text[], 'complete', '2026-02-08', 'Bryce Gates', 'complete', null),
  ('Temple Prep. Teacher', '2026-01-24', array['Ron Francis', 'Sally Francis']::text[], 'complete', '2026-02-08', 'Ashley Gates', 'complete', null),
  ('Self-Reliance Specialist', '2026-02-06', array['Darin Zaugg']::text[], 'complete', '2026-03-01', null, 'previously_vacant', null),
  ('Young Women Specialist - Camp Director', '2026-02-15', array['Lorie Newbold']::text[], 'complete', null, 'Jennifer Zaugg', 'complete', null),
  ('Priests Quorum Adviser', '2026-02-17', array['Ron Francis']::text[], 'complete', '2026-04-14', 'Jeremy Cardon', 'complete', null),
  ('Primary Music Leader', '2026-02-17', array['Jessica Brunson']::text[], 'complete', '2026-03-03', 'Kimberly Packer', 'complete', null),
  ('Valiant Activities Leader', '2026-02-22', array['Lori Vaughan']::text[], 'complete', '2026-03-01', 'Ben Allen', 'complete', null),
  ('Primary Teacher - CTR 4, CTR 5', '2026-02-22', array['Kelly M Graham']::text[], 'complete', null, 'Jennifer Zaugg', 'complete', 'Move'),
  ('Primary Teacher - Nursery Class', '2026-02-22', array['Kaylie Jones']::text[], 'complete', null, 'Melisa Hiatt', 'complete', null),
  ('Primary Teacher - Valiant 9', '2026-02-27', array['Tandon Packer']::text[], 'complete', null, 'Tanner Linsley', 'complete', null),
  ('Primary Teacher', '2025-12-26', array['Melisa Hiatt']::text[], 'complete', null, null, 'complete', 'not set apart yet. Has had calling since Feb 2024'),
  ('Primary Teacher - CTR 6', '2026-02-27', array['Lyndzi Packer']::text[], 'complete', null, 'Aaron Chamberlain', 'complete', 'Move'),
  ('Primary Teacher - CTR 6', '2026-02-27', array['Jacob Packer']::text[], 'complete', '2026-04-21', 'Lydia Chamberlain', 'complete', null),
  ('Primary Teacher - Valiant 7', '2026-02-27', array['Melanie Anderson']::text[], 'complete', '2026-03-08', 'Lyndzi Packer', 'complete', null),
  ('Primary Teacher - Valiant 8', '2026-02-27', array['Anne Wilkinson']::text[], 'complete', '2026-05-31', 'Kelly Graham', 'complete', null),
  ('Primary Teacher - Valiant 8', '2026-02-27', array['Teresa Kreger']::text[], 'complete', null, 'Jessica Brunson', 'complete', null),
  ('Relief Society Activity Committee Member', '2026-03-15', array['Lyndsey Griffin']::text[], 'complete', '2026-04-14', 'Christine Earl', 'complete', null),
  ('Relief Society Teacher', '2026-03-15', array['Ashley Gates']::text[], 'complete', '2026-04-19', 'Lyndsey Griffin', 'complete', null),
  ('Priests Quorum Specialist - Camp Coordinator', '2026-03-15', array['Stockton Hall']::text[], 'complete', '2026-04-14', null, 'previously_vacant', null),
  ('Sunday School Teacher', '2026-03-29', array['Ashlyn Welch']::text[], 'complete', '2026-06-07', null, 'previously_vacant', null),
  ('Primary Teacher - CTR 6', '2026-05-24', array[]::text[], 'complete', null, 'Jacob Packer', 'complete', null),
  ('Primary Teacher - CTR 6', '2026-05-24', array[]::text[], 'complete', null, 'Lyndzi Packer', 'complete', null),
  ('Primary Activities Girls', '2026-05-31', array['Susy Warburton']::text[], 'complete', '2026-08-16', 'Kaylie Jones', 'complete', null),
  ('Teachers Quorum Secretary', '2026-06-28', array['Elijah Bruce Packer']::text[], 'complete', null, 'Nixon J Rappleye', 'complete', null),
  ('Elders Quorum President', '2026-06-28', array['John Hernandez', 'Walter Krauss', 'Dean Kreger', 'Chuck Vaughan', 'Brent Zimmerman', 'Tanner Linsley', 'Colton Miles']::text[], 'future', null, null, 'previously_vacant', null),
  ('Young Women President', '2026-06-28', array['Chaylyn Miles', 'Marie Young', 'Heidi Brophy', 'Pamela Eileen Gerlach', 'Lori Vaughan']::text[], 'needed', null, 'Shauna Millgate', 'to_be_released', null),
  ('Ward Temple and Family History Leader', '2026-06-28', array[]::text[], 'discussing', null, 'Scott Thorne', 'to_be_released', 'Talk w/ EQ and RS'),
  ('Ward Temple and Family History Consultant', '2026-06-28', array['Alexander Daniel Solomon', 'Shane Dee Amidan', 'Denise Krauss', 'Becky Snarr']::text[], 'discussing', null, 'Shelly Thorne', 'to_be_released', 'Talk w/ EQ and RS'),
  ('Young Single Adult Leader', '2026-06-28', array['Lorelei Bennett', 'Spencer Jason Gerlach', 'Natalie Gerlach', 'Madilyn Christine Zimmerman', 'Ashlyn Welch', 'Lucy Hardman', 'Nicole King', 'Olivia Hiatt', 'Kasey Allen Krauss']::text[], 'hold', null, 'Cory Hardman', 'complete', null),
  ('Young Single Adult Leader', '2026-06-28', array['Lorelei Bennett', 'Spencer Jason Gerlach', 'Natalie Gerlach', 'Madilyn Christine Zimmerman', 'Ashlyn Welch', 'Lucy Hardman', 'Nicole King', 'Olivia Hiatt', 'Kasey Allen Krauss']::text[], 'hold', null, 'Jeremy Hardman', 'complete', null),
  ('Relief Society Pianist', '2026-07-05', array[]::text[], 'complete', null, 'Kassidy Weiss', 'complete', 'Release Only'),
  ('Relief Society Activity Coordinator', '2026-07-05', array['Kassidy Weiss']::text[], 'complete', '2026-08-16', 'Marie Young', 'complete', null),
  ('Relief Society Activity Committee Member', '2026-07-05', array['Amy Marie Honsvick']::text[], 'complete', '2026-08-09', 'Nicole King', 'complete', null),
  ('Relief Society Assistant Service Coordinator', '2026-07-05', array['Cory Hardman']::text[], 'complete', '2026-08-02', null, 'previously_vacant', null),
  ('Relief Society Service Committee Member', '2026-07-05', array['Amber King']::text[], 'complete', '2026-08-30', null, 'previously_vacant', null),
  ('Young Women Class Adviser', '2026-07-12', array['Chaylyn Miles']::text[], 'complete', '2026-08-16', 'Macoll Sorensen', 'complete', null),
  ('Ward Assistant Executive Secretary', '2026-07-26', array['Dean Kreger']::text[], 'complete', null, 'Arick Trent Sorensen', 'complete', 'For Stake'),
  ('Primary Teacher - Nursery Class', '2026-08-09', array['Joyce Kearl']::text[], 'complete', '2026-09-13', 'Kaylie Jones', 'complete', null),
  ('Teachers Quorum Adviser', '2026-08-09', array['Devin Jenkins']::text[], 'complete', '2026-09-13', 'Jace Eric Jones', 'complete', null),
  ('Young Women Second Counselor', '2026-08-23', array['Marie Young']::text[], 'complete', '2026-09-06', 'Joyce Kearl', 'complete', null),
  ('Gospel Doctrine Teacher', '2026-08-23', array['Colton Miles']::text[], 'complete', null, 'Devin Jenkins', 'complete', null),
  ('Gospel Doctrine Teacher', '2026-08-23', array['Marlene Merkling']::text[], 'complete', null, 'Denise Krauss', 'complete', null),
  ('Deacons Quorum Adviser', '2026-08-23', array['Gavin Wycherly']::text[], 'to_record', null, 'Curt King', 'complete', 'coming with Toni to bee set apart'),
  ('Valiant Activities Leader', '2026-08-30', array['Ryan Snarr']::text[], 'complete', null, null, 'previously_vacant', null),
  ('Teachers Quorum Adviser', '2026-08-30', array[]::text[], 'discussing', null, 'Scott Merritt', 'to_be_released', null),
  ('Young Women Specialist', '2026-09-12', array[]::text[], 'future', null, 'Ashley Gates', 'to_be_released', null),
  ('Gospel Doctrine Teacher', '2026-09-12', array['Karen La Ree Andreasen']::text[], 'approved', null, 'Ashlyn Welch', 'to_be_released', 'out of town'),
  ('Email Communication Specialist', '2026-09-12', array['Travis Stewart']::text[], 'to_record', null, 'Danielle Bennett', 'complete', null),
  ('Ward Bulletin Specialist', '2026-09-12', array['Travis Stewart']::text[], 'to_record', null, 'Danielle Bennett', 'complete', null),
  ('Single Adult Representative', '2026-09-12', array['Elisabeth Nebeker']::text[], 'discussing', null, null, 'previously_vacant', null),
  ('Relief Society Activity Committee Member', '2026-09-12', array[]::text[], 'needed', null, 'Marlene Merkling', 'to_be_released', null),
  ('History Specialist', '2026-09-12', array['Shelly Thorne']::text[], 'needed', null, null, 'previously_vacant', null),
  ('Music Coordinator', '2026-09-13', array['Denise Krauss']::text[], 'discussing', null, 'Dean Kreger', 'release_extended', null),
  ('Primary Teacher - Sunbeam Class', '2026-09-13', array['Amber King']::text[], 'interview_set', null, 'Colten Jared Bingham', 'release_extended', null),
  ('Primary Teacher - Sunbeam Class', '2026-09-13', array['Lauren Reay Solomon']::text[], 'needed', null, 'Shayne Bingham', 'release_extended', null)
) as v(calling_name, date_initiated, candidate_names, calling_status, date_set_apart, release_name, release_status, notes)
join callings c on lower(trim(c.name)) = lower(trim(v.calling_name))
where not exists (
  select 1 from calling_planning cp
  where cp.calling_id = c.id
    and cp.date_initiated is not distinct from v.date_initiated
    and cp.notes is not distinct from v.notes
);
