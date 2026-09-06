# Ward OS — Project Context for Claude Code

Next.js / TypeScript / Tailwind app on Vercel, Supabase backend. LDS ward
meeting planning: agendas, assignments, rotations, sacrament program
publishing, announcements, youth activities.

**Production domain (always test/verify here, never a Vercel preview URL):**
https://ward-meeting-os.vercel.app

## Current migration number: 036

This file was reconciled 2026-09-06 after two parallel sessions
(`main` directly, and this repo's `claude/project-workflow-review-226b91`
branch) worked independently for two days without either knowing about
the other -- exactly the numbering-collision risk this section already
warned about, and it happened on both sides at once. Migration history,
reconstructed from both:

- `022`–`024`: shared common ancestor, confirmed run.
- `025` (`apply_rotation_assignment` Postgres function): this branch's
  work. `main` deliberately skipped reusing `025` once it noticed this
  branch had claimed it -- confirmed run and verified via a
  rollback-safe functional test directly against production.
- `026`–`032`: `main`'s work (hymnal reference fixes and Children's
  Songbook population, agenda items `time_needed`, `people` labels
  (`age_group`/`attendance_status`), `people.profile_id` login-account
  link, richer `announcements` fields, and `youth_activity_rotations` --
  a fixed nth-Wednesday combined-activity rotation, see Vision &
  Intended Workflows below). All confirmed run.
- `033` (Sacrament Meeting Planning redesign -- numbered `026` when
  first written on this branch, then renumbered to `032` once told
  `026`–`031` were taken, then renumbered again to `033` during this
  merge once it turned out `main` had *also* independently claimed
  `032` for `youth_activity_rotations` by then): confirmed run and
  verified.
- `034` (rotation recalibration + `people.email`/`callings.backup_holder_id`
  cleanup -- renumbered from `033`): confirmed run and verified.
- `035` (Youth Activity / Ward Event cadence rules -- renumbered from
  `034`): confirmed run.
- `036` (corrected Primary Program/Christmas/Easter sacrament templates
  per the user's review -- see Table Admin queue item 3 below): still
  needs to be run.

Next migration should be `037_*.sql`. Migrations are plain `.sql` files at
the repo root, run manually by the user in the Supabase SQL editor (no
migration tool/CLI wired up). Always make migrations idempotent
(`DROP ... IF EXISTS` before `CREATE`) since partial-failure re-runs are
common. **Confirm the next free number with the user before assuming --
two separate numbering collisions have now happened**, including one
between two parallel sessions that each thought they were the only one
working on this repo. If a long-running session or branch is a
possibility, say so to the user explicitly rather than assuming
exclusive access.

## Architecture

- **Auth:** email/password (not magic link — that was broken and replaced).
  First-time users must visit `/auth/reset-password` once to set a password.
- **Roles** (`profiles.role`, fixed enum, not yet configurable):
  `bishopric` (bishop + counselors + exec sec + clerk, one shared role),
  `music_planner`, `communications_specialist`, plus granular youth roles
  `yw_presidency`, `yw_advisor`, `yw_specialist`, `ym_advisor`, `ym_specialist`
  (kept granular on purpose, not consolidated). **Terminology note:** this
  `bishopric` role value is what the "Vision & Intended Workflows"
  section below calls **admins**; it reserves the word **bishopric** for
  the three-person presidency only (Bishop + both counselors). Use that
  distinction in conversation and new UI copy going forward.
- **Landing page** (`app/page.tsx`): one shared URL for everyone. Tiles are
  filtered in/out by login state + role. Tapping a tile navigates to that
  feature's own page — the landing page is a router, not a replacement for
  feature pages.
- **Meeting types:** Sacrament Meeting, Bishopric Meeting, Ward Council,
  Youth Council. Lifecycle: `template → planning → review → ready → live →
  archived`. "Published" (ready/live) = public program is print-ready
  (music/speakers/prayers/conducting/presiding finalized) but explicitly
  excludes ward business/announcements, which only get folded in at
  `archived`.
- **Dynamic planning view** (`app/meetings/[id]/planning/page.tsx`): renders
  a meeting's own agenda elements (`meeting_planned_elements`, migration
  `033`) in order, dispatching by `resolution_kind` (`person_role`,
  `music`, `person_slot`, `free_text`, `person_and_text`, `none`). Most
  element types write to existing tables (`sacrament_assignments`,
  `sacrament_music`, `sacrament_speakers_adults/youth`); anything without
  a clean existing home writes to the generic `meeting_element_notes`
  table. `meeting_planned_elements` is per-meeting and freely
  add/remove/reorderable from that meeting's own "Agenda Elements" page
  (`/meetings/[id]/template`) without affecting any other meeting --
  seeded once at creation time from `meeting_templates` (now keyed by
  meeting type **and**, for Sacrament Meeting, `format_key` matching
  `special_format` -- see `SPECIAL_FORMATS`), which is itself edited at
  `/admin/meeting-templates`, not per-meeting. A meeting created before
  migration `033` has zero `meeting_planned_elements` rows and falls back
  to rendering the shared `meeting_templates` list directly (no backfill
  was done, by design). Changing a meeting's `special_format` after the
  fact never re-seeds its elements -- only affects new meetings going
  forward. Separately, `meetings`/most Sacrament Meeting tables' calendar
  pickers in Table Admin support `createIfMissing` -- picking a future
  Sunday with no `meetings` row yet creates one automatically on save
  (with rotations applied), so planning can start against any date
  without running Generate Meetings first.
