# Ward OS — Project Context for Claude Code

Next.js / TypeScript / Tailwind app on Vercel, Supabase backend. LDS ward
meeting planning: agendas, assignments, rotations, sacrament program
publishing, announcements, youth activities.

**Production domain (always test/verify here, never a Vercel preview URL):**
https://ward-meeting-os.vercel.app

## Current migration number: 027

Migrations `022`–`024` confirmed run by the user (2026-09-04). `025` was
used by the user's own project-workflow-review session, outside this
chat -- exactly the kind of collision this file exists to warn about.
`026_hymnal_songs_number_as_text.sql` and `027_music_reference_seed.sql`
exist in the repo but still need to be run (in that order, 026 before
027 -- 027's data won't fit the old integer column). Next migration
should be `028_*.sql`. Migrations are plain `.sql` files at
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
  (kept granular on purpose, not consolidated).
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
