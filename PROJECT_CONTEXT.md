# Ward OS — Project Context for Claude Code

Next.js / TypeScript / Tailwind app on Vercel, Supabase backend. LDS ward
meeting planning: agendas, assignments, rotations, sacrament program
publishing, announcements, youth activities.

**Production domain (always test/verify here, never a Vercel preview URL):**
https://ward-meeting-os.vercel.app

## Current migration number: 026

Migrations `022`–`025` confirmed run by the user (2026-09-04/05).
Migration `025` (`apply_rotation_assignment` Postgres function, see
Assignment Rotations below) additionally verified working (2026-09-05)
via a rollback-safe functional test run directly against production in
the Supabase SQL editor -- confirmed it assigns the correct person to
the correct table and advances `next_index` correctly, with everything
the test wrote rolled back afterward. Migration `026` (Sacrament Meeting
Planning redesign, see Table Admin update queue below) written
2026-09-05, **not yet confirmed run by the user**. Next migration after
that should be `027_*.sql`. Migrations are plain `.sql` files at
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
  a meeting's own agenda elements (`meeting_planned_elements`, migration
  `026`) in order, dispatching by `resolution_kind` (`person_role`,
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
  migration `026` has zero `meeting_planned_elements` rows and falls back
  to rendering the shared `meeting_templates` list directly (no backfill
  was done, by design). Changing a meeting's `special_format` after the
  fact never re-seeds its elements -- only affects new meetings going
  forward.
- **Assignment Rotations** (`/rotations`): 7 elements rotate automatically
  (Conducting, Opening/Closing Prayer ×3 meeting types, Chorister, Organist,
  Spiritual Thought, Handbook Training presenter). Speaker/Youth Speaker and
  Presiding/Pianist intentionally do NOT rotate — `/speaker-prayer-history`
  is the manual tool that compensates for that. A rotation's "next" pointer
  advances once per meeting *created*, not per save, so a one-off override
  doesn't skip anyone in future weeks. The assignment write and the
  pointer advance happen atomically via the `apply_rotation_assignment`
  Postgres function (migration `025`) — one RPC call per rotation, not
  two separate writes — so a failure partway through can't desync the
  pointer from what was actually assigned.
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

- **No rotation has any members yet.** Discovered 2026-09-05 while
  verifying migration 025: all 11 configured rotations (bishopric-meeting
  closing/opening prayer + handbook training + spiritual thought,
  sacrament-meeting chorister/conducting/organist, ward-council and
  youth-council closing/opening prayer) currently show `member_count = 0`
  in production. Until people are assigned (via `/rotations`, or its
  `syncRotationMembership()` logic), every new meeting silently skips all
  rotation-based assignments -- not a bug, just an unfinished setup step.
- Teaching Calendar (youth leader tile) — scope not yet defined, deferred
- Bishopric-side free-text elements (spiritual thought, handbook training,
  young men coordination, impressions, calling planning, sacrament meeting
  review) can currently be entered in TWO places — new dynamic per-element
  fields AND the old `BishopricMinutesForm`'s similarly-named fixed columns.
  Not consolidated yet; ask before changing either.
- ~~`AssignmentsForm.tsx` / `BishopricAssignmentsForm.tsx` were unused
  legacy components (superseded by the dynamic planning view) — deleted
  2026-09-04.~~
- ~~`lib/data/data.ts` was a dead duplicate of `lib/data/rotations.ts`
  (same three exports, unimported anywhere) — deleted 2026-09-04.~~
- ~~`lib/mock-data.ts` was dead code from before the Supabase pivot
  (nothing imported it, only a stale comment in `lib/types.ts` referenced
  it) — deleted 2026-09-04, comment fixed.~~
- ~~`docs/architecture.md` was a byte-for-byte duplicate of the root
  `architecture.md` — deleted 2026-09-04. The survivor still describes
  the pre-Supabase Notion-backed design in places; flagged with a note at
  its top pointing to this file as the current source of truth rather
  than rewritten, since it's a historical vision doc.~~
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
   (migration `024`, registered as "Hymnal / Songbook Reference") --
   structure only, NOT populated with real hymn/song data yet (typing
   ~500+ titles from memory risked real inaccuracies; needs a proper
   source -- ask the user how they'd like this populated when picked
   back up).
3. ~~**Sacrament Planning.**~~ Done (2026-09-05, migration `026` **not
   yet confirmed run by the user**): renamed to "Sacrament Meeting
   Planning" in Table Admin. Redesigned as planned -- `special_format`
   now actually changes which elements appear (see Dynamic planning view
   above): each meeting gets its own `meeting_planned_elements` row set,
   seeded at creation time from `meeting_templates` (now keyed by
   meeting type + `format_key`), freely add/remove/reorderable per
   meeting from then on without affecting any other meeting. Generalized
   to every meeting type per the user's decision, not just Sacrament
   Meeting. Forward-only, per the user's decision -- no backfill for
   meetings created before this ships (see fallback behavior above).
   Default templates for all 10 `special_format` values written into
   migration `026`: `standard`, `testimony_meeting` ("fast Sunday"), and
   `missionary_speaker` came from the user's actual real service order;
   `stake_speakers` confirmed identical to `standard`;
   `stake_conference`/`general_conference` seeded with a single Ward
   Business note-placeholder since the ward holds no meeting those
   Sundays; **`primary_program`, `christmas_meeting`, `easter_meeting`,
   and `baby_blessing` are NOT confirmed** -- defaulted to a plain copy
   of `standard`, need the user's review/correction via the new
   `/admin/meeting-templates` page. Two new `meeting_elements` catalog
   rows added: `recognize_music` (announcing the rotation-assigned
   chorister/organist) and `primary_program`. Missionary speakers reuse
   the existing `speaker` slots (noted via topic/guest name) rather than
   getting a distinct catalog role, per the user's decision -- a real
   third speaker category (own table + form, mirroring Speaker/Youth
   Speaker) remains a legitimate but separate future item if wanted.
   Also discovered along the way: `meeting_templates` had **zero rows**
   for Sacrament Meeting before this migration, meaning
   `MusicArrangeSection`/both `SpeakersForm`s never rendered in
   production at all until now.
4. **Releases/New Callings/Records (`sacrament_rabnm`).** Rename to
   "Recognitions/Advancements/Baptisms/New Members". Purpose: ward
   business items outside of callings, for inclusion in the meeting's
   conducting view. The ward clerk and executive secretary need to be
   able to add these (that's the typical/primary path), with the
   bishopric also able to; **note:** "clerk"/"exec sec" are folded into
   the single shared `bishopric` app role today (see Architecture above)
   with no way to distinguish them for a narrower permission — may need
   its own decision if per-person (not per-role) add access matters here.
   Needs a real per-type form design: which fields are required/shown
   changes depending on the record type (release vs. new calling vs.
   baby blessing vs. baptism vs. new member vs. mission call vs.
   Aaronic Priesthood, etc. — see `RABNM_TYPES` in
   `lib/data/sacrament-constants.ts` for the current type list), so this
   isn't a simple flat-column admin grid like the others.
5. **Sacrament Speakers (adult/youth) — rename + re-scope.** *If* these
   tables continue to exist (user's own qualifier — not fully committed
   yet): rename to "Sacrament Meeting Speakers (Adult)" / "(Youth)".
   More importantly, the user sees their actual purpose differently than
   how they're built today: `sacrament_speakers_adults/youth` are
   currently forward-planning tables (a `meeting_id` FK ties a speaker
   directly to one specific upcoming meeting) — but the user wants them
   to be a **history log** of who has spoken in the past (informs future
   planning, e.g. via `/speaker-prayer-history`'s existing "who's due"
   view), not the live planning surface itself. The live planning
   surface for a specific date is item 3 above (the Sacrament Meeting
   Planning redesign) — these two items are closely related and should
   probably be designed together: item 3's per-date element planning is
   presumably what *writes* the eventual "spoke on this date" history
   record these tables would hold, once repurposed.

## Working conventions

- Always run a syntax/type check before considering something done:
  `npx tsc --noEmit` and `npx eslint <files>`.
- Verify SQL migrations are idempotent and re-runnable before handing off.
- User is not a professional developer — prefer concrete, step-by-step
  instructions over concept-level explanations when something needs their
  action (e.g. Supabase dashboard steps).
