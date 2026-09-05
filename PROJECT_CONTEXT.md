# Ward OS — Project Context for Claude Code

Next.js / TypeScript / Tailwind app on Vercel, Supabase backend. LDS ward
meeting planning: agendas, assignments, rotations, sacrament program
publishing, announcements, youth activities.

**Production domain (always test/verify here, never a Vercel preview URL):**
https://ward-meeting-os.vercel.app

## Current migration number: 027

Migrations `022`–`027` all confirmed run by the user (2026-09-05). `025`
was used by the user's own project-workflow-review session, outside
this chat -- exactly the kind of collision this file exists to warn
about. Next migration should be `028_*.sql`. Migrations are plain
`.sql` files at
the repo root, run manually by the user in the Supabase SQL editor (no
migration tool/CLI wired up). Always make migrations idempotent
(`DROP ... IF EXISTS` before `CREATE`) since partial-failure re-runs are
common. Confirm the next free number with the user before assuming — a
numbering collision with something run outside this chat has happened
before.

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
  each meeting type's configured template elements (from the element
  catalog, `meeting_elements`/`meeting_templates`) in order, dispatching by
  `resolution_kind` (`person_role`, `music`, `person_slot`, `free_text`,
  `person_and_text`, `none`). Most element types write to existing tables
  (`sacrament_assignments`, `sacrament_music`, `sacrament_speakers_adults/
  youth`); anything without a clean existing home writes to the generic
  `meeting_element_notes` table.
- **Assignment Rotations** (`/rotations`): 7 elements rotate automatically
  (Conducting, Opening/Closing Prayer ×3 meeting types, Chorister, Organist,
  Spiritual Thought, Handbook Training presenter). Speaker/Youth Speaker and
  Presiding/Pianist intentionally do NOT rotate — `/speaker-prayer-history`
  is the manual tool that compensates for that. A rotation's "next" pointer
  advances once per meeting *created*, not per save, so a one-off override
  doesn't skip anyone in future weeks.
- **Meeting Schedule** (`/meeting-schedule`): cadence rules
  (`meeting_schedule_rules`) drive a "Generate Meetings" action. Three
  cadence shapes: `weekly`, `nth_weekday` (e.g. "3rd Tuesday"), `relative`
  (e.g. "2 days after the 3rd Sunday" — computed from the anchor each month,
  not stored as its own fixed nth-weekday, since which numbered weekday that
  lands on varies month to month).
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
- `special_format` is currently just a stored label with no effect
  (confirmed by the user earlier this session, specifically re: the
  Table Admin grid) — this workflow says format IS meant to drive which
  default template gets used. These aren't necessarily contradictory
  (the admin grid not needing to compute a default vs. the real
  per-meeting flow needing to), but flag for reconciliation before
  building template-selection — don't assume "just a label for now"
  still holds once that work starts.
- No per-meeting (per-date) element reordering exists today — order
  comes from `meeting_templates.sort_order`, one fixed order per
  meeting *type*, shared by every instance of that type. This workflow
  explicitly requires reordering per specific meeting.
- "Ward business... handled in planning environments and imported into
  the meeting by date" is partially true today, but scattered:
  `calling_planning` pushes into `sacrament_rabnm` by date; Music/
  Speakers/RABNM/Rotations can all be pre-planned against a future date
  via Table Admin's calendar picker (the recent `createIfMissing`
  work) — but there's no single unified "planning environment" surface,
  it's spread across several separate Table Admin grids plus the live
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
  confirms that design was right.
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
   sources. `people.email` exists as a column but should stay sparsely
   used, populated only when genuinely known/needed, never bulk-filled.
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
- **No auth-account-to-person link exists at all.** `profiles` (login
  accounts: role, display_name, email) and `people` (the roster: name,
  email, active, notes) are entirely separate tables today, no foreign
  key between them — confirmed by search, not assumed. The "admin
  matches an authenticated account to a person" step has no data model
  or UI yet.
- **`people` only has one boolean (`active`) today**, not the richer
  label set described (adult/youth/child, attending/not, moved).
  Concrete, well-scoped gap — good candidate to build once past the
  vision-gathering phase.

## Known open items

- Teaching Calendar (youth leader tile) — scope not yet defined, deferred
- Bishopric-side free-text elements (spiritual thought, handbook training,
  young men coordination, impressions, calling planning, sacrament meeting
  review) can currently be entered in TWO places — new dynamic per-element
  fields AND the old `BishopricMinutesForm`'s similarly-named fixed columns.
  Not consolidated yet; ask before changing either.
- `AssignmentsForm.tsx` / `BishopricAssignmentsForm.tsx` are unused legacy
  components (superseded by the dynamic planning view) — safe to delete,
  never got around to it.
- ~~`lib/data/data.ts` was a dead duplicate of `lib/data/rotations.ts`
  (same three exports, unimported anywhere) — deleted 2026-09-04.~~
- Agenda items for Bishopric/Ward Council/Youth Council should eventually
  get a share-token-based no-login view for invited attendees (security
  through an unguessable link, not auth) — not built yet.
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
    scheduled job vs. a manual "Archive past meetings" action).
  - **Cancel a meeting from the dashboard.** A status control separate
    from the planning-progress `stage` field — something like
    Scheduled/Cancelled, with a reason when cancelled. Likely a new
    column (or two) on `meetings` rather than overloading `stage`, since
    `stage` tracks how far along the program is, not whether the meeting
    is happening at all. Lower priority than the auto-archive item.