- **Assignment Rotations** (`/rotations`): 7 elements rotate automatically
  (Conducting, Opening/Closing Prayer ×3 meeting types, Chorister, Organist,
  Spiritual Thought ×3 meeting types (Bishopric/Ward Council/Youth Council,
  the latter two added migration `034`), Handbook Training presenter).
  Speaker/Youth Speaker and
  Presiding/Pianist intentionally do NOT rotate — `/speaker-prayer-history`
  is the manual tool that compensates for that. A rotation's "next" pointer
  advances once per meeting *created*, not per save, so a one-off override
  doesn't skip anyone in future weeks. The assignment write and the
  pointer advance happen atomically via the `apply_rotation_assignment`
  Postgres function (migration `025`) — one RPC call per rotation, not
  two separate writes — so a failure partway through can't desync the
  pointer from what was actually assigned. Every rotation's member order
  and "next up" pointer were calibrated against the ward's actual real
  2026 rotation pattern (migration `034`) -- see that migration's
  comments for the exact person-by-person cycles derived per rotation.
  Separate and unrelated: `youth_activity_rotations`/
  `youth_activity_rotation_members` (migration `032`) rotate plain-text
  *groups* (not people) onto `youth_activities` rows on a fixed
  nth-Wednesday cadence -- see Vision & Intended Workflows below.
- **Meeting Schedule** (`/meeting-schedule`): cadence rules
  (`meeting_schedule_rules`) drive a "Generate Meetings" action. Three
  cadence shapes: `weekly`, `nth_weekday` (e.g. "3rd Tuesday"), `relative`
  (e.g. "2 days after the 3rd Sunday" — computed from the anchor each month,
  not stored as its own fixed nth-weekday, since which numbered weekday that
  lands on varies month to month). The cadence date-math and shared
  cadence-picker UI live in `lib/data/cadence.ts` /
  `components/schedule/CadenceFields.tsx` (extracted migration `035`) so
  the general-purpose Youth Activity Schedule and Ward Event Schedule
  cadence rules (`lib/data/youth-activity-cadence-rules.ts`,
  `lib/data/ward-event-schedule.ts` -- deliberately *not* named
  `youth-activity-schedule.ts`, which is `youth_activity_rotations`'
  unrelated fixed-rotation engine, see above) reuse the exact same logic
  rather than a second, drifted copy of the month-boundary handling.
- **RLS:** enabled on every table (app uses the anon key everywhere, not
  service role). Most tables: any authenticated user, app code already
  gates by role. A handful of public-facing tables (announcements,
  sacrament program data, youth/ward events) have narrow anon policies
  scoped to exactly what the public UI already filters to client-side
  (`confirmed = true`, `status = 'published'`, etc.) — don't loosen these
  without checking what the public pages actually expose.

## Vision & Intended Workflows (authoritative — read before planning-related work)

Written 2026-09-05 after the user flagged that "some of the original
vision was lost" through incremental, table-by-table work this session.
**This section is the source of truth for intent.** The rest of this
file (Architecture, Known open items, the Table Admin queue) describes
what's actually built, which does not yet fully match this everywhere —
each workflow below ends with a "Known conflicts with what's built
today" list. The user is adding more workflow descriptions in follow-up
messages; this section will keep growing. Don't start building against
any of this without re-reading it fresh, since it supersedes earlier
partial/tentative decisions recorded elsewhere in this file where they
conflict.

### Glossary (precise usage from here on)

