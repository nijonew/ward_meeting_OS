# Ward OS — Project Context for Claude Code

Next.js / TypeScript / Tailwind app on Vercel, Supabase backend. LDS ward
meeting planning: agendas, assignments, rotations, sacrament program
publishing, announcements, youth activities.

**Production domain (always test/verify here, never a Vercel preview URL):**
https://ward-meeting-os.vercel.app

## Current migration number: 047

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
  per the user's review -- see Table Admin queue item 3 below):
  confirmed run.
- `037` (`meetings.cancelled`/`cancellation_note` -- Cancel a meeting
  from the dashboard) and `038` (re-documents/corrects the
  `bishopric_assignments_role_check` constraint): confirmed run.
- `039` (new `meeting_cancellations` table -- generalized from an
  earlier conference-only design, see Known open items below):
  confirmed run.
- `040` (seeds `hymnal_songs` with the 1985 Hymnal and Hymns for Home
  and Church, completing Music Reference -- see Table Admin queue item
  2 below): confirmed run.
- `041` (drops `sacrament_assignments.confirmed`, re-defines
  `apply_rotation_assignment` to match -- priority queue item, see Known
  open items below): **first attempt failed in production** -- two
  anon-facing RLS policies gated on `confirmed` predated this repo's
  migration history and blocked the column drop (`cannot drop column
  confirmed ... because other objects depend on it`). File updated to
  drop those two policies by name and replace them with one gated on
  meeting stage instead (matching this migration's own new rule) --
  confirmed run (with the corrected version).
- `042` (new `teaching_assignments` table -- Teaching Calendar, see Known
  open items below): confirmed run.
- `043` (`calling_planning` gains `date_initiated`/`candidates_text` --
  Calling Planning flat-grid rebuild, see the Calling planning workflow
  section above): confirmed run.
- `044` (`calling_planning` gains `candidate_person_ids uuid[]`, drops
  `candidates_text` and `selected_person_id` -- Candidates
  multi-select, see the Calling planning workflow section above):
  confirmed run.
- `045` (new `youth_class_teachers` table -- Youth Teaching Planning
  per-person/per-class access control, see Known open items below):
  confirmed run.
- `046` (Sacrament Meeting agenda redesign -- new `sacrament_administered`
  catalog element, new `sacrament_program_items` table for the Speakers
  & Music list, `sacrament_planning.has_stake_business`, and retires
  Chorister/Organist/Pianist/Speaker/Youth Speaker/Intermediate Hymn as
  fixed template lines, see the Dynamic planning view architecture entry
  above): confirmed run.
- `047` (new `sacrament_program_templates` table -- Speakers & Music
  pre-fill by format, see the Dynamic planning view architecture entry
  above): still needs to be run.

Next migration should be `048_*.sql`. Migrations are plain `.sql` files at
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
  - **Rebuilt as a single agenda grid, 2026-09-09** (the user's own
    request, with a screenshot of their real spreadsheet agenda as the
    reference: "I want them to also be more agenda-like. single line for
    each element with a field that can be edited after being
    pre-filled"). Every element is now one line in one grid -- label
    left, its pre-filled editable value right, in the meeting's own
    element order -- with a single "Save All Changes" button, the same
    dirty-tracking/save-feedback pattern as Assignment Rotations,
    Teaching Calendar, and Calling Planning. This replaced a stack of
    one-bordered-box-per-element, each with its own Save button.
    Applies to every meeting type, not just Sacrament Meeting.
    - **Music and Speakers are inline agenda rows now.** They used to be
      pulled *out* of the agenda (`renderedMusicKinds`/`renderedSlotKinds`)
      and rendered as their own big sections underneath, so hymns and
      speakers appeared out of order, detached from the agenda they
      belong to. Same storage as before (`sacrament_music`,
      `sacrament_speakers_adults/youth`) -- only the UI moved.
      `MusicArrangeSection.tsx`, `SpeakersForm.tsx`, and
      `DynamicElementField.tsx` were deleted outright rather than left
      unlinked, along with `dynamic-planning-actions.ts` and
      `saveAdultSpeakers`/`saveYouthSpeakers`/`arrangeMusicItem` (plus
      `saveAssignments`, which had already been dead before this).
    - **A repeatable element expands to `slot_count` rows** (`speaker`,
      `youth_speaker`, `intermediate_hymn`, `musical_number`) -- so the
      standard Sacrament template's "speaker: 2" renders Speaker 1 and
      Speaker 2 as their own agenda lines, matching the user's
      spreadsheet, instead of one 9-slot form. Never fewer rows than are
      already filled in (lowering `slot_count` later must not orphan or
      hide an existing speaker), plus one spare so another can be added
      without editing the template first. A repeatable music row's
      `slot` is now assigned positionally from its place in the agenda
      rather than picked from the old per-item "Slot" dropdown.
    - ~~Ward Business / Stake Business / Recognitions are real editable
      rows.~~ True only for this first pass -- Ward Business and Stake
      Business both changed shape again the very next day, see below.
      Recognitions is unaffected, still a plain text row writing to
      `sacrament_planning.recognitions` (though not actually part of any
      real template's element list as of this writing -- see that
      rework's own note on this).
    - **Still their own sections below the grid**, deliberately: the
      collections that add/remove rows rather than filling in a fixed
      line (RABNM, Agenda Items, Action Items) plus Bishopric Minutes and
      Council Notes.
    - Field names encode their own destination
      (`role::<key>`, `note::<key>::person|text`, `planning::<column>`,
      `music::<type>::<slot|->::number|title|performer`,
      `speaker::<adults|youth>::<slot>::person|guest|topic`), built in
      one place (`lib/data/agenda-rows.ts`) and parsed back apart in
      another (`app/meetings/[id]/agenda-actions.ts`'s `saveAgendaGrid`),
      so the renderer never needs to know which table anything lives in.
      Every write is scoped to exactly the submitted fields -- no
      blanket "delete every row for this meeting first" -- so an element
      that isn't on this meeting's agenda, or a column the grid doesn't
      show (a speaker's `duration`/`confirmed`), is never cleared by a
      save from here. `saveAgendaGrid` re-checks the bishopric role
      server-side, matching the page's own gate.
  - **Reworked line by line against a real agenda screenshot, 2026-09-10**
    (the user's own notes, working down the page in order -- "here are
    my notes going down the page in order of appearance"). This is a
    genuinely different, more detailed pass than the grid rebuild above
    -- that one restructured *how* elements render; this one changes
    *which* elements exist and what each one's fields actually are, for
    Sacrament Meeting specifically. Applies only to Sacrament Meeting
    except where noted -- Bishopric Meeting/Ward Council/Youth Council
    already got the single-agenda-grid treatment from the rebuild above
    and keep it unchanged here.
    - **Calling-restricted dropdowns, extended to every person_role row
      on every meeting type** (the user's own words: "all dropdowns
      should follow the rules for the field by calling rather than have
      all people in the dropdown"). New `getEligiblePeopleForElement` /
      `getEligiblePeopleByElementKey` (`lib/data/rotations.ts`,
      exporting what used to be `eligiblePeopleByColumn`'s private
      helpers, `computeEligiblePersonIds` and `personOptionsByIds`) --
      Presiding and Conducting resolve straight from calling names
      (fixed-by-calling, same as `applyFixedSacramentRoles`, not
      rotation-table-driven); every other person_role element resolves
      from its real `rotations` row, if one exists. Returns `null` (not
      an empty array) when no calling-based rule is configured at all,
      so the page falls back to every active person rather than an
      empty dropdown -- an empty *array* still means "a rule exists but
      nobody currently holds the calling," surfaced as-is, matching the
      applied-assignment grid's own established "No one eligible"
      handling rather than silently widening it. This is called once
      per planning-page load for every person_role element actually on
      that meeting's agenda (`app/meetings/[id]/planning/page.tsx`), not
      hardcoded to Sacrament Meeting.
    - **Presiding defaults to the Bishop, but the dropdown also offers
      the rest of the Bishopric and the Stake Presidency** (new
      `STAKE_PRESIDENCY_CALLING_NAMES` constant) -- the one row with a
      real default value pre-filled when no `sacrament_assignments` row
      exists yet (`defaultPresidingId`, resolved via new
      `getCurrentHolderIdByCallingName` in `lib/data/callings.ts`). In
      practice this rarely matters since `applyFixedSacramentRoles`
      already writes a real Presiding row at meeting creation -- it's a
      defensive fallback for the edge case where the Bishop calling was
      vacant at creation time.

      **Bug found and fixed 2026-09-10**: the two Stake Presidency
      counselor names were guessed as "Stake President First/Second
      Counselor" -- didn't match this ward's actual roster naming.
      `computeEligiblePersonIds`'s `calling_names` source does an exact
      match against `callings.name`, so a wrong guess here means the
      counselors silently never appear, not an error. Confirmed
      directly with the user: the roster's real names are "Stake
      Presidency First Counselor"/"Stake Presidency Second Counselor"
      ("Presidency," not "President") -- `STAKE_PRESIDENCY_CALLING_NAMES`
      corrected to match. If a calling like this ever seems to have no
      eligible people despite someone clearly holding it, suspect a
      name mismatch (or the calling not existing in `/callings` at all)
      before assuming the eligibility logic itself is wrong.
    - **Chorister and Organist are no longer their own agenda lines** --
      both render inline on the Recognize Music line instead (new
      `recognize_music` `AgendaRow` kind, two `PersonSelect`s side by
      side), each still calling-scoped via the same eligibility lookup.
      Storage is completely unchanged (`sacrament_assignments.role =
      'chorister'/'organist'`, same `role::<key>` field encoding
      `saveAgendaGrid` already parsed) -- only the *rendering* groups
      them onto one line; Assignment Rotations still tracks both exactly
      as before. **Pianist is removed entirely** -- no line, no
      replacement.
    - **New "Administration of the Sacrament" section** groups the
      Sacrament Hymn with a new "Sacrament Administered" cue right after
      it (migration `046`: new `sacrament_administered` catalog element,
      `resolution_kind: 'none'`, inserted into every sacrament format
      that already has a Sacrament Hymn, both in the shared templates
      and in already-seeded non-archived meetings). The section heading
      itself isn't a real catalog element -- `buildAgendaRows` just
      synthesizes a `section`-kind divider row whenever it's about to
      render the Sacrament Hymn.
    - **Ward Business moved to its own page**, `/meetings/[id]/ward-business`
      (the user's own words: "Handle the RABNM in its own separate
      page"). The agenda grid's own Ward Business line is now "a fixed
      line without any field" (also the user's own words) -- a banner
      with a "Manage →" link, nothing else. `RabnmSection` itself is
      completely unchanged, just relocated from the bottom of the
      planning view to this new page -- resolves the exact nested-`<form>`
      problem that made inlining it directly impossible: RabnmSection's
      own add/remove forms can't be real `<form>`s nested inside the
      main agenda grid's single big `<form>` (HTML forbids nested
      forms). The `AgendaRow` `banner` kind gained an optional `href` for
      this (and for Speakers & Music, below).
    - **Stake Business is a yes/no toggle**, not free text describing
      the business itself -- new `sacrament_planning.has_stake_business`
      boolean (migration `046`); the existing `stake_business` text
      column is *repurposed* to hold who's announcing it (a short
      answer), shown only once the box is checked
      (`StakeBusinessCell` in `AgendaGridForm.tsx`, its own small
      stateful piece since the announcer field's visibility has to
      react to the checkbox). The checkbox needs the same hidden-fallback-
      before-the-real-input trick used elsewhere in this app for
      checkboxes inside a bigger form (e.g. Calling Planning's
      multi-select) -- an unchecked box submits nothing on its own, so
      without the fallback, unchecking it would leave the old `true`
      value in place forever instead of ever saving `false`.
    - **Speakers & Music is a freely add/remove/reorderable list** --
      something the user said they'd been "trying to explain... for
      some time": "a dropdown which will allow the selection of youth
      speakers 1-9, speakers 1-9, musical numbers 1-9, intermediate
      hymn, testimonies," added or removed as its own line, in whatever
      order. This fully replaces the fixed `slot_count`-driven Speaker/
      Youth Speaker/Intermediate Hymn/Musical Number elements from the
      grid rebuild above -- migration `046` removes all three from
      every Sacrament Meeting template (and from already-seeded
      non-archived meetings) entirely.
      - ~~On its own page (`/meetings/[id]/speakers-music`)~~ -- true for
        about a day. **Moved back inline, 2026-09-10**, per the user's
        own follow-up: "I would like to move the speaker/music
        management items directly into the agenda rather than by link."
        `SacramentProgramSection` now renders directly on the planning
        page, between two separate `AgendaGridForm` instances --
        `app/meetings/[id]/planning/page.tsx` splits the agenda's
        elements in two right at Closing Hymn/Prayer, so this section's
        own add/remove/save `<form>`s stay valid HTML as *siblings* of
        the two grid forms rather than needing to nest inside either of
        them. Ward Business/RABNM is unaffected -- still its own
        separate page, only Speakers & Music came back inline. The
        now-deleted standalone page's route folder was removed outright
        (not redirected -- it existed too briefly to have been
        bookmarked).
      - **Pre-filled from the meeting's own format, 2026-09-10** (the
        user's own words: "the intent is that the templates will
        pre-fill the speaker/music management... with the speaker/music
        elements for that meeting type") -- new `sacrament_program_templates`
        table (migration `047`: `format_key`, `item_key`, `sort_order`)
        and `seedSacramentProgramItemsForMeeting`, called at both
        meeting-creation sites (`app/meetings/new/actions.ts`,
        `lib/data/meeting-schedule.ts`'s Generate Meetings) alongside
        the existing `seedPlannedElementsForMeeting` call, same "seeded
        once at creation, then freely edited from there" pattern as
        every other per-meeting template in this app -- changing
        `special_format` later never re-seeds it, matching that same
        established precedent. Default lists were reconstructed from
        this repo's own migration history (033's original seed data, as
        corrected by 036), since migration 046 deleted the real
        `slot_count` values without recording them anywhere else:
        `standard`/`stake_speakers`/`baby_blessing` all get Youth
        Speaker ×2, Speaker ×2, Intermediate Hymn ×1 (confirmed
        identical to each other back in migration 033); `missionary_speaker`
        gets Youth Speaker ×1, Speaker ×2, Intermediate Hymn ×1; every
        other format (Testimony Meeting, Primary Program, Christmas/
        Easter, Stake/General Conference) gets nothing, matching that
        none of them ever had these as fixed defaults, before or after
        migration 046.
      - New `sacrament_program_items` table (migration `046`) tracks
        only **order and membership** -- one row per chosen item, keyed
        by `item_key` (`"speaker_3"`, `"musical_number_5"`, or the bare
        string `"testimony"`). The actual data still lives in the same
        `sacrament_speakers_adults/youth` and `sacrament_music` tables
        everything else already reads, keyed by that same value as
        their own `slot` -- this table never duplicates that data, and
        removing an item also deletes its underlying row so nothing
        orphaned lingers with no visible agenda entry.
      - `lib/data/sacrament-program.ts` (server-only fetch) and
        `lib/data/sacrament-program-shared.ts` (pure types/helpers, no
        `createClient` import) are deliberately two files -- importing
        the server file's `next/headers` dependency from
        `SacramentProgramSection.tsx` (a Client Component) broke the
        build outright the first time this was written as one file;
        splitting them is the fix.
      - **Speaker/Youth Speaker rows**: a person picker, or a guest
        name -- "It will not include a guest name field unless
        necessary" (the user's own words) is handled by new
        `SpeakerPersonOrGuestField.tsx`, a small client toggle that
        keeps the guest-name input out of the DOM entirely until asked
        for (and vice versa). No topic field, no duration, no
        confirmed checkbox -- explicitly dropped per the same note;
        those columns still exist and are simply never touched by this
        UI, same "don't touch what the grid doesn't show" principle as
        the main agenda grid.
      - **Musical Number rows**: Title, Individual-or-Group Name (one
        plain-text field, not a structured person link), and
        Accompanist (a real person picker -- `accompanist_id` is an
        actual FK). **Intermediate Hymn rows**: Hymn Number + Title
        only, same shape as every other hymn line in this app -- no
        performer/accompanist, it's congregational. Intermediate Hymn's
        own dropdown option has no explicit number (unlike the other
        three, numbered 1-9 by the user's own design) -- picking it
        auto-assigns the next free `intermediate_hymn_N` slot, the same
        positional numbering `sacrament_music.slot` already used before
        this rework.
      - **Testimony** is a placeholder line with no underlying data row
        at all -- open testimony-bearing needs nothing filled in.
      - Each item is its own small `<form>` (Save) plus plain
        `useTransition` buttons (Remove, reorder) -- these are siblings
        of the two surrounding grid `<form>`s, not descendants of
        either, so nothing here hits the nested-`<form>` restriction.
    - **Four named sections, 2026-09-10** (the user's own request,
      given in these exact words): "Opening, administration of the
      sacrament, teaching program, closing." Opening covers everything
      up through Recognize Music/Ward Business/Stake Business;
      Administration of the Sacrament (already built, see above) covers
      Sacrament Hymn + Sacrament Administered; Teaching Program is the
      heading directly above `SacramentProgramSection`; Closing covers
      Closing Hymn/Prayer. Opening and Closing are synthesized
      `section`-kind divider rows the same way Administration of the
      Sacrament already was -- Closing anchored to Closing Hymn the same
      way Administration is anchored to Sacrament Hymn, and Opening
      prepended directly by the page (rather than inside
      `buildAgendaRows` itself) since it's tied to *being the first of
      the two grid halves*, not to a specific element key the other two
      can key off reliably.
    - **"Meeting Info" as a section is gone** (the user's own words:
      "delete the meeting info section") -- `PlanningInfoForm.tsx`
      deleted outright. Special Format moved to a small inline control
      at the very top of the planning page (its own tiny `<form>`
      calling the existing `savePlanningInfo`, trimmed down to just that
      one field); Hidden Notes wasn't carried anywhere else -- the
      column still exists, unused, same "harmless but real" treatment
      already given to `callings.title_prefix` elsewhere in this file.
    - **Not built today, deliberately deferred**: "Announcements will
      end up being dynamic and will include the announcements that are
      marked to be announced in sacrament meeting" -- the user's own
      words, describing a future direction, not a change to make right
      now. The Announcements line still renders as a plain banner cue.
    - **One combined "Save All Changes" button for both grid halves,
      2026-09-10** (the user's own request: "we can remove the save all
      changes button from the sacrament administration section," then,
      when asked whether that meant losing the ability to save the
      Presiding-through-Sacrament-Hymn half outright, confirmed "one
      combined button for both halves"). New
      `components/planning/CombinedAgendaGrids.tsx` (Client Component)
      renders both `AgendaGridForm` instances -- unchanged in every
      other respect, still two real `<form>`s for the reason given
      above -- with new optional `formId`/`hideActions`/`onDirtyChange`/
      `onStateChange` props on `AgendaGridForm` itself: `hideActions`
      suppresses each form's own button/feedback while it still owns a
      real `<form id="...">` and its own `useActionState` submission
      underneath, and the two callbacks report that form's dirty/
      pending/result state up to the wrapper. One visible button in the
      wrapper calls the browser's native `form.requestSubmit()` on both
      underlying `<form id="...">` elements by id when clicked --
      exactly as if each form's own (now-hidden) button had been clicked
      -- and shows combined Saving/disabled/Saved state across both.
      Teaching Program (`SacramentProgramSection`, unaffected otherwise)
      renders via a `children` slot between the two forms, same position
      as before. Every other meeting type still renders a single
      `AgendaGridForm` directly with its own default button --
      `CombinedAgendaGrids` is Sacrament-Meeting-only, used from
      `app/meetings/[id]/planning/page.tsx`'s existing `isSacrament`
      branch. Also removed, same request: the description paragraph
      under Teaching Program ("Pre-filled from this meeting's format --
      add or remove speakers...") -- purely cosmetic, no behavior
      change.
- **Assignment Rotations** (`/rotations`): two genuinely different
  mechanisms, previously documented (and displayed on `/rotations`) as
  if they were one, which turned out to be a real source of confusion
  (see the 2026-09-06 investigation below):
  - **Generic, `rotation_members`-driven** (6 elements): Opening/Closing
    Prayer ×3 meeting types, Chorister, Organist, Spiritual Thought ×3
    meeting types (Bishopric/Ward Council/Youth Council, the latter two
    added migration `034`), Handbook Training presenter. A rotation's
    "next" pointer advances once per meeting *created*, not per save, so
    a one-off override doesn't skip anyone in future weeks. The
    assignment write and the pointer advance happen atomically via the
    `apply_rotation_assignment` Postgres function (migration `025`) —
    one RPC call per rotation, not two separate writes. Every rotation's
    member order and "next up" pointer were calibrated against the
    ward's actual real 2026 rotation pattern (migration `034`).
  - **Fixed by calling, no `rotation_members` list at all** (Presiding,
    Conducting — Sacrament Meeting only): `applyFixedSacramentRoles`
    (`lib/data/rotations.ts`) sets Presiding to whoever currently holds
    the `Bishop` calling (never rotates), and Conducting by cycling
    Bishop → Bishopric First Counselor → Bishopric Second Counselor
    based on calendar month (`month % 3`) — reading each calling's
    *current holder* fresh every time, not a stored member order. A
    stale/unused `rotations` row can still exist for either (older
    data, or an artifact of once being configured differently) —
    `applyRotationsToNewMeeting` explicitly skips both for Sacrament
    Meeting, so any such row is inert. `/rotations` now hides
    `presiding`/`conducting` from the rotation-order cards entirely
    (they had no real effect and looked like a normal editable rotation)
    and explains the fixed-by-calling mechanism in its own note instead.
  - Speaker/Youth Speaker/Pianist do not auto-assign at all —
    `/speaker-prayer-history` is the manual tool that compensates for
    Speaker/Youth Speaker specifically.
  - **Investigated 2026-09-06** (user report: "conducting is only
    pulling one person from the bishopric"): root cause not confirmed
    without live DB access, but the most likely explanation is that the
    `Bishopric First Counselor`/`Bishopric Second Counselor` callings
    don't currently have a `current_holder_id` set in production (only
    `Bishop` does) — `applyFixedSacramentRoles` silently skips inserting
    an assignment when a calling has no holder, so 2 of every 3 months
    would get no Conducting assignment at all rather than a wrong one.
    Ask the user to check Table Admin → Callings for both counselor
    callings' current holder before assuming anything else is wrong;
    the new grid below (a `/rotations` addition) makes this immediately
    visible without needing to check the database directly.
  - Separate and unrelated: `youth_activity_rotations`/
    `youth_activity_rotation_members` (migration `032`) rotate plain-text
    *groups* (not people) onto `youth_activities` rows on a fixed
    nth-Wednesday cadence -- see Vision & Intended Workflows below.
  - **Applied-assignment grid** (`/rotations`, built 2026-09-06, the
    user's own request): meetings down the Y axis, roles across the X
    axis, a person-picker per cell -- reads/writes the exact same
    `sacrament_assignments`/`bishopric_assignments` rows every other
    view does, tabbed by meeting type, filtered to a "through date"
    range. Per the user's framing ("the rotation order is secondary to
    the actual applied order by meeting and all assignments"), this is
    now the primary way to see and fix who's assigned to what,
    regardless of whether that value came from a fixed calling order, a
    rotation pointer, or a manual pick -- editing a cell never touches
    any rotation's member order or pointer, so it can't desync future
    meetings. The rotation-order cards below it remain for correcting
    the *default* new meetings get seeded with. **Refined 2026-09-06**
    per the user's follow-up feedback:
    - **No Presiding column** -- it always defaults to the Bishop, so
      there was never anything to pick.
    - **Each column's dropdown is scoped to who could actually hold
      that role by calling**, not every active person in the ward. For
      Conducting (Sacrament Meeting), that's whichever of Bishop/1st
      Counselor/2nd Counselor currently has a holder, straight from the
      same three callings `applyFixedSacramentRoles` itself reads. For
      every other column, it's computed fresh from that role's real
      `rotations` row (`eligibility_source`/`eligibility_calling_names`)
      via a new `computeEligiblePersonIds` helper shared with
      `syncRotationMembership` -- not the possibly-stale stored
      `rotation_members` list, so it can't drift out of sync with who
      actually holds the relevant calling(s) today. A column with no
      one currently eligible shows a "No one eligible — check callings"
      hint rather than silently falling back to everyone (that fallback
      would have masked exactly the kind of vacant-calling bug being
      investigated above). The currently-assigned person always stays
      selectable even if a calling change since means they're no longer
      "eligible," so an old assignment can't be silently blanked out by
      the narrower list.
    - **One save button, not one per row** (2026-09-06, the user's own
      follow-up): the whole grid is now a single `<form>` (a `<table>`
      nests inside a `<form>` fine -- the earlier per-row-`<form>`
      workaround, spanning `<td>`s via the HTML `form` attribute, was
      only needed because a `<form>` itself can't wrap multiple `<td>`s)
      submitting one `saveAssignmentGrid` action with a single "Save All
      Changes" button. Field names are `"<meetingId>::<roleKey>"` so one
      submit carries every row's selects; the action groups them back
      apart before writing.
    - **Visible save feedback + a disabled-until-dirty button**
      (2026-09-06, the user's own follow-up: "there does not seem to be
      any response and thus there is no confidence that anything
      happened"): the grid moved into its own client component,
      `components/rotations/AssignmentGridForm.tsx`, since dirty-tracking
      and a pending/success indicator both need client state -- a plain
      server-action `<form>` gives neither. The button reads "Saving..."
      while pending and is disabled until the form actually changes (an
      `onChange` on the `<form>` itself, which change events bubble up
      to naturally); after a successful save it shows "Saved." until the
      next edit. Resets the dirty flag by comparing `useActionState`'s
      returned state object across renders during render itself, not in
      a `useEffect` -- React's own guidance for "respond to a value that
      just changed," and avoids an eslint `react-hooks/set-state-in-effect`
      violation calling `setState` synchronously inside an effect would
      have caused.
    - **"Push rotations starting `<date>`"** (2026-09-06, the user's own
      request, "will help with manual input"): each rotation-order card
      below the grid gained a small form -- pick a date, and
      `pushRotationToUpcomingMeetings` (`lib/data/rotations.ts`) fills
      the grid from that rotation's own member order for every upcoming
      meeting of that type from that date forward, advancing the
      pointer once per meeting actually filled. Solves the real
      backlog case: a meeting created back when a rotation had zero
      members (see the empty-rotation-membership finding -- the user is
      populating real membership directly, 2026-09-08: "working on it")
      never got its assignment row written by
      `applyRotationsToNewMeeting` at creation time, and the grid alone
      has no way to retroactively fill that blank. Only ever fills a
      currently-blank cell -- a meeting that already has an assignment
      for that role is left untouched, same "override wins, pointer
      only advances for what's actually applied" rule used everywhere
      else in this app.
      - **Considered, then explicitly declined by the user (2026-09-08)
        -- not a gap, don't revisit without new instruction:** the user
        initially described a possible exception where the Tuesday
        meeting following a shortened 3rd-Sunday Bishopric Meeting would
        copy that Sunday's rotation assignments rather than rotate on
        its own. After being asked the specific questions needed to
        design it (which roles would carry over, snapshot-vs-live-copy,
        whether the rotation pointer should hold), the user changed
        their mind: "let's not make a rule on this... we don't need to
        hold the rotation and it can be treated like any other meeting
        and rotate as normal." No special-case behavior exists or is
        planned for this Tuesday meeting -- it rotates exactly like any
        other Bishopric Meeting occurrence, same as before this was
        ever raised.
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

**Built 2026-09-08** (priority queue items #2 and #3), closing what
used to be two separate conflicts here:
- **Calling-based non-admin viewing**, via `meeting_type_members`
  exactly as this workflow specifies (not the "share-token, no-login"
  idea "Known open items" used to describe, which was superseded and is
  now removed rather than left as a stale note). New
  `getVisibleMeetingTypesForUser` (`lib/data/meeting-type-access.ts`,
  built earlier the same day for the "My meetings" tiles) resolves
  auth user -> `people` row -> callings held -> `meeting_type_members`
  -> meeting types; `app/meetings/[id]/archived` (kept that route name
  despite now serving more than archived meetings, per the user's own
  choice to extend it rather than build a second renderer) checks it
  for Bishopric Meeting/Ward Council/Youth Council. Reachable from the
  same per-type "My meetings" tile -> `/dashboard?type=X` -> click a
  meeting row, per the user's own choice of entry point -- a non-admin
  now lands on this read-only view instead of the edit form.
- **Live/archived visibility split for notes**, scoped deliberately
  narrow: only the Minutes/Action Items/Council Notes sections are
  suppressed for a non-admin until the meeting is archived (`showRealTimeNotes`
  in that page) -- the rest of the agenda (role assignments, ward
  business, music, speakers, RABNM) is visible the moment a meeting
  goes live, matching this workflow's own step 4 ("once live... can
  view it") rather than waiting for archiving. This split may need
  revisiting once the bigger meeting-display redesign (still to be
  discussed, see Known open items) lands -- flagged in that page's own
  comment.

**Real, pre-existing security gap found and fixed while building
this:** `/meetings/[id]/planning` and `/meetings/[id]/live` had *no
role check at all* before 2026-09-08 -- any logged-in account
(music_planner, communications_specialist, any youth role) could edit
any meeting's assignments/music/speakers/free-text elements, for any
meeting type, and `/live` didn't even require login. Editing is now
admin-only (bishopric role) on both; a non-admin hitting either gets
redirected to the read-only view instead. This wasn't something the
user asked to fix directly -- it surfaced while scoping how a
non-admin would actually reach the new viewer, and confirming it
mattered enough to lock down now rather than let a "read-only viewer"
coexist with the old wide-open edit surface. The Sacrament Meeting
public program page (`/meetings/[id]/public`) had a related, milder
version of the same gap -- no stage check at all, so it would return
real content even for a meeting still in `template`/`planning`/`review`,
or one already `archived` (the Vision workflow's own "no calling-based
*or* public access at all once archived" rule) -- now restricted to
`ready`/`live` for anyone who isn't an admin (admins can still preview
it at any stage).

**Also found and fixed along the way:** `getMeetingTypes()`'s `isBuilt`
flag (`lib/data/meetings.ts`) had been `true` only for Sacrament
Meeting and Bishopric Meeting this whole time, despite Ward Council and
Youth Council having full Template/Planning/Live/Archived support for
a while now -- every dashboard row for those two types was rendering as
a non-clickable "Coming soon" regardless of role. Fixed to `true` for
all four types; this was blocking the calling-based viewer from being
reachable for exactly those two types, which is what surfaced it.

**Sacrament Meeting is deliberately excluded from this same viewer**
(the user's own decision, 2026-09-08, after flagging the tension with
this file's own prior "admin-only once archived, deliberate difference"
note): a calling-holder's Sacrament Meeting tile links straight to the
existing `/meetings/[id]/public` page while `ready`/`live` -- no new
content, exactly what the public program already shows, per the user's
explicit choice -- and reverts to admin-only once archived, preserving
the original rule unchanged. The "My meetings" tile for Sacrament
Meeting itself isn't calling-gated at all (unlike the other three) --
its content is already visible with no login or calling, so gating the
tile would add no real access control; it shows for any logged-in
account.

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
- ~~No single unified "planning environment" surface -- scattered
  across several Table Admin grids plus the live per-meeting planning
  view.~~ **Resolved 2026-09-08** (top of the user's priority queue,
  answered "fewer entry points, one screen per meeting" when asked
  which direction to take this): each meeting's own Planning view
  (`/meetings/[id]/planning`) was already functionally unifying Music,
  Speakers, RABNM, Rotations, and Ward Business/Special Format for one
  meeting -- the real problem was that Table Admin's six matching
  sacrament tables (`sacrament_assignments`/`sacrament_music`/
  `sacrament_planning`/`sacrament_rabnm`/`sacrament_speakers_adults/
  youth`) looked like equally-valid everyday entry points sitting right
  alongside it, `createIfMissing` calendar picker and all. `/admin` now
  splits those six into their own "Sacrament Meeting Content" section
  with an explicit note to use the meeting's own Planning view instead
  for everyday work, and each of the six tables' own description says
  the same ("raw-data fallback for troubleshooting or a bulk fix").
  Nothing was removed -- Table Admin still works exactly as before for
  the rare troubleshooting/bulk-fix case; `/meetings/new` +
  `/dashboard` already cover "start planning a future date with no
  meeting yet" without needing Table Admin's calendar-picker trick, so
  there was no real capability gap to fill first.
- ~~No "printable" lifecycle stage or terminology exists today — current
  stages are `template → planning → review → ready → live → archived`.~~
  **Simplified 2026-09-10** (the user's own words: "we can remove the
  review, ready, live statuses for sacrament meeting") -- this turned
  out to be a bugfix as much as a simplification. Investigating it
  surfaced that Review/Ready/Live were **never actually reachable for
  Sacrament Meeting in the first place**: `meetings.stage` is
  deliberately excluded from Table Admin ("edit it through the
  meeting's own pages, not here" -- `lib/admin/registry.ts`'s own
  comment), and no dedicated "mark ready"/"go live" action was ever
  built for Sacrament Meeting -- meaning `getTodaysPublishedSacramentMeeting`
  and `/meetings/[id]/public`'s own `.in("stage", ["ready", "live"])`
  checks could never have matched a real row, so **the public program
  page has likely never actually shown anything in production**. Both
  now gate on `date === today && stage !== "archived"` instead --
  exactly the Vision workflow's own already-stated rule ("public with
  no login, for that one day only... editable at all times until
  archived"), just finally implemented correctly. `LifecycleBadge`
  gained an optional `stages` override so a Sacrament Meeting's own
  header shows a 3-stage track (Template/Planning/Archived) instead of
  the full 6, which had been implying manual controls that never
  existed; every other meeting type is unaffected, still the full
  track (they use a genuinely different workflow -- Bishopric Meeting/
  Ward Council/Youth Council have a real Live tab of their own).
  "Printable" as a named stage is still undecided -- this only removed
  the three that were already dead ends, it doesn't answer where
  "printable" itself belongs in the (now shorter) chain.

  **Public and Conducting views updated to match everything else
  changed 2026-09-09/10** (the user's own follow-up, right after
  noticing this: "we need to see updates to the public and conducting
  views"). Investigating found two more real staleness bugs from the
  agenda redesign, both fixed:
  - `lib/data/conducting.ts` still read `sacrament_planning.ward_business`
    as free text (dead since Ward Business became fully RABNM-driven,
    2026-09-09) and `stake_business` as the business description itself
    (repurposed the same day to hold who's *announcing* it, gated by
    the new `has_stake_business` toggle) -- both fixed to match.
  - **Both `conducting.ts` and `lib/data/public-view.ts` built the
    Speakers & Music/Program section grouped by type** (every youth
    speaker, then every intermediate hymn, then every musical number,
    then every adult speaker), regardless of the order actually saved
    -- correct before `sacrament_program_items` existed (there was no
    other order to follow), silently wrong the moment that list started
    letting these interleave freely. Both now fetch
    `getSacramentProgramItems` and walk that real order instead,
    resolving each entry against the same already-filtered
    speaker/music data (`confirmed = true` for speakers, `status =
    'published'` for music -- unchanged) and skipping any item not yet
    confirmed/published, same as before. `conducting.ts` reuses
    `resolveProgramItems` directly (its data is already shaped
    compatibly); `public-view.ts` has its own raw query shapes, so it
    re-implements the same per-kind resolution inline rather than
    reshaping its queries to fit.
  - Testimony Meeting's conducting script used to hardcode "show one
    testimony line, skip all speakers/music" whenever `special_format
    === 'testimony_meeting'`, independent of any real per-meeting data.
    That hardcoding is gone now that Testimony is just another Speakers
    & Music item -- migration `047` was amended (not yet confirmed run
    at the time, so amended in place rather than adding a `048`) to
    seed a single `testimony` item for that format by default,
    reproducing the old automatic behavior through the new mechanism
    instead of a special case.
  - **Incidental security gap found and fixed while in here**: Conducting
    (`/meetings/[id]/conducting`) had no role check at all -- any
    logged-in account could read any meeting's full conducting script,
    the same gap already found and fixed for Planning/Live on
    2026-09-08. Now Bishopric-only, redirecting a non-admin to the
    actual public page instead.
  - **Conducting redesign, built same day (2026-09-10)**, scoped via a
    formal plan (`/plan`) before starting: "similar to the planning view
    but with suggested wording interspersed as appropriate" (the user's
    own words). Clarifying questions settled: read-only during the
    meeting, but reflects Planning edits without a manual refresh;
    label + resolved value + suggested wording per row (closer to
    Planning's own shape, not just a flat prompt list); wording only
    where something is naturally spoken (hymns, prayers, RABNM,
    Recognize Music, Stake Business, Sacrament Administered, Musical
    Numbers/Intermediate Hymn/Testimony) -- Presiding/Conducting/
    Visiting Authorities/Speaker names show the value only, nothing
    synthesized; wording computed fresh every time, no per-meeting
    override/customization UI.

    The real fix underneath the visual change: **Conducting is now
    template-driven, the same way Planning already is.** The old
    `getConductingScript` was a single hand-written function that
    hardcoded the entire meeting flow as a fixed sequence -- it never
    read the meeting's own `meeting_planned_elements`/`meeting_templates`
    at all, so it silently ignored any per-meeting agenda customization
    and only had one `special_format` special-case
    (`testimony_meeting`, itself already stale after the Speakers &
    Music rework). New `getConductingRows` (`lib/data/conducting.ts`)
    fetches the same `getPlannedElements`/`getTemplateElements` (with
    the same zero-seeded-elements fallback) Planning uses, splits at
    Closing Hymn/Prayer the same way, and calls new
    `buildConductingRows` (`lib/data/conducting-rows.ts`) -- a direct
    read-only counterpart to `buildAgendaRows`, same per-element-key
    dispatch, same four sections (Opening/Administration of the
    Sacrament/Teaching Program/Closing), producing
    `{ value, wording }` per row instead of an editable field. Teaching
    Program reuses `resolveProgramItems` in the meeting's real saved
    order (same fix already applied to `public-view.ts` above); Ward
    Business reuses the exact same `rabnmPrompt` sentences, now moved
    into `conducting-rows.ts` since the old `conducting.ts` no longer
    owns the fixed sequence.

    One deliberate simplification: the old hand-written script had a
    couple of sentences spanning two elements ("...after which the
    prayer will be offered by X"). A generic per-element dispatch can't
    know what the *next* row will be, so every row's wording is now
    self-contained -- a small, called-out trade-off for a system that's
    actually maintainable and won't drift from Planning again.

    **"Updates in real time" is a plain 8-second poll, not Supabase
    Realtime** -- `components/planning/ConductingScriptView.tsx`
    (Client Component) calls a new Server Action,
    `refreshConductingScript` (`app/meetings/[id]/conducting-actions.ts`,
    re-checks the Bishopric gate itself), on an interval and replaces
    its rows. This app has never used Supabase Realtime or a
    client-side Supabase client anywhere before this (`lib/supabase/client.ts`
    existed already but was unimported anywhere) -- wiring up real
    Postgres Changes would mean enabling Realtime on ~8 tables and
    verifying RLS/Realtime interaction live against the real project,
    neither of which could be checked without a deploy-and-test cycle.
    A short poll gets "no manual refresh needed" with far less new
    surface area; swapping it for a real subscription later, if truly
    instant push ever matters, is a contained, separate upgrade.
    `app/meetings/[id]/conducting/page.tsx` is now a thin wrapper --
    the Bishopric-only gate and initial fetch, then
    `ConductingScriptView` for the row list + polling.

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

**Status: this section previously claimed "already matches almost
exactly" -- that was wrong about the actual page, corrected 2026-09-08.**
The *data model and server actions* did already match reasonably well
(see "what carried over" below), but the *page* the user actually used
(`/callings` → click a specific calling → `/callings/[id]`'s nested
`CallingPlanningCard` list) required picking a calling first and only
ever showed that one calling's own history -- nothing like the flat,
every-calling-at-once spreadsheet the user's real workflow is modeled
on (the user shared a screenshot of that literal spreadsheet, 2026-09-08:
"the page I am seeing is not close to my vision"). The two had quietly
diverged over the session without anyone re-checking the built page
against this file's own description of it.

**Rebuilt 2026-09-08 as `/calling-planning`** (migration `043`), a flat
grid -- one row per potential calling change, across every calling at
once, matching the user's spreadsheet directly. Per the user's own
explicit follow-up while this was being scoped ("It probably needs to
be our favorite grid format. I like the format for the teaching
schedule."), it reuses the exact dirty-tracking/Save-All-Changes
pattern already built for Assignment Rotations and Teaching Calendar
(`CallingPlanningGridForm.tsx`) rather than the old vertical-card-per-item
layout:
- **Columns**: Calling (dropdown, now editable per row -- previously
  fixed forever at creation), Date Initiated (**new** `date_initiated`
  column -- the old page had no equivalent at all, silently conflating
  "when the real discussion started" with "whenever this got typed into
  the app"), Candidates, Selected Person, Status, Date Set Apart, Notes,
  Person Being Released, Release Status, Delete.
- **Candidates simplified to free text** (**new** `candidates_text`
  column), replacing the `calling_planning_suggestions` relational
  sub-table's UI (individual add/remove per candidate) -- matches both
  the user's real spreadsheet (one cell, names stacked as plain text,
  not a structured pick-list) and the "favorite grid format" simplicity
  principle Teaching Calendar established. `calling_planning_suggestions`
  itself is left alone, not dropped -- any real historical data stays,
  it's just not written to by the new UI. **Selected Person stays a
  real people FK** (`selected_person_id`, unchanged) since that value
  feeds the Sacrament Meeting announcement integration below, which
  needs an actual person record once a candidate is actually decided on,
  not free text.
- **"Push to Sacrament Meeting" kept as a separate small form per
  row**, in a "Ready to Announce" section below the main grid (adapted
  from the old `pushToSacramentMeeting`, now `pushCallingToSacramentMeeting`
  in `app/calling-planning/actions.ts`) -- it's a genuinely different
  *action* (creates real `sacrament_rabnm` rows, advances status,
  records `announced_meeting_id`) than "assign this cell a value," so it
  doesn't fit the grid's uniform Save-All pattern, and can't be a
  `<form>` nested inside the grid's own wrapping `<form>` anyway (HTML
  forbids nested forms) -- same reasoning `PushRotationForm` already
  established for the Assignment Rotations grid.
- **Row delete is a plain client-side button** (`useTransition` calling
  the server action directly), not a `<form>`, for the same nested-form
  reason.
- **Add a new row directly from this page** via a small "+ Start New
  Calling Change" form at the top (pick the calling, defaults Date
  Initiated to today) -- the old flow required navigating to that
  calling's own detail page first and clicking "Start New Planning
  Process" there; that's gone now, since the whole point is not having
  to pick a calling before you can even begin.
- `/callings/[id]` **stripped down to just the roster entry itself**
  (name, title, current holder) -- the nested planning-history section
  and `CallingPlanningCard` are deleted outright, not left as a second,
  now-redundant place to edit the same data (this app's own established
  principle -- see the unified-sacrament-planning-environment and
  security-gap fixes earlier in this file for the same reasoning
  applied elsewhere). It links to `/calling-planning?calling=<id>`
  instead, which supports that filter for exactly this case.
- The landing page's "Calling Planning" tile now points to
  `/calling-planning` (it pointed at `/callings` -- the roster list --
  before, which is the literal source of the user's "not close to my
  vision" complaint: the tile never actually led anywhere close to a
  calling-planning workflow at all). `/callings` (the roster: add a
  calling, see/set current holders) stays reachable via a small link
  from the new page rather than its own landing tile -- Table Admin's
  existing "Callings" table entry already covers the same raw editing
  if `/callings` itself is ever removed later.
- **Dead code removed along the way**: `CallingPlanningCard.tsx`,
  `app/callings/[id]/actions.ts` (folded into the new
  `app/calling-planning/actions.ts`), `startCallingPlanning`, and
  `getCallingPlanningHistory` (the single-calling-scoped query,
  replaced by `getAllCallingPlanningRows` with an optional filter). Also
  found and removed `lib/data/callings-list.ts` -- a second, entirely
  unimported `getAllCallings()` (a duplicate of the one in
  `lib/data/callings.ts` that's actually used, plus a `planning_status`
  field nothing ever read) -- an abandoned earlier attempt at this same
  function, dead since before this session started.

**What carried over from the original data model/actions, confirmed
still right:**
- `calling_status`/`release_status`/`notes`/`date_set_apart`/
  `release_person_id`: all still exactly `calling_planning`'s shape,
  admin-editable option lists included. (`selected_person_id` itself
  was later dropped -- see the Candidates multi-select note below.)
- "Either/both, by status, same meeting" is still exactly
  `pushCallingToSacramentMeeting`'s logic (checks `calling_status` and
  `release_status` independently, can push both into one
  `sacrament_rabnm` write against the chosen meeting) -- unchanged from
  the original `pushToSacramentMeeting`.
- Re-verified: `lib/data/public-view.ts` still queries `sacrament_rabnm`
  filtered to `type = 'baby_blessing'` only -- calling/release/
  presidency_change rows are still excluded from the public program.
  No conflict, no fix needed here.
- The release-person dropdown is **not** scoped to the calling's
  current holder (it lists every active person, same as the old page
  always did) -- this session's earlier claim that a `scopedBy`
  current/backup-holder + "Previously Vacant" `specialOptions` version
  existed for this in Table Admin was checked directly against
  `lib/admin/registry.ts` while doing this rebuild and turned out to be
  wrong: `calling_planning` has always been deliberately *excluded*
  from Table Admin (its own comment there says so, to avoid a
  duplicate-entry hazard against this bespoke page) -- no such grid
  ever existed. "Previously Vacant" was never a special value on the
  person picker to begin with; it's simply what leaving
  `release_person_id` blank *while* `release_status` is set to its own
  `previously_vacant` option already means, unchanged before and after
  this rebuild. Scoping the picker down to just the current holder
  wasn't added now either, matching the "favorite grid format"
  simplicity principle -- flag if that turns out to matter in practice.

**Bug found and fixed 2026-09-08, immediately after this rebuild
shipped:** every calling-name display in the app (`/calling-planning`'s
two Calling dropdowns and its "Ready to Announce" list, `/callings`'
roster list, `/callings/[id]`'s heading) was rendering
`${calling.title_prefix} ${calling.name}` -- e.g. "Bishop Bishop" or
"President Relief Society President." Per the user: `title_prefix` is
**how to address the calling's holder** ("Bishop [Nielsen]", "President
[Johnson]"), not a prefix on the calling's own name at all -- concatenating
it onto `calling.name` was simply wrong everywhere it was done, not a
data problem to clean up. Fixed by dropping the `title_prefix`
concatenation from all five display sites -- every calling name now
shows as just `calling.name` alone. `title_prefix` itself is untouched
in the schema, Table Admin's Callings grid, and the roster's "Add
Calling" form (still capturable) -- it currently has **no correct
usage anywhere in the app** (nothing combines it with a holder's name
either), so it's real but unused data until/unless a future feature
actually addresses someone by calling-title + name.

**Candidates reworked into a real multi-select, 2026-09-08, right after
the display bug fix above shipped** (migration `044`): the user asked
to drop the free-text Candidates field entirely and instead let
Selected Person become the candidates field, multi-select, so several
people can be under consideration at once. New `candidate_person_ids
uuid[]` column replaces both `candidates_text` (043's free-text field)
and the single-value `selected_person_id` -- one column now covers
"who's being considered," a real people reference (unlike the free-text
version) that can hold zero, one, or many people at once (unlike the
old single-select). `CallingPlanningGridForm.tsx`'s Candidates cell is
now a native `<select multiple>` (size 4, Ctrl/Cmd-click to pick more
than one) with a hidden same-named fallback input before it -- a
multi-select submits *no* form-data entry at all when nothing is
selected, so without the fallback, "remove every candidate" would look
identical to "field not submitted" and the save action would silently
leave the previous value in place instead of clearing it.
`pushCallingToSacramentMeeting` now reads `candidate_person_ids`:
exactly one entry is what "the selected person" means for the
Sacrament Meeting announcement integration -- zero means nothing to
announce yet, and more than one now surfaces its own explicit "Narrow
Candidates down to exactly one person before announcing" message in
both the server action's own error and the "Ready to Announce" list on
the page (rather than silently guessing which candidate was meant).

**Candidates picker replaced with a chip-style multi-select, and
sort/filter added, same day (2026-09-08), per two more user follow-ups
right after the above shipped.** A native `<select multiple>` requires
holding Ctrl/Cmd to pick more than one option and always shows the
entire list, not just what's chosen -- the user asked for something
closer to a spreadsheet's data-validation dropdown instead: "only
showing what is selected... easy multi-select without a cntrl click."
New `components/calling-planning/MultiPersonSelect.tsx`: selected
people render as removable chips (&times; to remove), plus one plain
single-choice `<select>` below them to add another (already excludes
whoever's picked, so nothing can be added twice) -- no modifier key,
and the closed dropdown never shows anyone already chosen. It's
uncontrolled by the parent grid (its own `useState` seeded from
`value`, same pattern as every other field in this grid) and renders
its own hidden `<input>`s under the shared field name so
`saveCallingPlanningGrid`'s existing `formData.getAll(name)` handling
picks it up exactly like the native multi-select did -- no server
action changes needed for this part. Since adding/removing a chip
doesn't fire a native DOM change event the form's own `onChange`
bubbling would catch, it takes an explicit `onDirty` callback instead,
called directly on every add/remove.

The user then also asked, in the same breath, for **filter and sort on
the grid's columns** -- added to `CallingPlanningGridForm.tsx` itself:
a sortable `<th>` per column (click to sort ascending/descending, third
click clears -- identical convention to `AdminTableEditor.tsx`'s
sortable headers) plus a small filter text box under each heading,
purely client-side over the already-fetched `rows` prop, matching that
same file's own scoping precedent. One thing genuinely different from
`AdminTableEditor`'s version: a **filtered-out row stays mounted in the
DOM** (`hidden` attribute on its `<tr>`, not removed from the array
being rendered) rather than actually being excluded -- this grid is one
big `<form>` covering every row's every field via uncontrolled inputs,
so removing a row from the render tree would drop its current
(possibly just-edited, not-yet-saved) values from the next Save All
Changes submission the moment a filter happens to hide it. Sort and
filter both compare against each column's last-saved/committed value
(via a shared `cellText(row, column)` lookup -- calling/status/release
names resolved from their id, not shown raw), not whatever's currently
sitting in an open, unsaved input.

**Bug found and fixed 2026-09-08: the Calling dropdown was missing
vacant callings.** The user's report: "the list of potential callings
seems to pull only from callings that are already filled." `getCallingOptions()`
(`lib/data/calling-planning.ts`) filtered `.eq("active", true")` --
harmless in principle (`active` means "still a recognized calling in
this ward," unrelated to whether it currently has a holder, per how
`computeEligiblePersonIds` in `lib/data/rotations.ts` uses the same
column), but planning a *change* is precisely the workflow that most
needs to reach a calling with no current holder, and apparently enough
of this ward's genuinely-vacant callings are also marked inactive in
practice that the filter was hiding them. Removed the filter entirely
-- the dropdown now lists every row in `callings`, filled or vacant,
active or not. **If a calling still doesn't show up after this fix, it
means that calling has no row in the `callings` table at all yet** --
the Vision & Intended Workflows section's "selects the calling to
change (**or creates a new one**)" isn't built as an inline option on
this dropdown; a genuinely new calling still has to be added via
`/callings` (the roster page, linked from this page) first. Ask before
building an inline "add a calling" control here if that turns out to
still be needed.

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
- ~~Action items can only be assigned to a person today, not an
  organization.~~ **Decided 2026-09-08: not a gap.** The user's own
  words: "let's eliminate this from the list. items should be assigned
  to individuals." `meeting_action_items.assigned_to_id` staying a
  single FK to `people` is the intended design, not a limitation to
  fix.
- ~~No distinct "view an archived meeting" experience exists.~~ --
  **built 2026-09-06**: `app/meetings/[id]/archived` renders the
  finalized agenda read-only (element order exactly as it was when
  archived, via the same `getPlannedElements`/`getTemplateElements`
  fallback Planning uses), with note-style content (free-text/
  person-and-text values, RABNM detail, action item descriptions,
  bishopric minutes free-text fields, council notes, agenda item
  bodies) rendered in a highlighted box distinct from plain resolved
  content (assigned names, hymns, speakers) — the font-color
  distinction this workflow asked for. Planning/Live/Template all
  redirect here once `stage === 'archived'` (editing after archiving
  would contradict "the agenda as it was finalized"); Conducting/Public
  were left alone (already naturally moot/date-gated post-archive).
  ~~Admin-only for now~~ -- **extended to non-admins 2026-09-08** once
  the calling-based viewer (item 5 in the non-Sacrament workflow above)
  was built on top of it, exactly as planned when this was scoped.

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

**Moved behind login and calling-gated, 2026-09-09**, per the user's
own follow-up: "move the meeting agenda items submittal tile into the
my meeting section and make it available only to those who attend
meetings." The original design above (anyone, no login, straight from
a public Tier-0 tile) matched the real Google Form it was built from,
but the user's actual intent for *this* app is narrower than the form
was — an agenda item is for a meeting the submitter actually attends
by calling, not a fully open public submission the way an announcement
is. Split the old combined `/submit` page in two rather than gating the
whole thing:
- ~~`/submit` stays exactly as open as before~~ — true only for the
  rest of this same day; see the follow-up note right after this list,
  which gates announcement submission too. `/submit` itself is now just
  a redirect to `/submit/announcement`. At this point in the day it was
  announcement submission only, still no login, still publishing
  immediately, with its Tier-0 tile relabeled "Submit an Announcement"
  (was "Meeting Agenda Items," which had drifted to cover both forms
  under one misleading name).
- **New `/submit/agenda-item`**, requires login and reuses
  `getVisibleMeetingTypesForUser` (the same calling → `meeting_type_members`
  resolution the "My meetings" tiles already use) to decide which
  meeting types show in its "Desired Meeting" dropdown — Bishopric
  gets all three non-Sacrament types regardless of calling, same as
  everywhere else that role manages everything; everyone else only
  sees a type their own calling actually maps to. Its landing-page tile
  moved out of Tier 0 into the "My meetings" section itself, shown only
  when the signed-in account has at least one such type (or is
  Bishopric) — a new `attendsMeetings` check on the landing page,
  distinct from that section's own `visibleMeetingTypes` (which always
  folds in Sacrament Meeting for any logged-in account regardless of
  calling, so it alone couldn't tell "attends a meeting" from "just
  logged in").
- **`submitAgendaItem` re-checks meeting-type access server-side**, not
  just via the page's filtered `<select>` — this is a real access
  boundary now (unlike before, when literally anyone could submit for
  any type), so a POST naming a type the account has no calling-based
  access to is rejected the same way, not just hidden from the UI.
- The email/name fields disappeared from this form entirely — the
  submitter is a known signed-in account now, so `submitAgendaItem`
  attributes the item from the session (`profile.display_name`/
  `profile.email`) instead of self-reported text, matching how other
  login-gated actions in this app identify who did what.
- `components/submit/SubmitForm.tsx` (the old combined component) was
  split into `AnnouncementForm.tsx` and `AgendaItemForm.tsx` and
  deleted outright, not left alongside the new ones.

**Announcement submission gated the same way, same day (2026-09-09)**,
per the user's immediate follow-up once Agenda Item shipped above: "the
same for submitting announcements by moving it to the same location
with the same gatekeeping." This reverses the "anyone can submit, no
login" design from 2026-09-05 (see the workflow note right below this
one, which described that as deliberate at the time) — a real policy
change the user made twice in one sitting, not a bug fix:
- **New `/submit/announcement`**, requires login, gated on the same
  account-level `attendsMeetings` check the landing page now uses
  (Bishopric, or `getVisibleMeetingTypesForUser` returns at least one
  type) — unlike Agenda Item, there's no per-meeting-type question for
  an announcement, so this is a single yes/no page gate rather than a
  filtered dropdown. `submitAnnouncement` re-checks the same condition
  server-side too, same defense-in-depth reasoning as
  `submitAgendaItem`'s meeting-type re-check.
- `/submit` (the old bare route) is now just a `redirect()` to
  `/submit/announcement` — kept only so an old bookmark or link lands
  somewhere real instead of 404ing; the destination page's own
  login/attendance gate takes over from there.
- Its landing-page tile moved out of Tier 0 into "My meetings", right
  alongside Meeting Agenda Items, both gated on the same
  `attendsMeetings` flag.
- The "Your email" field disappeared from `AnnouncementForm.tsx` for
  the same reason it was never on `AgendaItemForm.tsx`: the submitter
  is a known signed-in account now, so `submitAnnouncement` attributes
  the submission from the session (`profile.display_name`/
  `profile.email`) instead of typed-in text.

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

**Current priority queue (set by the user 2026-09-08), work top to
bottom:** ~~unified sacrament-meeting planning environment~~ (done) ->
~~calling-based non-admin viewer~~ (done) -> ~~non-admin post-archive
visibility~~ (done, came along with the viewer) -> ~~sortable Table
Admin headers~~ (done, see Known open items above for detail) -> ~~drop
`confirmed` from rotation-assignment tables~~ (done, see Known open
items above -- also surfaced a new, not-yet-scoped "print portal" idea,
see that same entry) -> ~~Music tile merge~~ (done, see Known open
items above for detail) -> ~~sign-out bug~~ (not actually a bug, see
Known open items above for detail) -> ~~Teaching Calendar scope~~
(done, see Known open items above for detail). The user's own priority
queue from 2026-09-08 is now fully worked through. Immediately after,
the user flagged that Calling Planning (`/calling-planning`, formerly
reached via a misrouted `/callings` tile) "was not close to my vision"
and it was rebuilt into the flat grid format -- see the Calling planning
workflow section above for the full writeup. While scoping that
rebuild the user also said (2026-09-08): "It probably needs to be our
favorite grid format... It can also be extended to the youth activity
calendar and calling planning formats" -- calling planning is now done;
**applying this same grid format to Youth Activities is a real,
explicitly-named idea from the user, not yet built or scoped in detail**
-- `/youth-activities` currently uses a different, older list-based
layout (see the "Adult leaders planning youth activities" workflow
above), and converting it to the Assignment-Rotations/Teaching-Calendar/
Calling-Planning grid pattern would need its own scoping pass (what
counts as a "row" -- one per activity? one per Wednesday regardless of
whether an activity exists yet, like Teaching Calendar's Sundays? --
and how the existing Generate/cadence-rule/confirm/cancel controls fit
around a grid) before starting. **Placeholder tile added 2026-09-09**
per the user's request: a "Youth Activity Planning" tile now sits in
the landing page's "Youth program" section (alongside Teaching
Calendar, same `isYouthLeader` guard), rendered `comingSoon` -- no
route or page behind it yet. Purely a landing-page marker that this is
next up; doesn't itself start or scope the grid-format rebuild above.
Bishopric-side
duplicate free-text entry points, real-time notes sync, and the
"printable" lifecycle stage are deliberately NOT in this queue -- the
user grouped those three together as related to a larger, not-yet-detailed
architecture change to how meetings are displayed generally ("less like
a form and more like a condensed, easier to view format") -- don't
start any of the three without that larger discussion happening first.
~~**"This page couldn't load. A server error occurred."**~~ **Likely
root-caused and fixed 2026-09-08**, after the identical symptom showed
up again on the brand-new `/teaching-calendar` (which shares no backend
code with `/rotations` at all -- the common thread had to be
structural, not data-specific). Both pages' grid client components
(`AssignmentGridForm.tsx`, `TeachingGridForm.tsx`) received a plain
`formatDate` JavaScript function as a prop from their Server Component
page -- Next.js's Server Components model only allows a *Server Action*
to cross the server/client boundary as a function; a plain function
prop throws at render time. Fixed by defining `formatDate` locally
inside each client component instead of passing it in. This was never
reproduced live and no Vercel log was ever obtained, so treat this as
the most likely explanation rather than a confirmed one -- but it fits
every known fact (intermittent-looking because it depends on exactly
which code path Next's flight serializer hits, present on both the
original `/rotations` report and this session's new
`/teaching-calendar` report, and consistent with a careful static
review of the data-fetching code finding nothing wrong on either page).
Confirm with the user that both pages load cleanly after this ships
before fully closing it out.

- ~~**Conference Schedule page.**~~ **Built, then generalized, 2026-09-06.**
  First built as a narrow General/Stake Conference-only feature, then
  the user asked to broaden it immediately after: "instead of calling
  it a conference schedule table it can be called a meeting
  cancellation table. Because there are other specific holidays and
  events where sacrament meeting is held but other meetings on that day
  should be cancelled. So it could be a date, a reason, and a list of
  meeting cancellations for the date." Shipped as that generalized
  version, not the narrower one -- `/meeting-cancellations`
  (Bishopric-only), a new `meeting_cancellations` table (migration
  `039`: `start_date`, `end_date`, `reason` free text, `meeting_type_slugs`
  a real Postgres `text[]` -- fine here since this is a bespoke page,
  not the generic Table Admin engine which has no array column type --
  and `cancel_youth_activities` boolean). Nothing about General/Stake
  Conference is hardcoded in application code at all now -- an admin
  enters both as two examples with whatever date range, reason, and
  affected-types/youth-activities they choose, the same as any other
  holiday or event. For General Conference specifically that means
  entering the start date as the Monday of its own church-calendar week
  and the end date as its closing Sunday (the user's own words on that
  date math: "the church week ends on Sundays... conferences are
  Saturdays and Sundays... the week leading up to the conference would
  be Monday thru the Sunday of the conference") and checking all four
  meeting types plus "cancel youth activities"; for Stake Conference,
  just its own two dates and the meeting types, with youth activities
  left unchecked (confirmed directly by the user: Stake Conference
  never touches youth activities).
  `lib/data/meeting-cancellations.ts`'s `sweepMeetingCancellations()` --
  a lazy sweep matching `autoArchivePastMeetings`'s own pattern, run
  from both `getUpcomingMeetings()` and `getYouthActivities()` so a
  meeting/activity added *after* a cancellation was entered still gets
  caught -- reuses the existing `meetings.cancelled`/`cancellation_note`
  (migration `037`) and `youth_activities.cancelled`/`cancellation_note`
  (migration `032`) columns rather than a new cancellation concept, and
  only ever sets `cancelled = true` on a row that isn't already
  cancelled (`.eq("cancelled", false)`), so it can never clobber an
  existing manual cancellation's note, and never auto-reverses anything
  even if a cancellation's dates are later corrected or deleted (an
  admin can always manually un-cancel via the existing per-row
  controls).
- ~~**Split "My meetings" into per-meeting-type tiles.**~~ **Built
  2026-09-06**, including the one open question from when this was
  first recorded: the user answered "only show the meetings that apply
  to the person by nature of their calling." New
  `lib/data/meeting-type-access.ts`'s `getVisibleMeetingTypesForUser`
  resolves auth user -> `people` row (via `people.profile_id`) ->
  callings currently held -> `meeting_type_members` (the same
  calling-to-meeting-type mapping `lib/data/rotations.ts` already uses
  for rotation eligibility) -> meeting types -- the landing page's "My
  meetings" section now renders one tile per resolved type instead of
  one generic "Meetings" tile, each linking to `/dashboard?type=<slug>`
  (a new filter `/dashboard` now supports, with a "Show all types" link
  back). Bishopric sees all four types regardless of their own calling,
  since admins manage everything. **Important scope note:** this only
  controls which *tile* shows up -- it is NOT the calling-based
  non-admin *viewing* mechanism itself (still not built, see the
  non-Sacrament workflow above). A non-admin whose calling resolves a
  tile still lands on the admin-oriented `/dashboard` list filtered to
  that type, which has real limits for them (e.g. `MeetingRow` still
  gates on `isBuilt`/`canManage`) until that viewer exists.
  **Real open question to settle before building, not to assume:** which
  roles should see which type tiles? "My meetings" today is gated only
  to `{user}` (any logged-in account, no role check) -- but no
  calling-based visibility into *which* meeting types a given non-admin
  account should even see exists yet (`meeting_type_members` is
  currently only read internally for rotation eligibility, never for
  page-level access -- see the not-yet-built calling-based non-admin
  viewer elsewhere in this file). Showing all four type tiles to every
  logged-in user regardless of role is the simplest option, but may not
  be what's wanted long-term once that viewer exists.

  **"My meetings" made genuinely read-only, and admin control split
  into its own tile, 2026-09-09** (the user's own request: "make my
  meetings section for read only views of meetings... make a meeting
  planning tile in the administration section. It will be the control
  of meeting planning"). Before this, a Bishopric account clicking a
  "My meetings" tile landed on `/dashboard`'s full control surface
  (+ New Meeting, per-row Cancel/Un-cancel, the Unassigned Agenda Items
  panel) -- fine functionally, but not what "My meetings" is supposed
  to be for non-admins, and inconsistent for admins browsing their own
  meetings versus actually administering them. `/dashboard` gained a
  `?readonly=1` search param: when present, `canCreate` is forced false
  regardless of role, which -- since `canCreate` was already the single
  flag gating all three of those admin surfaces *and* `MeetingRow`'s
  `canManage` prop (which decides both the per-row Cancel controls and
  whether clicking a meeting goes to the manage hub or the existing
  read-only view, `/meetings/[id]/public` or `/archived`) -- turned out
  to need no other changes to get a real read-only mode. The "Show all
  types" link preserves the flag so filtering by type doesn't
  accidentally drop out of read-only mode. Every "My meetings" tile now
  links with `&readonly=1`; ~~a new "Meeting Planning" tile in the
  Administration section links to plain `/dashboard` (no flags) for the
  full control surface~~ -- true only until the very next request, see
  immediately below. Non-admins were already effectively read-only here
  (`canCreate` was already false for them), so this only changes
  behavior for Bishopric.

  **"Meeting Planning" turned into its own hub page, same day
  (2026-09-09)**, per the user's immediate follow-up: "make meeting
  schedule, meeting cancellations, assignment rotations subtiles after
  clicking on meeting planning, plus a meeting agendas tile that
  handles the previous meeting planning content." New
  `/meeting-planning` (Bishopric-only, plain `Tile`/`TileGrid` --
  matching the landing page's own visual language rather than
  `/admin`'s list-row style, since the user's own word was "subtiles")
  with tiles: **Meeting Agendas** (→ `/dashboard`, the
  create/cancel/manage list that "Meeting Planning" used to open
  directly), **Meeting Schedule**, **Meeting Cancellations**, and
  **Assignment Rotations** -- the latter three demoted out of the
  landing page's own Administration section, which previously listed
  them as top-level tiles alongside "Meeting Planning" itself.
  Administration's "Meeting Planning" tile now points to
  `/meeting-planning` instead of `/dashboard` directly. **Speaker &
  Prayer History joined the same group minutes later**, same day, per
  the user's immediate follow-up ("move speaker and prayer history
  into the meeting planning tile as well") -- demoted out of
  Administration the same way, for the same reason. None of the five
  destination pages themselves changed -- this is purely a
  landing-page/navigation reorganization, one more layer of grouping
  under the tile that already existed for meeting-related admin tools.

  **Dashboard's browser tab title fixed, same day.** The on-page `<h1>`
  fix earlier that day ("I changed the dashboard page so that only the
  header says ward os. I wanted it to say dashboard") only ever
  addressed the visible page heading -- the actual browser tab title is
  a separate piece of chrome, set once for the whole app by
  `app/layout.tsx`'s `metadata.title` ("Ward Meeting OS"), with no
  `title.template`, so it had in fact always read the same generic
  string on every route regardless of that h1 fix. Per the user's
  follow-up ("the dashboard page title changed back to ward os"),
  `app/dashboard/page.tsx` gained its own `metadata = { title:
  "Dashboard" }`, overriding the tab title for just this route rather
  than introducing a site-wide `title.template` that would change every
  other page's tab title too.

  **Both page titles renamed again, and stale past meetings hidden by
  default, later the same day** -- the user's follow-up: "I still have
  out of date meetings showing up in the dashboard. And I was confused
  about which page was the dashboard page. Lets change the landing page
  title to dashboard, and then the dashboard page title to meeting
  dashboard." Landing page (`app/page.tsx`) gained its own
  `metadata.title = "Dashboard"` (its on-page `<h1>` stays `{WARD_NAME}`
  unchanged -- a different, still-useful piece of branding, not what
  was being asked about); `/dashboard`'s tab title and on-page `<h1>`
  both became "Meeting Dashboard" -- the two now read distinctly on
  purpose, addressing the "which page was actually the dashboard page"
  confusion directly rather than just being two same-named things at
  different URLs.

  The stale-meetings report was a real, separate bug:
  `getUpcomingMeetings()` (`lib/data/meetings.ts`) has never actually
  filtered by date despite its name -- it returns literally every
  meeting ever, oldest first, and the existing auto-archive sweep only
  changes a past meeting's *stage*, it never stopped that meeting from
  still being listed on `/dashboard`. First pass hid `stage ===
  "archived"` meetings from the list by default, with a new "Show past
  meetings" / "Hide past meetings" toggle (`?past=1`, alongside the
  existing `type`/`readonly` params, all three preserved across each
  other via a new local `dashboardHref` helper).

  **Corrected minutes later, same day** -- the user's immediate
  follow-up: "today is 9/9/2026 and I am still seeing meetings to plan
  for back in august." Filtering by `stage` alone was too narrow: a
  past meeting that never got any real activity recorded stays
  un-archived forever by design (the "No Activity" case -- see
  `autoArchivePastMeetings`), so every old, never-touched meeting was
  still sitting in the default view no matter how old. The filter is
  now purely date-based -- hidden by default is simply "date is before
  today," archived or not -- which is what actually matches "out of
  date." `?past=1` still brings every past meeting back (date, stage,
  and "No Activity" badge all intact) for anyone who needs to find one,
  e.g. to review an archived meeting's minutes per the Vision workflow.

  **"Meeting Agendas" split into its own per-type hub, same day**, per
  the user's follow-up: "add tile for each meeting type under meeting
  agendas and separate the lists to those tiles." New `/meeting-agendas`
  (Bishopric-only, same `Tile`/`TileGrid` pattern as `/meeting-planning`
  and the landing page's "My meetings") with one tile per meeting type,
  each landing directly on that type's own `/dashboard?type=<slug>`
  list -- mirrors the one-tile-per-type pattern "My meetings" already
  uses for read-only browsing, now applied to the admin side too.
  `/meeting-planning`'s own "Meeting Agendas" tile now points here
  instead of straight to `/dashboard`. ~~`/dashboard` itself is
  unchanged~~ -- true only until the next request, see immediately
  below.

  **`/dashboard` reworked into a single-line-per-meeting grid, with a
  type-specific page title, shortly after (2026-09-09)** -- the user's
  own words, reacting to a screenshot of the old stacked-card layout:
  "each meeting-specific page... can be titled by the meeting type
  followed by 'planning dashboard'... the words 'sacrament meeting'
  appear too often... look more like the grids we have been using...
  single line items per scheduled event." Two changes:
  - **Title**: `/dashboard`'s browser tab and `<h1>` now read
    "`<Type>` Planning Dashboard" (e.g. "Sacrament Meeting Planning
    Dashboard") whenever `?type=` is set, or the generic "Meeting
    Dashboard" when it isn't (the merged "Show all types" view) -- a
    shared `dashboardPageTitle()` helper feeds both the `<h1>` and a
    new `generateMetadata` (a static `metadata` export can't read
    `searchParams`, so this replaced it) so the two can't drift apart.
  - **Layout**: `MeetingRow` went from a stacked card (title shown
    twice -- a small label plus a big heading -- with cancel controls
    in a separate block below it) to one `<table>` `<tr>` per meeting,
    matching the mono-uppercase-header/tight-border look of the other
    per-item grids in this app (Assignment Rotations, Calling Planning,
    Teaching Calendar) even though this list isn't a Save-All-Changes
    editable grid -- it's borrowing the *look*, not the
    dirty-tracking/single-form mechanics, since each row's Cancel/
    Un-cancel is already its own independent little form (no nesting
    issue, since the list was never wrapped in one big outer form to
    begin with). Columns: Date (links to the meeting when built),
    Type (hidden entirely when `?type=` narrows the list to one type
    already -- the actual fix for "sacrament meeting" appearing on
    every single row on top of the header and title), Stage (lifecycle
    badge plus Cancelled/No Activity/Coming-soon flags inline), and an
    actions cell with the same inline Cancel/Un-cancel form as before,
    just condensed to fit one row. The section header's own type-name
    label is dropped too when filtered (redundant with the new `<h1>`)
    -- that slot becomes the "Show all types" link instead of a second
    copy of the name.

  **Refined again minutes later, same day** -- the user's own
  follow-up: "make a button out of the date field... the status fields
  can be eliminated except for the status that is current... turn the
  'cancel' option into a button and have the reason field appear after
  the cancel button is pressed and at the end of the meeting line
  instead of in front of the cancel button." Applied to every meeting
  type's rows, not just Sacrament -- they all share the same
  `MeetingRow`, and nothing about the request was Sacrament-specific.
  - **Date is now a real button** (`bg-ink` pill, same visual weight as
    "+ New Meeting"), not just a hover-underline text link -- makes it
    obvious that clicking the date is how you open the meeting, per the
    user's own words.
  - **`LifecycleBadge` gained a `compact` prop**: renders just the
    current stage's own pill, no Template-through-Archived track --
    used only here, so the row has the width back for the bigger date
    button. The full track stays the default everywhere else (a
    meeting's own header) unaffected, since a re-derived one-off badge
    would have violated the component's own "views instead of duplicate
    data" reuse principle.
  - **New `components/dashboard/CancelMeetingButton.tsx`**: Cancel is a
    real bordered button now (matching Un-cancel, restyled to match);
    clicking it reveals the reason input *after* the button (not before
    it, which is where it sat previously) -- needs client state to
    toggle that reveal, which a plain server-action `<form>` can't do
    on its own, so this is its own small client component rather than
    inline JSX. Takes the row's inline "use server" `cancel` closure as
    a prop -- an inline server action is allowed across the
    server/client boundary as a function, unlike a plain one (see the
    formatDate-prop bug elsewhere in this file).

  **Sacrament Meeting removed from "My meetings" entirely, 2026-09-10**
  (the user's own words: "remove sacrament meeting from 'my
  meetings'"). `ALL_MEETING_TYPES` (`app/page.tsx`) no longer includes
  it, and the non-admin branch stopped unconditionally folding
  `"sacrament-meeting"` into `visibleMeetingTypes` -- that list is now
  just `rawVisibleTypes` (the real calling-based result) for a
  non-admin, and the three collaborative types for Bishopric. Its own
  "This week" tile (public program, no login/calling needed) already
  covered what a non-admin would want; admins reach it through
  Administration → Meeting Planning → Meeting Agendas instead -- this
  tile was a third, redundant entry point. `attendsMeetings` (gating
  the Meeting Agenda Items/Submit an Announcement tiles) is unaffected
  in behavior -- it already used the un-folded `rawVisibleTypes`, not
  `visibleMeetingTypes` -- but the two lists are now identical for a
  non-admin instead of one being a superset of the other.
- ~~Back links.~~ **Fixed 2026-09-06** (user's own request: "ensure all
  pages have a back link"). Audited all 28 `page.tsx` routes. Most
  already had one implicitly via `AppHeader`'s "Ward OS" wordmark
  (→ `/`) -- kept that as the app's baseline "back" for top-level
  feature pages reachable straight from the landing page. Added an
  explicit breadcrumb-style `&larr; <Parent>` link (matching
  `/admin/[table]`'s pre-existing `&larr; All tables` pattern) to the
  pages nested a level deeper that were missing one:
  `app/meetings/[id]/layout.tsx` (`&larr; Meetings`, shared by every
  meeting sub-page including the new Archived view), `app/meetings/new`
  (`&larr; Meetings`), and `app/callings/[id]` (`&larr; Callings`). The
  three pre-auth pages (`/login`, `/auth/reset-password`,
  `/auth/update-password`) had no `AppHeader` (a client component can't
  use it -- it's an async server component checking session state) and
  so no way back at all -- each now gets its own `&larr; Home` /
  `&larr; Sign in` link.
  - **Bug found and fixed along the way:** `/auth/reset-password` was a
    byte-for-byte duplicate of `/auth/update-password` -- both called
    `updatePassword` (which needs an active Supabase session to
    succeed). `requestPasswordReset` (send-a-reset-email) existed in
    `app/auth/actions.ts` but was never wired to any page. A first-time
    user or anyone who'd actually forgotten their password, following
    login's "Forgot your password, or signing in for the first time?"
    link, would land on a form trying to set a password with no session
    to update instead of ever receiving a reset email. `/auth/reset-password`
    is now the real "send me a reset link" step; `/auth/update-password`
    (reached from that emailed link) is unchanged, still the "type your
    new password" step.
  - **Extended to the three new hub pages, 2026-09-09** (the user's own
    request, after building `/meeting-planning`, `/meeting-agendas`, and
    the reworked `/youth-teaching-planning`): the "AppHeader wordmark is
    enough for a top-level page" baseline turned out not to read as an
    actual back affordance in practice, at least for hub pages the user
    navigates into and back out of repeatedly. `/meeting-planning` and
    the `/youth-teaching-planning` hub view (both reachable straight
    from the landing page) gained an explicit `&larr; Home` link;
    `/meeting-agendas` (nested one level under `/meeting-planning`)
    gained `&larr; Meeting Planning`. `/youth-teaching-planning`'s
    single-class view already had its own `&larr; Youth Teaching
    Planning` link back to that hub, added when it was first built.
  - **Re-audited 2026-09-10** (the user's own request: "I still need
    back arrow links on several pages... an assessment of all pages
    that are a drill-down from the main page"), specifically to catch
    drift from this session's own restructuring -- moving Meeting
    Schedule/Meeting Cancellations/Assignment Rotations/Speaker & Prayer
    History from their own top-level Administration tiles into
    `/meeting-planning`'s subtiles demoted each from "one click from
    Home" to "two clicks, behind a hub," but nobody had added a
    breadcrumb back to that hub when it happened -- they still only had
    the wordmark, which now skipped past the hub entirely. Same gap
    found for `/callings`, once Calling Planning's rebuild made it
    reachable only via a link from `/calling-planning` rather than its
    own landing-page tile. Fixed by adding one `&larr; <Parent>` link
    each, exact same pattern as everywhere else in this section:
    `/meeting-schedule`, `/meeting-cancellations`, `/rotations`, and
    `/speaker-prayer-history` all gained `&larr; Meeting Planning`;
    `/callings` gained `&larr; Calling Planning`. `/dashboard` needed a
    **conditional** link instead of a fixed one, since it's genuinely
    reached two different ways at two different depths -- the landing
    page's "My meetings" tiles (`?readonly=1`, one click from Home,
    left alone) and Meeting Agendas' per-type tiles (no `readonly` flag,
    three clicks deep) -- the existing `isReadOnly` check already
    distinguishes the two contexts exactly, so `&larr; Meeting Agendas`
    now shows only when `!isReadOnly`. Everything else nested under
    `/meetings/[id]/*` was already covered by the shared layout's
    `&larr; Meetings` link (including the newer Ward Business page,
    which additionally has its own `&larr; Planning` on top of that);
    every other page checked either already had one from an earlier
    pass or is a genuine one-click-from-Home tile where the wordmark
    baseline still applies, matching this section's own original rule.
- ~~Teaching Calendar (youth leader tile) — scope not yet defined,
  deferred~~ **Built 2026-09-08** (migration `042`, still needs to be
  run), per the user's own scoping: a Sunday teaching schedule, one row
  per (Sunday, class), each cell a short free-text entry -- deliberately
  **not** tied to any person or calling record (no `people` FK at all,
  unlike literally everything else assignment-shaped in this app). New
  `teaching_assignments` table (sparse -- a blank cell just means no row
  exists yet, same pattern as `meeting_element_notes`), `/teaching-calendar`
  (a grid: every upcoming Sunday down one side, the 6 real YM/YW classes
  across the top, one "Save All Changes" button -- reusing the exact
  grid/dirty-tracking/save-feedback pattern built for the Assignment
  Rotations grid, `components/rotations/AssignmentGridForm.tsx`, just
  with plain `<input type="text">` cells instead of person-picker
  `<select>`s). Classes are derived from `YOUTH_ACTIVITY_GROUPS` minus
  the "Combined ..." pseudo-values (those describe attendee scope for a
  combined activity, not an actual class with its own Sunday lesson) --
  one place to update if the classes are ever renamed again. Access
  (both viewing and editing, no split) is youth leaders + Bishopric only
  per the user's own words ("youth leaders and admins... access") -- no
  public view at all, unlike Youth Activities. The landing-page tile
  sits in the existing "Youth program" section alongside where Youth
  Activities' own tile lives in spirit (Youth Activities' actual tile is
  in the public "This week" tier, since it's publicly viewable and this
  isn't) -- that section's visibility guard dropped its old
  `&& !isBishopric` exclusion once there was a real destination admins
  should reach too. No Table Admin registry entry, matching the
  `meeting_cancellations` precedent: a bespoke page already covers the
  only editing this needs.

  **Renamed to "Youth Teaching Planning" and reworked into a per-class
  hub with real per-person access control, 2026-09-09**, per the user's
  own request: "change the name of the teaching calendar to youth
  teaching planning. then add a tile for each youth group under the
  youth teaching planning hub. then authenticate the specific people
  assigned to the youth group to see only their group unless it is the
  bishopric or young women presidency. Bishopric can see all groups.
  young women presidency can see all young women groups." Two separate
  changes bundled together:
  - **Navigation**: `/youth-teaching-planning` (renamed from
    `/teaching-calendar`, which now just `redirect()`s here) is a hub
    -- one tile per class the viewer has access to (see below), each
    landing on `?class=<name>`'s own single-column grid instead of the
    old page's one shared grid with every class as a column at once.
    Same one-tile-per-type pattern already used by the landing page's
    "My meetings" and `/meeting-agendas`. `getTeachingAssignmentGrid`
    (`lib/data/teaching-assignments.ts`) gained an optional `classes`
    param (defaults to every class) to scope both the query and the
    returned grid to just the one requested column.
  - **Real access control** (migration `045`, new `youth_class_teachers`
    table -- `person_id` FK + `class_name` text, added to Table Admin
    as "Youth Class Teachers" since it's a plain two-column mapping the
    generic engine already handles): before this, viewing/editing the
    whole calendar was all-or-nothing by role (any of the 5 youth-leader
    roles, or Bishopric) -- now Bishopric still sees every class and
    Young Women Presidency still sees every YW class (both stay
    role-based, per the user's own words), but the other 4 roles
    (yw_advisor/yw_specialist/ym_advisor/ym_specialist) are narrowed
    down to exactly the class(es) a `youth_class_teachers` row assigns
    them to -- new `getAccessibleClasses`/`getTaughtClassesForUser`
    (mirroring `getVisibleMeetingTypesForUser`'s exact
    auth-user-\>people-row-\>mapping-table shape). An account in one of
    those 4 roles with no assignment row yet sees an empty hub ("You
    haven't been assigned to teach a class yet") rather than the old
    blanket access. The page itself re-verifies a requested `?class=`
    against the resolved list before rendering anything from it (not
    just hiding its tile), and `saveTeachingGrid`
    (`app/youth-teaching-planning/actions.ts`) re-checks the same list
    server-side per field before writing -- this had **no server-side
    authorization at all** before (page-level role gate only), which
    was fine when viewing and editing were the same all-or-nothing
    permission, but became a real gap once specific classes needed to
    be off-limits to specific accounts.
  - `components/teaching-calendar/TeachingGridForm.tsx` moved to
    `components/youth-teaching-planning/TeachingGridForm.tsx` (same
    component, now typically rendered with a single-item `classes`
    array); `app/teaching-calendar/actions.ts` moved to
    `app/youth-teaching-planning/actions.ts`.
- Bishopric-side free-text elements (spiritual thought, handbook training,
  young men coordination, impressions, calling planning, sacrament meeting
  review) can currently be entered in TWO places — new dynamic per-element
  fields AND the old `BishopricMinutesForm`'s similarly-named fixed columns.
  Not consolidated yet; ask before changing either.
- ~~Agenda items for Bishopric/Ward Council/Youth Council should
  eventually get a share-token-based no-login view for invited
  attendees.~~ Superseded by the Vision & Intended Workflows section's
  login + calling-based model, which **built 2026-09-08** -- see the
  non-Sacrament workflow above.
- ~~Dashboard shows every meeting, past and future, oldest first — no
  auto-archive or cancel control.~~ **Both built 2026-09-06:**
  - **Auto-archive past meetings.** `getUpcomingMeetings()`
    (`lib/data/meetings.ts`) now runs `autoArchivePastMeetings()` on
    every call: any meeting whose date is in the past and isn't already
    `archived` gets archived if it had real activity, or is left alone
    and flagged `noActivity` (computed, not persisted) for the
    dashboard's "No Activity" badge otherwise. No scheduled-job
    infrastructure exists in this app (no Vercel Cron / Supabase
    pg_cron), so this is a **lazy sweep on dashboard render**, not
    exactly at end-of-day per the Sacrament Meeting workflow's wording
    above — eventually consistent (archives on the next page view after
    the date passes) rather than at midnight, which is fine for a tool
    nobody is watching in real time. "Real activity" deliberately checks
    only tables that are *never* auto-seeded at meeting creation
    (`meeting_element_notes`, `sacrament_music`,
    `sacrament_speakers_adults/youth`, `sacrament_rabnm`,
    `agenda_items`, `meeting_action_items`, `council_notes`,
    `bishopric_minutes`) -- `sacrament_assignments`/
    `bishopric_assignments` (rotation-seeded at creation via
    `applyRotationsToNewMeeting`) and `sacrament_planning` (inserted at
    creation too) were deliberately excluded, since their mere
    existence proves nothing about whether anyone actually did
    anything -- the open item's original "assignments/planning rows
    exist" wording would have flagged every meeting as "real activity"
    immediately, which isn't what was wanted.
  - **Cancel a meeting from the dashboard.** Migration `037` adds
    `meetings.cancelled`/`cancellation_note`, same shape as
    `youth_activities` (migration `032`) -- shown, not hidden. Per-row
    Cancel (with an optional reason)/Un-cancel controls on `/dashboard`,
    bishopric-only; a cancelled meeting shows a red badge + note there
    and in the meeting's own header (`app/meetings/[id]/layout.tsx`). A
    cancelled meeting auto-archives once its date passes regardless of
    activity -- being cancelled already explains the lack of it.
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
- ~~**Consolidate the two Music tiles on the landing page.**~~ Done
  2026-09-08. The two candidates, found in `app/page.tsx` under the
  "Music" section (visible to `music_planner` + `bishopric`): "Sacrament
  Music Planning" (→ `/music`, bulk/single hymn entry) and "Music
  Coordination" (→ `/music-coordination`, a read-only status overview
  across upcoming meetings). Per the user: a single "entering/planning
  music for the future" tile is enough now -- the unified per-meeting
  Planning view (priority queue item 1, 2026-09-08) already covers
  everyday status for one meeting at a time, so the standalone
  weeks-at-a-glance overview added an entry point without a real
  capability gap left to fill. Kept `/music` (renamed "Sacrament Meeting
  Music Planning" on the tile) as the one entry point; **removed**
  `/music-coordination` and `lib/data/music-coordination.ts` outright
  rather than leaving them unlinked -- nothing else in the app
  referenced either (confirmed by grep before deleting). If a
  multi-meeting-at-a-glance view is wanted again later, it'd need to be
  rebuilt from scratch, not just re-linked.
- ~~**Sortable column headers in Table Admin.**~~ Done 2026-09-08:
  `components/admin/AdminTableEditor.tsx` gained click-to-sort `<th>`
  buttons (▲/▼ indicator, third click clears back to server/insertion
  order) exactly as scoped -- purely client-side, sorting a `useMemo`'d
  copy of the already-fetched `rows` prop, no schema or server change.
  `select`/`foreign_key` columns sort by their displayed option label
  (e.g. a person's name) rather than the raw id/UUID, falling back to
  the raw value if a row's value has no matching option; blanks/nulls
  always sort last regardless of direction.
- ~~**Bug: `bishopric_assignments` role check violation.**~~ **Fixed
  2026-09-06** (migration `038`): Table Admin's "Bishopric Meeting
  Assignment Rotation" grid offered the full Sacrament Meeting role
  list (Presiding/Conducting/Chorister/Organist/prayers) for
  `bishopric_assignments.role` -- `lib/admin/registry.ts` had been
  reusing `ASSIGNMENT_ROLES` wholesale, but Presiding/Conducting/
  Chorister/Organist only ever go into `sacrament_assignments`.
  Confirmed against migration `034`'s real rotation seed data that
  `bishopric_assignments` (shared by Bishopric Meeting, Ward Council,
  Youth Council) only ever configures opening_prayer/closing_prayer/
  spiritual_thought/handbook_training -- new `BISHOPRIC_ASSIGNMENT_ROLES`
  constant (`lib/data/sacrament-constants.ts`) reflects that, and
  migration 038 (re)documents the DB-side check constraint explicitly
  (it predates this repo's migration history and was never captured in
  a file).
- ~~**Drop `confirmed` from the rotation-assignment tables.**~~ Built
  2026-09-08, **migration needed a second pass** (see migration history
  above) -- ran `040`/`041` and `041` errored: two anon-facing RLS
  policies on `sacrament_assignments` (`"public can view confirmed
  assignments"`, `"public read confirmed"`) predated this repo's
  migration history and blocked the column drop. Same situation
  migration `038` hit for the `bishopric_assignments` check constraint
  -- undocumented DB objects created directly in the SQL editor before
  this file's migration history started. `041` now drops both by name
  first and replaces them with one policy gated on the meeting's own
  stage (`ready`/`live`) instead of the disappearing per-row flag --
  still needs to be re-run with the corrected file. Turned out to
  only ever exist on `sacrament_assignments` -- `bishopric_assignments`
  never had this column (confirmed while tracing every read site; see
  the bug fix noted just below). Asked the user what should replace it;
  answer: "treat every assignment as ready once filled" -- exactly how
  `bishopric_assignments` (Bishopric Meeting/Ward Council/Youth Council)
  already worked, with no per-row confirm step at all. What now gates
  the public program is the meeting's own stage (ready/live), per the
  Vision & Intended Workflows section, not a second per-row flag.
  Removed the "Confirmed" checkbox from `PersonRoleField`
  (`components/planning/DynamicElementField.tsx`) for sacrament role
  assignments, the `.eq("confirmed", true)` filter in
  `lib/data/public-view.ts`, the `confirmed: false` writes on insert in
  `lib/data/rotations.ts`/`app/rotations/actions.ts`/the
  `apply_rotation_assignment` Postgres function (re-defined by migration
  `041`), and the `confirmed` column from `sacrament_assignments` select
  statements in `lib/data/meeting-elements.ts`, `sacrament-planning.ts`,
  and `speaker-prayer-history.ts` (the last two would have started
  erroring on an unknown column the moment the DB column was dropped, so
  fixing them wasn't optional). Music Coordination's `prayers_confirmed`
  readiness count is renamed `prayers_assigned` (now just "does a row
  exist" instead of a separate confirm flag) -- `speakers_confirmed`
  is untouched, since that reads `sacrament_speakers_adults/youth
  .confirmed`, a distinct field on a different pair of tables that Table
  Admin queue item 5 already decided to keep exactly as-is.
  **Incidental bug found and fixed while tracing this:** Table Admin's
  "Bishopric Meeting Assignment Rotation" grid (`bishopric_assignments`
  in `lib/admin/registry.ts`) offered a "Confirmed" checkbox column that
  never corresponded to a real column on that table at all -- editing it
  would have errored (or silently done nothing, depending on how the
  generic update path handles an unknown column). Removed; unrelated to
  the still-unreproduced `/rotations` "server error" report below, which
  is about the page failing to load, not a save failing on this grid.
  **New idea raised while answering this, not yet scoped:** the user
  suggested a standing, always-current print/preview view of the
  sacrament program -- available to admins and whoever prints it, its
  own template (not the day-of public page), ready once every element is
  filled regardless of meeting stage. This is exactly the "sent file vs.
  dedicated print portal" question the Vision & Intended Workflows
  section flagged as undecided, and likely overlaps with the "printable"
  lifecycle stage the user separately grouped under the larger
  meeting-display redesign (items 4/10/12, deliberately deferred) --
  don't start building this without checking with the user which of
  those two conversations it belongs to.
- ~~**Bug report: sign-out doesn't seem to take effect.**~~ **Not
  actually a functional bug -- root-caused and fixed 2026-09-08.** The
  user's own follow-up once asked to reproduce: sign-out does log the
  user out on click; hovering the button beforehand just never showed a
  hand cursor, so it looked inert. Cause: Tailwind v4's Preflight resets
  `<button>` to `cursor: default` (matching native browser behavior --
  a deliberate change from v3, which defaulted to pointer), and nothing
  in this app opted a button back into `cursor: pointer` anywhere, Sign
  out included. Fixed once, globally, in `app/globals.css`
  (`button:not(:disabled), [role="button"]:not(:disabled) { cursor:
  pointer; }`) rather than patching every button component
  individually -- every button in the app gets the hand cursor now, not
  just this one. The original `signOut`/cookie-adapter code review from
  2026-09-06 was correct that nothing was actually wrong there.
- ~~**1985 Hymnal / newly-released hymns not in Music Reference.**~~
  **Fully populated 2026-09-08** (migration `040`): the user pasted the
  complete title list for both remaining collections directly (with
  real hymn numbers), so unlike the Children's Songbook (migration
  `027`, fetched page-by-page from churchofjesuschrist.org) this needed
  no WebFetch budget at all -- straight transcription from what was
  given. `hymns_1985`: all 341 hymns, 1-341, contiguous. `hymns_for_home_and_church`:
  82 entries across its two released number blocks (1001-1072, 1201-1210)
  -- that gap is the hymnal's own real numbering scheme (categories
  reserved for volumes not yet released), not a transcription gap. Music
  Reference is now fully populated across all three collections.
- ~~**Feature request: pre-fill rotation grids with every upcoming
  meeting × role combination.**~~ **Built 2026-09-06** as the
  applied-assignment grid on `/rotations` (see the Assignment Rotations
  architecture entry above) -- a bespoke page, not a Table Admin engine
  feature, which sidesteps the "Table Admin only ever renders real DB
  rows" limitation entirely: the grid always shows one row per upcoming
  meeting whether or not an assignment row exists yet for it.

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
   guessed at. The 1985 Hymnal and Hymns for Home and Church were later
   populated too (migration `040`, 2026-09-08) -- the user pasted both
   collections' full title lists directly, so that one needed no
   WebFetch budget at all. Music Reference is now fully populated
   across all three collections.
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
   chorister/organist) and `primary_program`. **Confirmed 2026-09-06**
   (the user pointed out a printed-program-vs-conducting-script
   distinction, already matching what's built): the public program
   (`lib/data/public-view.ts`) lists Chorister and Organist as their own
   named lines, while the conducting script (`lib/data/conducting.ts`)
   has no separate lines for them at all -- Recognize Music is one
   spoken cue naming both ("We would like to thank {chorister}... and
   {organist}...") rather than two individual introductions. No change
   needed. Missionary speakers reuse
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