- **Cadence rules for Youth Activities / Ward Events.** (2026-09-04,
  user's note was cut off mid-thought -- "We likely need" ... nothing
  after) Wants the same kind of rule-based pre-scheduling `/meeting-
  schedule` already does for meetings (weekly / nth-weekday / relative
  cadence, a "Generate" action) applied to `youth_activities` and
  `ward_events` too, so recurring activities/events don't have to be
  entered one at a time. Likely reuses the same cadence-shape concept
  (see Meeting Schedule above) rather than inventing a new one, but
  needs the rest of the requirement (whatever came after "We likely
  need") before designing -- ask when picked up.
- **Consolidate the two Music tiles on the landing page.** (2026-09-05,
  instruction still pending -- user said "see next prompt," not yet
  given as of this note) The two candidate tiles, found in `app/page.tsx`
  under the "Music" section (visible to `music_planner` + `bishopric`):
  "Sacrament Music Planning" (→ `/music`, bulk/single hymn entry) and
  "Music Coordination" (→ `/music-coordination`, a read-only status
  overview across upcoming meetings). User wants a single tile for
  "sacrament meeting music planning" instead of these two -- exact
  merged behavior/routing not yet specified.

## Table Admin update queue (FIFO — work top to bottom)

Requested while going through the `/admin` Table Admin feature
(2026-09-04). Per the user: return to these in the order added, one at a
time, rather than building ahead. Update this list (strike/remove an item,
or note partial progress) as each is picked up.

1. ~~**Admin-editable option lists for `calling_status`/`release_status`.**~~
   Done (2026-09-04) — `admin_select_options` table (migration `022`,
   **user still needs to run this in the Supabase SQL editor**),
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
3. ~~**Sacrament Planning.**~~ Done (2026-09-04): renamed to "Sacrament
   Meeting Planning". Turned out simpler than the queue note originally
   described, once the user clarified two things: special_format stays
   informational only (no default-template behavior), and per-date
   element reordering doesn't need to live here at all -- true order
   editing happens later in the real per-meeting planning view, once
   elements are "called in per the template." So the only real gap was
   that Table Admin's Meeting picker required an existing `meetings` row
   -- fixed by generalizing `/music`'s existing "find or create a
   meeting for this date" pattern into `getOrCreateMeetingId`
   (lib/data/meetings.ts) and wiring it into every Sacrament Meeting
   table's calendar picker (`foreignKey.createIfMissing`) -- so you can
   now plan against any future Sunday directly, meeting row created
   automatically on save.
4. ~~**Releases/New Callings/Records (`sacrament_rabnm`).**~~ Done
   (2026-09-05): renamed to "Recognitions / Advancements / Baptisms /
   New Members" in Table Admin -- turned out the live per-meeting
   planning view (`RabnmSection.tsx`) already used that exact name, so
   this was really a consistency fix. The "clerk/exec sec need access"
   note turned out to be a non-issue: they're already covered by the
   single shared `bishopric` role by design (see Architecture above),
   which already gates this feature everywhere it appears. Built the
   real per-type form (`components/planning/RabnmAddForm.tsx`, a new
   client component split out of `RabnmSection.tsx`): the Calling picker
   only shows for release/new_calling/presidency_change (the only types
   that plausibly involve one), and the date field is hidden for those
   three (the announcement happens at the meeting being planned, no
   separate date to record) but shown with a type-specific label for
   everything else (Baptism Date, Ordination Date, Birth Date, etc.).
   This is in the live planning view, not the generic Table Admin grid --
   the grid still can't attach people to a record since that lives in
   `sacrament_rabnm_people`, a composite-key join table the generic
   engine doesn't support (see registry.ts).
5. ~~**Sacrament Speakers (adult/youth) — rename + re-scope.**~~ Done
   (2026-09-05): renamed to "Sacrament Meeting Speakers (Adult)" /
   "(Youth)". The re-scope turned into a discovery rather than a build:
   checked `/speaker-prayer-history`'s actual "who's due" logic
   (`lib/data/speaker-prayer-history.ts`) and it already reads these
   same tables filtered to `stage = 'archived'` and `confirmed = true`
   -- so the history-vs-forward-planning split the user wanted is
   already happening today via a query filter over one table, not two
   separate tables. Presented that finding plus the real cost of a full
   duplicate-table split (new table, migrating the live Speakers form,
   an archive-time copy step, rewriting the history query) and the user
   chose to skip the schema split -- just added a description on both
   tables in Table Admin clarifying the dual role (editing a future
   meeting's speakers here doesn't affect who's counted as recently
   having a turn, since only archived+confirmed rows count).
6. **Sortable column headers in Table Admin.** (2026-09-05, user's own
   words: "future upgrade") Click a column heading in `AdminTableEditor`
   to sort the grid by that column, presumably click-again to reverse.
   Client-side only (re-sort the already-fetched `rows` array in
   component state) -- doesn't need a schema or server change.

## Working conventions

- Always run a syntax/type check before considering something done:
  `npx tsc --noEmit` and `npx eslint <files>`.
- Verify SQL migrations are idempotent and re-runnable before handing off.
- User is not a professional developer — prefer concrete, step-by-step
  instructions over concept-level explanations when something needs their
  action (e.g. Supabase dashboard steps).