- **Sacrament** (unqualified — "sacrament meeting," "sacrament
  program," etc.) always means Sacrament Meeting, **except** the
  specific element "Administration of the Sacrament" — the literal
  ordinance the meeting exists for.
- **Sacrament meeting program** = the publicly-viewable subset of the
  meeting's content.
- **Sacrament meeting agenda** = the full thing admins build; the
  program is a subset of it (agenda ⊇ program).
- **Bishopric** = Bishop, Bishopric First Counselor, Bishopric Second
  Counselor. Three people, no more.
- **Admins** = Bishopric (above) + Ward Executive Secretary + Ward
  Clerk. This is the group the app's single shared `bishopric`
  `profiles.role` value actually represents today — say "admins" for
  that permission group from now on, and reserve "bishopric" for the
  three-person presidency specifically (e.g. the Conducting rotation
  correctly cycles Bishop → 1st Counselor → 2nd Counselor only, not the
  wider admin group — that one was already right).

### Workflow: Planning a non-Sacrament meeting (Bishopric Meeting, Ward Council, Youth Council)

1. Each meeting has a name, scheduled date + time, a template format,
   underlying rotation-assigned data for specific elements only (not
   every element rotates), and agenda items.
2. An admin (bishopric member, ward clerk, or ward exec sec) logs in,
   selects the meeting by name + date, and its underlying data is
   pulled into the template as a draft.
3. They edit the draft as needed, then make it live.
4. Once live, non-admin members with read rights for that meeting **by
   calling** can view it (e.g. whichever calling(s) seat a given
   council).
5. Admins can add notes to specific elements — typically not the
   rotation-assigned ones, more likely agenda items, meeting topics, or
   general notes. These notes are hidden from non-admin viewers while
   the meeting is live, and only become visible to those same
   read-right viewers once the meeting is archived.

**Known conflicts with what's built today:**
- No non-admin viewing mechanism exists yet for these meeting types at
  all. "Known open items" below previously described the planned
  mechanism as "share-token-based, no-login, security through an
  unguessable link" — this workflow instead calls for **login +
  calling-based** read access (via `meeting_type_members`, which
  already maps callings to meeting types). Treat the calling-based
  model here as authoritative; the share-token note was likely an
  oversimplification and should be corrected once this gets built.
- No live/archived-based visibility split exists anywhere today for
  admin notes on an element.

### Workflow: Sacrament Meeting planning

1. Each sacrament meeting has a scheduled date + time, a template
   format, rotation-assigned data for specific elements only
   (conducting, musicians), ward business of varying types
   (callings/releases, baby blessings, RABNM, and more the user will
   specify later) — **all handled in planning environments and
   imported into the meeting by date** — plus Administration of the
   Sacrament itself, plus elements that must be planned ahead in a
   planning environment and imported by date (music, speakers, prayers).
2. An admin logs in, selects the meeting by name + date, **selects the
   sacrament meeting template appropriate for that meeting** (i.e.
   different formats — Standard, Testimony Meeting, Stake Conference,
   etc. — are meant to select a different default template, not just be
   a stored label), and the underlying data is pulled into that
   template as a draft.
3. The admin manipulates the data — **mostly reordering elements** — as
   needed, then the draft is made **printable** (sacrament meeting has
   its own lifecycle wording, distinct from "live").
4. Once printable, it's shared with whoever prints hard copies of the
   public view. **Not yet decided:** a sent file vs. a dedicated print
   portal (for formatting the program, announcements, etc.) — open
   question, don't assume either way.
5. On the day of the meeting, the program becomes viewable to the
   public with no login, for that one day only. (Already matches what's
   built — `getTodaysPublishedSacramentMeeting`.)
6. Archived sacrament meetings are **admin-only** — no calling-based
   public access at all once archived, unlike non-sacrament meetings
   above (where archived becomes viewable to calling-based read-right
   viewers, admin notes included). This is a deliberate difference
   between the two workflows, not an inconsistency to reconcile away.
7. The agenda/program gets reviewed again during the Bishopric Meeting
   that precedes it (usually the same Sunday morning) — ward business
   items get reviewed/confirmed, other polish gets added. **No notes
   field is needed for this step** — unlike the non-sacrament workflow's
   admin-only notes.
8. The meeting stays editable at all times until archived. Archiving
   happens **automatically at the end of the day Sunday** — not a
   manual "Archive past meetings" action. (This specifies the
   "Auto-archive past meetings" item already in Known open items below.)
9. The public program updates in real time as admins keep adjusting the
   agenda — no separate "publish the update" step once past printable.

**Known conflicts with what's built today:**
- ~~`special_format` is currently just a stored label with no
  effect~~ -- **resolved 2026-09-05**: the Sacrament Meeting Planning
  redesign (Table Admin queue item 3, migration `033`) makes
  `special_format` actually select a different default template, and
  each meeting's own elements are freely reorderable per-meeting via
  `meeting_planned_elements`, both exactly as this workflow describes.
  See Architecture above and the Table Admin queue below for the full
  design (generalized to every meeting type, not just Sacrament
  Meeting, per the user's explicit choice when reconciling this with a
  narrower alternative built in a separate parallel session).
- "Ward business... handled in planning environments and imported into
  the meeting by date" is partially true today, but scattered:
  `calling_planning` pushes into `sacrament_rabnm` by date; Music/
  Speakers/RABNM/Rotations/Planning can all be pre-planned against a
  future date via Table Admin's calendar picker (`createIfMissing`) --
  but there's no single unified "planning environment" surface, it's
  spread across several separate Table Admin grids plus the live
  per-meeting planning view. Whether that's fine or needs consolidating
  is exactly the kind of question this section exists to settle before
  more piecemeal work happens on it.
- No "printable" lifecycle stage or terminology exists today — current
  stages are `template → planning → review → ready → live → archived`.
  Where "printable" maps onto that chain (or whether it replaces part of
  it) needs deciding, not assumed.

### Workflow: Calling planning and calling-specific ward business in Sacrament Meeting

1. Admins can begin a calling planning item at any time, though it's
   usually initiated by the bishop in Bishopric Meeting.
2. The admin selects the calling to change (or creates a new one), adds
   the individual(s) being considered, a status for the change, and
   short-form notes.
3. The person to be released is included by default too — a dropdown
   called in from the calling's own current/backup holder, with an
   option for "previously vacant" (no one to release / brand-new
   calling) — plus its own separate status.
4. Either the calling, the release, or both (by status, in the same
   meeting) can be marked to announce in Sacrament Meeting, landing in
   that meeting's ward-business calling/release element.
5. This is **not** viewable in the public program.

**Status: already matches almost exactly** — unlike the other two
workflows above, this one confirms rather than conflicts with what's
built and what was done earlier this session:
- Calling/candidate/notes/status/release-person/release-status: all
  exactly `calling_planning`'s existing shape. "Individual(s) being
  considered" maps to the existing `calling_planning_suggestions`
  table (multiple candidates + notes, already built) feeding into the
  single `selected_person_id` once decided.
- The release-person dropdown "called in from the appropriate table,
  plus previously vacant" is *exactly* the `scopedBy` (current/backup
  holder) + "Previously Vacant / New Calling" `specialOptions` work
  done earlier this session for Table Admin's Calling Planning grid —
  confirms that design was right. **Note:** `callings.backup_holder_id`
  was later dropped entirely (migration `034` -- "not actually a real
  thing" for this ward, per the user) — the release-person dropdown now
  scopes to current holder only.
- "Either/both, by status, same meeting" is exactly
  `pushToSacramentMeeting`'s existing logic (checks calling_status and
  release_status independently, can push both into one `sacrament_rabnm`
  write against the chosen meeting).
- Verified directly: `lib/data/public-view.ts` queries `sacrament_rabnm`
  filtered to `type = 'baby_blessing'` only — calling/release/
  presidency_change rows are already excluded from the public program.
  No conflict, no fix needed here.

### Workflow / policy: Adding new people (privacy & data-usage stance)

Deliberate policy, not just a workflow — the user weighed this and
wants it followed going forward:

1. **No bulk import** of people from a church membership source (e.g.
   LCR). People get added one at a time, "from memory or introduction
   over time," only as actually needed for ward business.
2. **Name only** — no email, age, or other PII copied in from church
   sources. ~~`people.email` exists as a column but should stay sparsely
   used~~ -- **dropped entirely** (migration `034`): unused everywhere
   in the app, so removed rather than left sparsely populated.
3. When a person needs login access: send them an invite to create an
   authenticated account, then an **admin manually matches** that
   account to their existing `people` row (or creates one). No
   automatic matching by email — a human confirms identity first.
4. Want **labels** on `people` beyond the current single `active`
   boolean: adult / youth / child, attending / not attending, moved
   (possibly = archived), etc.

Assessed and endorsed (2026-09-05): bulk-importing official membership
data would carry real sensitive fields (birthdates, addresses, phone
numbers, priesthood/membership status) with no corresponding security
infrastructure to justify holding them — avoiding that is the right
call for a small, admin-run tool like this. Name-only, added as needed,
is good data minimization. Manual account-to-person matching (rather
than auto-matching by email) is a sound safeguard against impersonation
in a trusted-admin context.

**Known gaps, not yet built:**
- ~~No auth-account-to-person link existed~~ — **built 2026-09-05**
  (migration `030`): `people.profile_id` nullable/unique FK into
  `profiles`, editable as "Login Account" in Table Admin's People grid
  via the existing generic FK dropdown — no new UI needed. Also adds an
  RLS policy opening `profiles` to authenticated SELECT, needed for the
  dropdown to list accounts.
- ~~`people` only has one boolean (`active`)~~ — **built 2026-09-05**
  (migration `029`): added `age_group` (adult/youth/child) and
  `attendance_status` (attending/not_attending/moved), both exposed in
  Table Admin. `active` itself is untouched, still just picker-list
  membership.

### Terminology: "notes" vs. "minutes"

The user has used these interchangeably up to now. Going forward:
**notes** = what admins write live, during a meeting, on specific
elements. **minutes** = what a *later* meeting's admin produces when
they review a previous meeting's notes and relate them back (summarize
discussion points, action items, etc.) as an agenda element of the
*current* meeting. Minutes are a retelling of notes, not a separate
data type — there isn't a distinct "minutes" table/field to build,
just a distinct verb for "notes, once someone reports on them later."

### Workflow: Admin adding notes to elements during a meeting

1. An admin attending a meeting logs in, selects that meeting, and sees
   notes fields for specific elements — agenda items, discussion
   items — but **not** the rotationally-assigned ones. Plus a general
   notes field, and an action items field (dropdown for the
   organization or individual assigned, plus a description).
2. These are viewable/editable **in real time by all admins in the
   meeting** — while the meeting is happening, everyone with access
   sees everyone else's notes update live.
3. Non-admins only get access after the meeting is completed/archived
   (consistent with the non-Sacrament workflow's notes-visibility rule
   above).
4. When a future meeting's admin relates minutes, they look at the
   archived meeting and see the agenda **as it was finalized**, with
   the notes rendered so they visually stand out from the element they
   describe (e.g. a font color change) — not blended in as if part of
   the agenda itself.

**Known gaps, not yet built:**
- **No real-time sync exists anywhere in the app.** Server actions +
  `revalidatePath` only refresh the acting user's own session on their
  next interaction — nothing pushes live updates to *other* open admin
  sessions. Multiple admins in the same meeting would need to manually
  reload to see each other's notes appear. Supabase Realtime could
  cover this but nothing subscribes to live changes today.
- **Action items can only be assigned to a person today**
  (`meeting_action_items.assigned_to_id` is a single FK to `people`) —
  no concept of assigning to an *organization* (a quorum, auxiliary,
  class, etc.) exists in the schema at all.
- **No distinct "view an archived meeting" experience exists.**
  Confirmed by checking every route under `app/meetings/[id]/` — none
  branches on `stage === 'archived'`. An archived meeting is presumably
  still shown through the same editable planning form as any other,
  with no read-only finalized-agenda view, and no visual treatment
  distinguishing notes from the elements they describe.
- The non-admin post-archive visibility rule (item 5 in the
  non-Sacrament workflow above) still isn't built — reconfirmed here,
  not a new gap.

### ~~Workflow: Adding agenda items for a non-Sacrament meeting~~ — built 2026-09-05

Anyone invited to a non-sacrament meeting should be able to add agenda
items for their organization: enter the site (via a tile for meeting
agenda items) or a direct link from an email announcement/reminder,
fill out the form, and the item becomes available to the meeting(s) it
pertains to — **included by default**, excludable by an admin if
needed. The user linked the actual form ward members use today as the
reference for what fields belong: [Heritage Ward Meeting Agenda
form](https://docs.google.com/forms/d/e/1FAIpQLSdThJMvNwBYWzGnKAE-pkLf9oRf1EZmyZMZtWXAng5aUT-o0A/viewform),
fetched and confirmed (2026-09-05) to actually ask for: Email
(*required*), Your Name (not required), Desired Meeting for Agenda
Item (Bishopric / Ward Council / Ward Youth Council), Date of Meeting,
Description of Agenda Item (one paragraph field, no separate title),
and How Much Time Do You Need (1–2 / 3–5 / 6+ minutes).

**All four conflicts fixed 2026-09-05** (migration `028`): added the
"Meeting Agenda Items" tile; rebuilt `/submit`'s agenda-item path
(`app/submit/actions.ts`'s `submitAgendaItem`,
`components/submit/SubmitForm.tsx`) to match the real form's fields
exactly (email required, name optional, meeting type + date, one
description, time needed); it now resolves straight to a real meeting
via `getOrCreateMeetingId` instead of leaving `meeting_id` null; and it
publishes immediately (included by default) instead of starting
pending. `submitAnnouncement` was deliberately left untouched (still
pending by default) — see the blocked event-announcement workflow
below for why.

### ~~Terminology question + Workflow: announcing an upcoming event~~ — built 2026-09-05

The Google Form itself (`.../1FAIpQLSfeFKoow2UfLzuwBYHxaS8xRlv9MsfRDXHgItqQbIWOWUXSIQ/viewform`)
401'd on every fetch attempt, same as before — the user pasted its real
field list directly instead. That answered the terminology question:
it's a general **announcement request** form, not an event-only one —
"event" is just one value (`Single Event`) of several under "What type
of announcement is this?" (Ongoing Event, Future - For Planning,
Action, General Information, Assignments, Lesson). Youth only appears
as an *organization*/*audience* value on this form, never its own type
— confirms `youth_activities` should stay the separate table it already
is, not get folded into this.

Migration `031` extends `announcements` with the form's real fields:
`organization` + `announcement_type` (the form's radio/single-select
questions, each with a real "Other" — stored as free text rather than a
fixed `select` column so an "Other" answer isn't stranded outside a
fixed list), `audience` + `where_announced` (the form's checkbox/multi-select
questions — stored as comma-joined text; the generic Table Admin engine
has no multi-select column type yet and this is a two-column,
not-yet-common need, not worth adding one for), `start_date`/
`start_time`/`end_date`/`end_time`, `location`, `link_url`. File
attachment (the form's last question) was explicitly skipped per the
user's instruction.

`submitAnnouncement` (`app/submit/actions.ts`) now matches the form
exactly and **publishes immediately** (flips from the old `pending`
default) — the user's original workflow description ("not necessary to
add an extra review step at this time," "included by default... but
can be excluded by admin") already settled the auto-publish-risk
question flagged here previously; an admin can still exclude one via
Status in Table Admin or the `/announcements` inbox.
`components/submit/SubmitForm.tsx` grew the new fields (checkboxes for
the multi-select questions, a select-with-"Other"-textbox for the
single-select ones).

**Bug found and fixed along the way:** `/announcements/public` — the
page the landing page's "Announcements" tile has linked to all
along — contained a stray duplicate of the landing page's own
`HomePage` component, not an announcements listing.
`getPublishedAnnouncements()` (`lib/data/general-submissions.ts`)
existed and worked but was never called from anywhere. Nobody following
that tile has ever actually seen a posted announcement. Replaced with a
real listing page rendering title/body/organization/type/date
range/location/link.

### ~~Workflow: Adult leaders planning youth activities~~ — combined weeks built 2026-09-05

Continued the "Cadence rules for Youth Activities / Ward Events" open
item logged 2026-09-04. Real 2026 rotation data and 4 upstream
decisions are in
[youth-activities-2026-schedule.md](youth-activities-2026-schedule.md).
The user then gave the missing cadence rule and said to continue:
Wednesdays at 7:00pm by default; Combined YM = 1st Wednesday; Combined
YW = 2nd & 4th; Combined YM/YW = 3rd; the given 2026 data is "a starter
... may be updated at a later time."

**Note:** this is a *different, complementary* feature from the general
Youth Activity/Ward Event cadence-rule engine also called "Cadence
rules for Youth Activities / Ward Events" elsewhere in this file (see
Known open items below) — that one is a user-configurable
weekly/nth-weekday/relative rule engine mirroring `/meeting-schedule`
exactly, for *any* recurring activity/event; this one is a fixed,
hardcoded nth-Wednesday rotation specifically for the three "combined
week" activities. Both were built independently in parallel sessions
and both are real, kept side by side under different file names
(`lib/data/youth-activity-schedule.ts` for this fixed rotation vs.
`lib/data/youth-activity-cadence-rules.ts` for the general engine) to
avoid confusing the two.

**Built:**
- Migration `032_youth_activity_rotations.sql`:
  - `youth_activities` gains `confirmed` (tentative vs. confirmed,
    independent of `status`'s draft/published *visibility*),
    `cancelled` + `cancellation_note` (shown, not hidden — same
    show-don't-hide pattern the "Cancel a meeting" open item below
    wants for meetings), and `planning_group`.
  - `planning_group` vs. `group_name`: for a combined week, `group_name`
    stays the *attendee* scope (`Combined YM`/`Combined YW`/`Combined
    YM/YW` — the existing pseudo-values already in
    `YOUTH_ACTIVITY_GROUPS`, unchanged), while `planning_group` records
    which single class is *on the hook to plan it* that time. A
    non-combined activity leaves `planning_group` null.
  - New `youth_activity_rotations`/`youth_activity_rotation_members`
    tables — a lightweight rotation engine deliberately separate from
    the existing `rotations`/`rotation_members` (those rotate *people*
    via a hard FK onto a *meeting*-scoped role; this rotates *plain-text
    groups* onto a `youth_activities` row on a monthly nth-Wednesday
    cadence unrelated to `meetings`). Same design principle though: an
    ordered member list + a `next_index` pointer that advances once per
    occurrence *generated*, so an override never skips anyone later —
    confirms the design the user asked for when reviewing the real
    December 2026 Combined YM exception.
  - Seeded all three rotations from the schedule the user gave,
    simplified to a clean repeating cycle (documented in
    youth-activities-2026-schedule.md), and seeded the real,
    already-known Sept 2026–Feb 2027 activities as literal rows
    (verified nth-Wednesday dates independently, not from memory) —
    `next_index` on each rotation is set to continue correctly *after*
    that seeded stretch.
- `lib/data/youth-activity-schedule.ts`: `generateCombinedYouthActivities(throughDateISO)`
  — the actual cadence engine (fixed rule, not a rules table like
  `/meeting-schedule`, since there's exactly one pattern here). Skips
  the 5th Wednesday of a month entirely (individual-group weeks still
  aren't designed) and skips any date that already has an activity.
- `YOUTH_ACTIVITY_GROUPS` (`lib/data/youth-activity-constants.ts`)
  switched to the three renamed classes; old age-based values kept
  commented out for reading historical rows.
- `/youth-activities`: new "Generate Combined Activities" panel
  (mirrors `/meeting-schedule`'s Generate button); Confirm/Mark
  Tentative and Cancel (with a note)/Un-cancel controls per row;
  cancelled rows render with a red "Cancelled" badge and the note
  instead of their normal group/category/location line, still fully
  shown, not hidden. `/events`' merged public listing does the same for
  cancelled youth activities.
- Table Admin's Youth Activities grid gained Planning Group, Confirmed,
  Cancelled, and Cancellation Note columns — editing Planning Group per
  row *is* the override mechanism (no separate UI needed, matches how
  every other rotation-assigned element in the app is already
  overridden via its own admin grid).

**Deliberately not built / left for later:**
- Individual-group (non-combined) weekly activities — still no
  rotation pattern provided; those Wednesdays (and any 5th Wednesday)
  simply generate nothing yet.
- No dedicated UI to reorder/edit the three rotations' membership
  lists — `/rotations` has its own page for the people-based rotations
  for the same reason (membership isn't exposed through generic Table
  Admin there either); a parallel UI for these wasn't built this round.
  For now, correcting the base cycle means updating
  `youth_activity_rotation_members` directly in Supabase.
- Bulk "plan a whole year at once, then edit details later" is now
  possible via Generate + per-row editing, but there's still no
  single-page "review this whole year and fill in every TBD" view --
  admins currently do that from the flat `/youth-activities` list or
  Table Admin grid.

## Known open items

- Teaching Calendar (youth leader tile) — scope not yet defined, deferred
- Bishopric-side free-text elements (spiritual thought, handbook training,
  young men coordination, impressions, calling planning, sacrament meeting
  review) can currently be entered in TWO places — new dynamic per-element
  fields AND the old `BishopricMinutesForm`'s similarly-named fixed columns.
  Not consolidated yet; ask before changing either.
- Agenda items for Bishopric/Ward Council/Youth Council should eventually
  get a share-token-based no-login view for invited attendees (security
  through an unguessable link, not auth) — not built yet. **Superseded by
  the Vision & Intended Workflows section above**, which instead calls
  for login + calling-based read access — treat that as authoritative.
- Dashboard shows every meeting, past and future, oldest first —
  `getUpcomingMeetings()` (lib/data/meetings.ts) has no date or stage
  filter at all despite the name. Two follow-ups noticed while using it
  day to day (2026-09-04), not yet built:
  - **Auto-archive past meetings.** Once a meeting's date has passed: if
    real data was entered for it (assignments/music/planning/notes rows
    exist for that meeting_id), move its `stage` to `archived`
    automatically instead of leaving it sitting in whatever stage it was
    last saved at. If nothing was ever entered, don't force it to
    `archived` — mark it some other way (e.g. a "No activity" badge) so
    it's visually distinct from a past meeting that was actually run.
    Needs a decision before building: what exactly counts as "data was
    added" (which tables/columns to check per meeting type), and how the
    transition gets triggered (computed on dashboard render vs. a
    scheduled job vs. a manual "Archive past meetings" action). **The
    Vision & Intended Workflows section above specifies this for
    Sacrament Meeting**: automatic at end-of-day Sunday, not a manual
    action -- reconcile with this note once picked up.
  - **Cancel a meeting from the dashboard.** A status control separate
    from the planning-progress `stage` field — something like
    Scheduled/Cancelled, with a reason when cancelled. Likely a new
    column (or two) on `meetings` rather than overloading `stage`, since
    `stage` tracks how far along the program is, not whether the meeting
    is happening at all. Lower priority than the auto-archive item.
    `youth_activities` got exactly this treatment (`cancelled` +
    `cancellation_note`, shown not hidden) built 2026-09-05 as part of
    the "Adult leaders planning youth activities" workflow above — worth
    reusing that same shape for `meetings` when this gets picked up.
- ~~**Cadence rules for Youth Activities / Ward Events.**~~ Done
  2026-09-05, two complementary pieces built independently in parallel
  sessions (see the note under "Adult leaders planning youth activities"
  above for how they coexist without conflicting):
  - The fixed combined-week rotation (`youth_activity_rotations`,
    migration `032`) -- see that workflow section for full detail.
  - A general, user-configurable cadence-rule engine (migration `035`):
    new `youth_activity_schedule_rules` / `ward_event_schedule_rules`
    tables, same three cadence shapes as `/meeting-schedule`, a
    "Generate" action on each of `/youth-activities` and `/ward-events`
    (not a new page -- folded into the existing management UI on each,
    unlike `/meeting-schedule` which is separate because it spans
    multiple meeting types). Gated by each page's own existing
    manage-roles (youth leaders + bishopric for activities;
    communications specialist + bishopric for events), not restricted
    to bishopric-only like Meeting Schedule is. Cadence date-math and
    the cadence-picker UI were extracted out of
    `lib/data/meeting-schedule.ts` into shared `lib/data/cadence.ts` /
    `components/schedule/CadenceFields.tsx` so all three cadence-rule
    features (Meeting Schedule, this one, and the combined-week
    rotation's own date math stayed separate on purpose, see above)
    share one implementation where they actually overlap.
- **Consolidate the two Music tiles on the landing page.** (2026-09-05,
  instruction still pending -- user said "see next prompt," not yet
  given as of this note) The two candidate tiles, found in `app/page.tsx`
  under the "Music" section (visible to `music_planner` + `bishopric`):
  "Sacrament Music Planning" (→ `/music`, bulk/single hymn entry) and
  "Music Coordination" (→ `/music-coordination`, a read-only status
  overview across upcoming meetings). User wants a single tile for
  "sacrament meeting music planning" instead of these two -- exact
  merged behavior/routing not yet specified.
- **Sortable column headers in Table Admin.** (2026-09-05, user's own
  words: "future upgrade") Click a column heading in `AdminTableEditor`
  to sort the grid by that column, presumably click-again to reverse.
  Client-side only (re-sort the already-fetched `rows` array in
  component state) -- doesn't need a schema or server change.

## Table Admin update queue (FIFO — work top to bottom)

Requested while going through the `/admin` Table Admin feature
(2026-09-04). Per the user: return to these in the order added, one at a
time, rather than building ahead. Update this list (strike/remove an item,
or note partial progress) as each is picked up.

1. ~~**Admin-editable option lists for `calling_status`/`release_status`.**~~
   Done (2026-09-04) — `admin_select_options` table (migration `022`),
   `lib/data/select-options.ts`, wired into both the real Calling
   Planning UI and the "Dropdown Option Lists" admin table.
2. ~~**Sacrament Music.**~~ Done (2026-09-04): renamed to "Sacrament
   Meeting Music" in Table Admin. `status` turned out to be the actual
   print-readiness gate (not a submission-vetting flag as first assumed)
   -- removed the manual "Approved" step everywhere per the user's
   decision, so every entry is now auto-published (migration `023`,
   backfills existing pending rows too). `slot` turned out to matter for
   real (disambiguates multiple Intermediate Hymns/Musical Numbers in
   one meeting) -- left alone everywhere per the user's decision, just
   dropped from the Table Admin grid. New `hymnal_songs` reference table
   (migration `024`), later renamed to "Music Reference" per the user
   (2026-09-04). `number` had to move from `integer` to `text`
   (migration `026`) once real data showed lettered variants sharing a
   base number (e.g. Children's Songbook 20a/20b are different songs --
   an integer column can't hold the suffix, and stripping it collides
   two different songs on one key). Populated with the full Children's
   Songbook via WebFetch/WebSearch against churchofjesuschrist.org's
   official title index, letter by letter (migration `027`) -- a
   good-faith transcription, not verified-perfect; a handful of entries
   where the source's own views disagreed were left out rather than
   guessed at. The 1985 Hymnal and Hymns for Home and Church are NOT
   populated yet -- same approach works but is very fetch-heavy (~20-30
   page loads per collection); ask the user before spending that,
   especially on Hymns for Home and Church since it's still being
   released in volumes.
3. ~~**Sacrament Planning.**~~ Done (2026-09-05/06, migration `033`,
   see full history in "Current migration number" above): renamed to
   "Sacrament Meeting Planning" in Table Admin. **Two different-scoped
   designs were built independently in parallel sessions; the user chose
   the fuller one when reconciling them (2026-09-06).** The narrower
   version (built first, in `main`) took the user's initial answer that
   `special_format` should stay informational-only and per-date
   reordering wasn't needed at this level -- it only fixed Table Admin's
   Meeting picker to support planning against a future Sunday with no
   `meetings` row yet (`getOrCreateMeetingId` /
   `foreignKey.createIfMissing`, still present and still useful
   regardless of which design won). The fuller version (this branch),
   confirmed as what the user actually wants when the conflict surfaced:
   `special_format` actually changes which elements appear -- each
   meeting gets its own `meeting_planned_elements` row set, seeded at
   creation time from `meeting_templates` (now keyed by meeting type +
   `format_key`), freely add/remove/reorderable per meeting from then on
   without affecting any other meeting. Generalized to every meeting
   type per the user's decision, not just Sacrament Meeting.
   Forward-only, per the user's decision -- no backfill for meetings
   created before this shipped (see Architecture above for the fallback
   behavior). Default templates for all 10 `special_format` values:
   `standard`, `testimony_meeting` ("fast Sunday"), and
   `missionary_speaker` came from the user's actual real service order;
   `stake_speakers` confirmed identical to `standard`;
   `stake_conference`/`general_conference` seeded with a single Ward
   Business note-placeholder since the ward holds no meeting those
   Sundays; ~~`primary_program`, `christmas_meeting`, `easter_meeting`,
   and `baby_blessing` were NOT confirmed~~ -- **corrected 2026-09-06**
   (migration `036`) per the user's review: every format keeps Visiting
   Authorities, Stake Business, and Closing Hymn (Primary Program's
   original best-effort guess had wrongly dropped all three).
   `primary_program` leaves out Speaker/Youth Speaker/the
   `intermediate_hymn` slot (musical numbers), replaced with the
   `primary_program` element. `christmas_meeting`/`easter_meeting` are
   identical to each other -- Standard minus Speaker/Youth
   Speaker/musical numbers, with no replacement element: those get added
   per-meeting later via that meeting's own Agenda Elements page, not
   as a template default. `baby_blessing` is confirmed identical to
   Standard as given -- the blessing itself is recorded through the
   existing Ward Business element (`sacrament_rabnm`'s `baby_blessing`
   type), no template change needed. Two new `meeting_elements` catalog rows
   added: `recognize_music` (announcing the rotation-assigned
   chorister/organist) and `primary_program`. Missionary speakers reuse
   the existing `speaker` slots (noted via topic/guest name) rather than
   getting a distinct catalog role, per the user's decision -- a real
   third speaker category (own table + form, mirroring Speaker/Youth
   Speaker) remains a legitimate but separate future item if wanted.
   Also discovered along the way: `meeting_templates` had **zero rows**
   for Sacrament Meeting before this migration, meaning
   `MusicArrangeSection`/both `SpeakersForm`s never rendered in
   production at all until this shipped.
4. ~~**Releases/New Callings/Records (`sacrament_rabnm`).**~~ Done
   (2026-09-05, converged independently in both parallel sessions on the
   same rename and the same core UX idea, then merged 2026-09-06):
   renamed to "Recognitions / Advancements / Baptisms / New Members"
   everywhere (Table Admin label, planning-view heading) -- matches what
   `RabnmSection.tsx`'s live planning-view header already called it, so
   this was mostly a consistency fix. Turned out to already be included
   in the conducting script (`lib/data/conducting.ts`'s `rabnmPrompt`) --
   that part needed no work. The real per-type form
   (`components/planning/RabnmAddForm.tsx`, a client component split out
   of `RabnmSection.tsx`): the Calling picker only shows for
   `release`/`new_calling`/`presidency_change` (the only types that
   plausibly involve one), and the date field is hidden for those three
   (the announcement happens at the meeting being planned, no separate
   date to record) but shown with a type-specific label for everything
   else (Baptism Date, Ordination Date, Birth Date, Departure Date,
   Blessing Date, Date of Record). Access restricted to the `bishopric`
   role (ward clerk/exec sec are folded into it, per the user's decision
   -- "may need its own decision" resolved as: not worth a
   finer-grained role split right now) -- previously **any logged-in
   user could add/remove these with no gating at all**; this was found
   and fixed on this branch specifically (re-checked in the server
   actions themselves, `addRabnmItem`/`deleteRabnmItem` in
   `app/meetings/[id]/planning/actions.ts`, matching the
   enforcement-boundary pattern used everywhere else in this app) -- the
   add form and Remove buttons are hidden in the UI for non-bishopric
   viewers too. This is in the live planning view, not the generic Table
   Admin grid -- the grid still can't attach people to a record since
   that lives in `sacrament_rabnm_people`, a composite-key join table
   the generic engine doesn't support (see registry.ts).
5. ~~**Sacrament Speakers (adult/youth) — rename + re-scope.**~~ Done
   (2026-09-05, converged independently in both parallel sessions on the
   identical finding): renamed Table Admin labels to "Sacrament Meeting
   Speakers (Adult)" / "(Youth)". The "re-scope" half turned out to be
   moot once checked -- `/speaker-prayer-history`'s actual "who's due"
   logic (`lib/data/speaker-prayer-history.ts`) already reads these same
   tables filtered to `stage = 'archived'` and `confirmed = true`, so
   the history-vs-forward-planning split the user wanted is already
   happening today via a query filter over one table, not two separate
   tables. Presented that finding plus the real cost of a full duplicate
   -table split (new table, migrating the live Speakers form, an
   archive-time copy step, rewriting the history query); the user chose
   to skip the schema split in both sessions independently -- just added
   a description on both tables in Table Admin clarifying the dual role
   (editing a future meeting's speakers here doesn't affect who's
   counted as recently having a turn, since only archived+confirmed rows
   count).
6. **Sortable column headers in Table Admin.** Moved to Known open items
   above (not part of the original 2026-09-04 queue).

The Table Admin update queue (5 original items, started 2026-09-04) is
now fully worked through.

## Working conventions

- Always run a syntax/type check before considering something done:
  `npx tsc --noEmit` and `npx eslint <files>`.
- Verify SQL migrations are idempotent and re-runnable before handing off.
- User is not a professional developer — prefer concrete, step-by-step
  instructions over concept-level explanations when something needs their
  action (e.g. Supabase dashboard steps).
- **This repo can have more than one active Claude Code session/branch
  at once, working without awareness of each other.** Confirmed
  happening 2026-09-04 through 2026-09-06 (this file's own migration
  numbering collision is a direct result). If a task might take more
  than one sitting, or the user mentions another session/branch, say so
  explicitly and check `git log` against the remote's default branch
  before assuming this file or the migration counter reflects the whole
  truth.
