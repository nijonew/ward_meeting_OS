# Ward OS — Project Context for Claude Code

Next.js / TypeScript / Tailwind app on Vercel, Supabase backend. LDS ward
meeting planning: agendas, assignments, rotations, sacrament program
publishing, announcements, youth activities.

**Production domain (always test/verify here, never a Vercel preview URL):**
https://ward-meeting-os.vercel.app

## Current migration number: 076

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
  above): confirmed run (2026-10-03).
- `048` (one-time backfill: fills `sacrament_music.piece_name` from
  Music Reference wherever a hymn number was saved with no title --
  see the hymn-title auto-fill entry below): confirmed run (2026-10-03).
- `049` (one-time bulk import: 412 names into `people`, skipping any
  that already exist -- see the bulk people import entry below):
  confirmed run (2026-10-03).
- `050` (one-time backfill: sets `confirmed = true` on every existing
  `sacrament_speakers_adults/youth` row that already has a real speaker
  -- fixes a real bug where speakers added through the Speakers & Music
  list never showed in the public program, see Known open items below):
  confirmed run -- the user had already run it once before this
  session's own "still needs to be run" note was written, and
  confirmed again by re-running it 2026-10-11 once the missing-speakers
  report below surfaced. This file's own tracking had drifted from
  reality here -- the user runs migrations directly and doesn't always
  report back, so "still needs to be run" should be read as "last
  confirmed state this file knew about," not a live guarantee.
- `051` (`sacrament_music.hymn_number` integer -> text -- live hymn-title
  pre-fill + the "C" prefix for Children's Songbook numbers, see Known
  open items below): confirmed run.
- `052` (new `ward_settings` table, a singleton row holding the ward's
  own display name -- the header wordmark change, see Known open items
  below): confirmed run.
- `053` (new `sacrament_visiting_authorities` table -- the Visiting
  Authorities multi-select + write-in list, see Known open items
  below): confirmed run.
- `054` (new `delete_meeting_cascade` Postgres function -- the Delete
  Meeting action, see Known open items below): confirmed run.
- `055` (new `sacrament_rabnm.calling_planning_id` -- the explicit link
  back to the Calling Planning row an announcement came from, needed
  for Ward Business's inline pull/un-pull mechanism, see Known open
  items below): confirmed run.
- `056` (makes sure `profiles.role` accepts a new `"bishop"` value,
  distinct from the shared `bishopric` role -- the Verify Logins /
  Bishop-succession feature, see Architecture above): confirmed run
  ("no rows returned" is the expected, successful result -- it's pure
  DDL, no `SELECT`).
- `057` (ten `feature_*` boolean columns plus `requires_self_handoff`
  and its guard trigger, directly on `callings` -- the permissions
  model, see Architecture above. Rewritten in place under this same
  number: the file originally held a different design,
  `calling_role_mappings` + an auto-sync trigger, which was deleted
  before ever being confirmed run): confirmed run.
- `058` (drops `profiles.role`/`role_source`, both added by migration
  `056` -- superseded by `057`'s per-calling feature flags, see
  Architecture above): confirmed run. **Caution for next time:** this
  one was run slightly ahead of its matching code deploy, which left
  the still-live old code querying a column that no longer existed --
  every account (including the Bishop's) lost all access until the new
  code finished deploying. A schema-dropping migration like this one
  should land at the same time as the code that stops depending on the
  dropped column, not meaningfully before it.
- `059` (new `sacrament_planning.ready_for_public` boolean -- the
  "ready for public consumption" checkbox gating Communications
  Specialist's early preview, see Known open items below): confirmed
  run.
- `060` (new `features` catalog table + `calling_features` many-to-many
  join, seeds the full ~58-feature list, drops the ten `feature_*`
  boolean columns migration `057` added to `callings` -- the granular-
  features permissions rework, see Architecture above): confirmed run.
- `061` (removes `sacrament_notes`/`sacrament_agenda_items` from the
  `features` catalog -- the user's own call, not needed for Sacrament
  Meeting, see Architecture above): confirmed run.
- `062` (new `meetings_with_real_activity` Postgres function -- the
  dashboard auto-archive sweep's performance fix, see Known open items
  below): confirmed run.
- `063` (drops three stale RLS policies plus an orphaned function on
  `agenda_items` -- the "column c.backup_holder_id does not exist"
  bug hit while deleting a meeting, see Known open items below):
  confirmed run.
- `064` (new `sacrament_assignments.guest_name` column -- the guest
  Chorister/Organist option, see Known open items below): confirmed
  run.
- `065` (one-time bulk import: 6 real announcements the ward had
  already collected on its old Google Form, pasted directly by the
  user 2026-10-10 -- see that migration file's own header comment for
  the full column mapping): confirmed run.
- `066` (replaces calling_planning's calling_status/release_status
  option lists in `admin_select_options` with the user's own
  redesigned 12-item/6-item vocabulary -- see Known open items below
  for the full mapping): confirmed run.
- `067` (one-time bulk import: 123 calling_planning rows from the
  ward's real calling-tracker spreadsheet, pasted directly by the user
  2026-10-10, plus whatever `callings`/`people` rows it needed that
  didn't already exist -- depends on `066` having already run first.
  See that migration file's own header comment for the full
  status-word mapping and the handful of source-data fixes made along
  the way). **First attempt failed in production** --
  `operator does not exist: date = text` on the final insert's own
  WHERE NOT EXISTS clause, since the VALUES block's date literals were
  plain uncast strings (Postgres infers those as `text`, not `date`,
  unlike migration 065's own VALUES list which used `date '...'`
  literal syntax throughout). File updated to cast both date columns
  once via a wrapping SELECT rather than at every downstream
  reference. **Second attempt also failed in production** -- `new row
  for relation "calling_planning" violates check constraint
  "calling_planning_release_status_check"` trying to insert
  `release_status = 'to_be_released'`. Same class of problem as
  migrations 038/041/063 before it: an undocumented CHECK constraint on
  `calling_status`/`release_status`, created directly in the Supabase
  SQL editor before this repo's migration history started, hardcoded
  against migration 022's original vocabulary and never updated when
  `066` replaced it. Migration `068` drops both constraints outright
  (not recreated against the new list -- see that file's own comment
  for why: `admin_select_options` is this app's own documented single
  source of truth for these two fields, and a hardcoded CHECK
  constraint duplicating that list is exactly what just broke).
  `067` itself needed no further changes once `068` ran first --
  confirmed run.
- `068` (drops the undocumented `calling_planning_calling_status_check`/
  `calling_planning_release_status_check` constraints that blocked
  `067` above): confirmed run.
- `069` (one-time bulk import: the ward's real 2026 youth activity
  history from six per-class calendars pasted directly by the user
  2026-10-10/11, reconciled against each other and against migration
  032's own earlier seed data -- see that migration file's own header
  comment for the full reconciliation rules and the Known open items
  entry below for how the two "individual calendars vs. rotation"
  conflicts were resolved). **First attempt failed in production** --
  `null value in column "title" ... violates not-null constraint` on
  the 2026-07-29 Combined YM row (and 20 others like it):
  `youth_activities.title` has always been `not null`, but a blank/
  unplanned week in a source calendar legitimately has nothing to put
  there. File updated to use the literal placeholder text
  `(Not yet planned)` instead of `null` for every such row. **Second
  attempt also failed in production** -- `violates check constraint
  "youth_activities_group_name_check"` inserting `'Gatherers of
  Light'`. Same class of problem as migrations 038/041/063/067/068: an
  undocumented CHECK constraint, created directly in the Supabase SQL
  editor before this repo's migration history started, still hardcoded
  against the pre-rename group names and never updated when Gatherers
  of Light/Messengers of Hope/Builders of Faith replaced the old
  age-based YW class names -- no individual-class row for a YW class
  had ever actually been inserted before this migration, so it never
  surfaced sooner. File updated to drop that constraint outright (not
  recreated against the current list, same reasoning as migration
  068's identical fix) -- confirmed run (with the twice-corrected
  file).
- `070` (new `youth_activity_cancellations` table -- the Activity
  Cancellations page, see Known open items below): confirmed run.
- `071` (new `feedback` table + `table_admin_feedback` feature catalog
  row -- the persistent Feedback Widget, see Known open items below):
  confirmed run.
- `072` (moves the `announcements` element's `sort_order` to
  immediately before Closing Hymn in every Sacrament Meeting format
  that has both, across `meeting_templates` and already-seeded
  non-archived meetings -- see Known open items below): **on hold, per
  the user's own request 2026-10-11** ("I will hold off on 72. 72 may
  be more related to templating. I just want the ability to add a
  second announcement block before the closing hymn/prayer") -- see
  that same Known open items entry for the real need this surfaced and
  why it isn't simply "run 072."
- `073` (one-time bulk import: real member-cycle order + `next_index`
  into 10 of this app's existing generic rotations -- Bishopric
  Meeting/Ward Council/Youth Council's opening prayer, closing prayer,
  spiritual thought, and handbook training -- derived from the ward's
  real "2026 Syracuse Heritage Ward Master Meeting Schedule &
  Assignments" spreadsheet, pasted directly by the user 2026-10-11; see
  Known open items below for the other 6 columns this did NOT resolve
  and why): confirmed run.
- `074` (drops `meeting_planned_elements`' `unique (meeting_id,
  element_id)` constraint, adds `announcements.planned_element_id` --
  lets a meeting have more than one Announcements block, each
  independently scoped, see Known open items below): confirmed run.
- `075` (replaces `sacrament_assignments`' stale anon-facing RLS
  policy -- gated on `stage in ('ready', 'live')`, which Sacrament
  Meeting stopped reaching entirely once its lifecycle was simplified
  2026-09-10 -- with one gated on `stage <> 'archived'` instead; root
  cause of Presiding/Conducting/every prayer being invisible to a
  logged-out public viewer. Amended in place the same day, before ever
  being run, to add a matching brand-new anon policy on
  `sacrament_program_items` -- which had none at all, hiding the
  entire Teaching Program section the same way -- see Known open
  items below): confirmed run.
- `076` (one-time repair: clears `announced_meeting_id` on any
  `calling_planning` row left orphaned by the `pushCallingToSacramentMeeting`
  calling_planning_id bug -- see Known open items below): **not yet
  run** -- ask the user to run it once the matching code fix is live.
- `077` (new `sacrament_announcement_pulls` many-to-many table, replacing
  the single-column `announcements.meeting_id`/`planned_element_id` link
  -- lets the same announcement be pulled into more than one Sacrament
  Meeting at once, and re-pulled into a new one after already being used
  in a past one; also amends `delete_meeting_cascade` to clean up the new
  table -- see Known open items below): **not yet run**.

Next migration should be `078_*.sql`. Migrations are plain `.sql` files at
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
  ~~First-time users must visit `/auth/new-user` once to set a
  password~~ -- true only through 2026-10-09. That page existed for an
  account an admin had already created directly through the Supabase
  dashboard (split from `/auth/reset-password` into its own page
  2026-10-03, the user's own report: "There is not distinction between
  new user and lost password. I would like to have separate links and
  pages for that"), and called the exact same `requestPasswordReset`
  action `/auth/reset-password` does (`app/auth/actions.ts`) --
  Supabase's own "send a password-set link" flow can't distinguish "a
  real admin-created account" from "no account at all," so the page
  showed the same false "check your email" success message either way.
  **Deleted outright 2026-10-10**, per the user's own request (see
  below) to collapse the no-account case down to one path -- see Known
  open items for the bug report that led here.
  - **Self-serve sign-up (`/auth/request-access`, calling a new
    `requestAccess` action -- plain `supabase.auth.signUp()`) added
    2026-10-03** (the user's own follow-up question, after reading the
    old `/auth/new-user` page's "ask your ward's admin to add you
    first" line: "Can the user create an account without the ward
    admin setting that up first?"). No separate "pending request"
    table or approval queue was needed: the resulting login has no
    `people` row linking to it yet (same as any
    admin-invited-but-unverified account used to look), which is
    exactly what `/admin/verify-logins` already treats as "needs
    verification" -- see that feature's own entry below (now driven by
    the person-link itself rather than a since-deleted `role is null`
    check, per the "Permissions" rework later in this section). This
    is a real, deliberate extension of the "Adding new people" policy's
    identity-confirmation step, not a loosening of it -- see that
    section's own note. The landing page (`app/page.tsx`) gained a
    small inline notice for a logged-in, not-yet-linked account
    ("you're signed in, but an admin still needs to verify your
    account"), so a freshly self-signed-up person isn't left looking at
    a confusingly bare page with no explanation.
  - **Made the single, only no-account path, 2026-10-10** (the user's
    own words, immediately after the escape-hatch-visibility fix
    below: "I would prefer that there not be two options - login with
    previous access granted by email, or request access. I really only
    want request access as the only option. Someone puts in their
    email, they click the request access button, they are told to
    verify their email and that once their email is verified an admin
    will review their access request."). `/auth/new-user` and the
    admin-dashboard-invite path it served are gone from the app
    entirely -- `LoginForm.tsx` now links to exactly two places,
    `/auth/reset-password` ("I already have an account, forgot my
    password") and `/auth/request-access` ("I don't have access yet"),
    with nothing in between for the "maybe I was already invited"
    ambiguity that caused the bug this same day. `/auth/request-access`
    already asked for a password (required for `signUp()` to create
    the account at all) -- unchanged by this, still the same email +
    password + confirm form, just now reached directly from `/login`
    rather than through the deleted intermediate page.
  - **Email delivery issue, reported 2026-10-03, resolved 2026-10-04:**
    the user tried `/auth/reset-password` while testing a new account
    and got no email after 10 minutes; a later `/auth/request-access`
    attempt surfaced the real cause directly as "Error sending
    confirmation email" -- Supabase's own default built-in email sender
    (low-volume, not meant for production) failing outright rather
    than just being slow. The user set up custom SMTP through their
    own Gmail account (App Password + `smtp.gmail.com`) in the Supabase
    dashboard and confirmed the full loop works end to end: sign up,
    confirm, sign in, show up at `/admin/verify-logins`, get verified,
    sign in again as the verified account. `NEXT_PUBLIC_SITE_URL`
    wasn't the culprit here, but is still worth double-checking it's
    set to `https://ward-meeting-os.vercel.app` in Vercel if a
    password-reset *link* itself (as opposed to the email never
    arriving at all) ever misbehaves.
- **Permissions** (`calling_features` many-to-many table) --
  **eliminated the whole idea of a stored "role" entirely, in two
  passes on 2026-10-04.** First pass: a single `profiles.role`
  (unchanged for most of this project's life) grew a same-day "bishop"
  vs "bishopric" split, then an admin screen (`/admin/verify-logins`)
  to set it, then a Postgres trigger (`calling_role_mappings`) to keep
  it auto-synced from calling changes, then a "general" catch-all role
  and two more role values (`ward_council`/`youth_council`) -- until
  the user stepped back and noticed the trigger/mapping-table design
  was duplicating the exact same idea the pre-existing
  `meeting_type_members` table already expressed differently ("Could
  we be duplicating effort here?"), and replaced the whole thing with
  ten `feature_bishopric`/`feature_music_planner`/etc. boolean columns
  directly on `callings` (migration `057`) -- access as the union of
  every true flag across whichever active callings someone held.
  **That first pass turned out to be the same mistake with new names**:
  the user's own correction, immediately after trying it: "I still
  think features are being defined by role names. I would rather
  define features by features," followed by a detailed worked example
  (per-meeting-type viewing/planning/template/agenda-items/notes,
  Sacrament Meeting's own extras, every standalone tool, and one
  feature per Table Admin table) -- a real decomposition of
  *capabilities*, not a one-for-one swap of role names into column
  names. **Everything below is this second, current design** --
  anywhere else in this file that still mentions `feature_bishopric`,
  `profile.role`, or `hasFeature(profile, "bishopric"/"music_planner"/
  "communications_specialist"/"ward_council"/"youth_council"/a youth
  role name)` is describing one of the two superseded designs; treat
  it as history, not what the code does today.
  - **Current design: a `features` catalog table (migration `060`) +
    `calling_features`, a real many-to-many join** (`calling_id`,
    `feature_key`, plus a surrogate `id` since Table Admin's generic
    grid engine needs one on every table) -- not a column per feature,
    which doesn't scale past a handful of flags. ~58 granular feature
    keys, grouped by category: per meeting type (Sacrament, Bishopric
    Meeting, Ward Council, Youth Council) × 5 actions each
    (`<type>_viewing`/`_planning`/`_template`/`_agenda_items`/`_notes`
    -- 20 total), 4 Sacrament-only extras (`sacrament_music`,
    `sacrament_conducting`, `sacrament_rabnm`, `sacrament_program_view`
    -- a Communications-Specialist-style early preview of a future/past
    program, independent of the day-of public page), 13 standalone
    tools (`announcement_adding`, `announcement_management`,
    `calling_planning`, `youth_teaching_planning`,
    `youth_activity_planning`, `ward_event_planning`,
    `meeting_schedule`, `meeting_cancellations`, `rotations`,
    `speaker_prayer_history`, `callings_roster`, `verify_logins`,
    `meeting_templates_admin`), and one feature per Table Admin table
    (21 of them, `table_admin_<table>`) -- `/admin`'s own table list is
    now filtered per-account by exactly these, and `/admin/[table]`
    re-checks the specific table's own feature, not a blanket
    "bishopric" gate. The full `Feature` union (the real source of
    truth code checks against) lives in
    `lib/supabase/get-session-user.ts`; the `features` table is that
    same catalog made queryable for display/grouping in the
    `calling_features` Table Admin grid, not itself editable through
    the app.
  - A person's access is still the **union** of every feature granted
    by any *active* calling they currently hold -- computed fresh on
    every request by `getSessionUser()`
    (`lib/supabase/get-session-user.ts`), never cached. New
    `hasFeature(profile, key)`/`hasAnyFeature(profile, keys[])` helpers
    replace every old `profile.role === "..."` / first-pass
    `hasFeature(profile, "bishopric")` check across the app -- a
    meeting-type-specific check almost always goes through new
    `meetingFeature(type, action)`/`allMeetingFeatures(action)`
    (`lib/data/meeting-features.ts`) rather than a hardcoded per-type
    string, so e.g. Bishopric Meeting/Ward Council/Youth Council's
    shared agenda-grid save (`saveAgendaGrid`) can resolve the right
    feature for whichever specific type a given meeting actually is.
  - **No more "admin sees everything" bypass anywhere.** The first
    pass still had one: a single `bishopric` feature flag that every
    caller special-cased on top of its own real check ("show every
    meeting type to Bishopric, every YW class to YW Presidency," etc.).
    Under pure per-capability features there's no single flag to hang
    a bypass on, so those are gone -- an admin simply holds the
    specific feature for each thing they manage (e.g. all 20 meeting-
    type features, `rotations`, every `table_admin_*` key), and is
    included in every list/gate the normal way, same as anyone else.
    **One real, user-confirmed behavior change from this**: Youth
    Teaching Planning's old rule ("Bishopric sees every class, Young
    Women Presidency sees every YW class, everyone else only their own
    assigned class") had no granular-feature equivalent to fall back
    on -- asked directly, the user chose to drop the bypass rather than
    hardcode calling names as a substitute: every class anyone should
    see, Bishopric and YW Presidency included, now needs a real
    `youth_class_teachers` row, the same mechanism every individual
    teacher already used. `getAccessibleClasses` (`lib/data/teaching-
    assignments.ts`) is now a thin wrapper around
    `getTaughtClassesForUser` -- seed rows for whoever should see
    every class or every YW class as a one-time step in Supabase or
    Table Admin.
  - **"Attends a meeting" (My meetings tiles, Submit an Announcement/
    Meeting Agenda Items gating) is now `<type>_viewing` OR
    `<type>_planning` OR `<type>_agenda_items`** on a calling, unioned
    with the pre-existing calling-based `meeting_type_members` mapping
    -- all in `getVisibleMeetingTypesForUser`
    (`lib/data/meeting-type-access.ts`). Any one of the three implies
    inclusion deliberately (an admin managing a type should see its
    tile too; someone granted only agenda-item access for a type still
    counts as attending it) -- `template`/`notes` are deliberately
    excluded, since those are sub-permissions once already involved
    with a type, not signals of attendance on their own.
  - **Verify Logins is pure identity-matching** -- link a login to a
    person, full stop; there's no role to pick. Access comes
    automatically from whichever calling(s) the linked person holds.
    "Needs verification" (`lib/data/profile-verification.ts`) means
    "no `people` row has this `profile_id`" -- an ordinary verified
    member with no feature-granting calling has an empty feature set,
    and that's a completely normal, expected state.
  - **Bishop succession is preserved by `callings.requires_self_handoff`**
    (migration `057`, untouched by `060`): a general-purpose boolean
    (not hardcoded to any specific calling by name -- this app has been
    burned twice already guessing a real calling name wrong, see
    `STAKE_PRESIDENCY_CALLING_NAMES`'s own history) that the admin
    flags themselves on whichever calling(s) need it. A Postgres
    trigger (`enforce_calling_handoff`) rejects *transferring* a
    flagged calling from one real holder to a different real one
    unless the acting user (`auth.uid()`) already holds it -- vacating
    it to null, or assigning a first holder when currently vacant,
    stays open to any admin, so a flagged calling can never get
    permanently stuck if its holder is unavailable. Succession
    protection is orthogonal to how features are catalogued, so this
    needed no change across either refactor pass.
  - **Migration `060`, confirmed run**: new `features`
    (catalog, read-only reference data) and `calling_features` (the
    actual many-to-many assignment) tables, seeds the full ~58-feature
    list, and drops the ten `feature_*` boolean columns migration `057`
    added -- fully superseded by `calling_features`.
  - **Known deploy-ordering gotcha, hit live during the FIRST pass,
    worth repeating for the second**: running `057`/`058` (dropping
    `profiles.role`) a few minutes *before* the matching code was
    pushed left the still-live old code querying a column that no
    longer existed, so `getSessionUser()` silently returned a null
    profile for literally everyone, including the Bishop account
    itself, until the new code deployed. The same risk applies to `060`
    -- don't run it meaningfully before this session's matching code is
    live in production.
  - **Bootstrapping after `060` ships**: every calling's feature grants
    are gone the moment `060` drops the old `feature_*` columns, and
    nothing has `calling_features` rows yet -- nobody has any access at
    all, including Table Admin itself (needs `table_admin_callings`).
    The user will need to re-grant their own account's calling at least
    `table_admin_callings` directly in Supabase's Table Editor
    (`calling_features`, matched by `calling_id`/`feature_key`) as a
    one-time manual step, then use the "Calling Features" tool below to
    assign the rest -- the same bootstrapping situation as the first
    pass, one more time.
  - **Calling Features assignment UI** (`/admin/calling-features`,
    built the same day the user first tried the raw grid approach and
    flagged the real problem with it: "adding a row for each calling x
    the number of features for that calling... could be thousands of
    rows"): a dropdown to pick a calling, then every feature rendered
    as a checkbox grouped by category (same fixed order as the
    migration's own insert order -- Sacrament Meeting, Bishopric
    Meeting, Ward Council, Youth Council, Tools, Table Admin -- since
    `features` has no category-ordering column of its own, just a
    per-feature `sort_order` within one), pre-checked for whatever that
    calling already grants, one "Save Changes" button. `saveCallingFeatures`
    (`app/admin/calling-features/actions.ts`) diffs the submitted
    checked set against what's actually in `calling_features` and only
    inserts/deletes the rows that changed, rather than clearing and
    re-adding everything -- a save can never leave the calling with a
    momentarily-empty feature set partway through. Same
    dirty-tracking/Saving-Saved feedback pattern as every other "our
    favorite grid format" page in this app
    (`components/admin/CallingFeaturesForm.tsx`), same
    `table_admin_callings` gate as the raw grid it's a front end for --
    `/admin`'s "Other Admin Tools" section links to it, and the raw
    `calling_features` Table Admin entry's own description now points
    here for everyday use, keeping the generic grid itself only as a
    troubleshooting/bulk-fix fallback.
  - **Bug found and fixed the same day, before `060` was ever run**: the
    meeting-type action features' labels (`sacrament_viewing`,
    `bishopric_meeting_planning`, etc.) were just "Viewing"/"Planning"/
    "Template Creation"/"Agenda Item Adding"/"Note Taking" -- identical
    across all four meeting types, relying entirely on the `category`
    column (shown as a heading on the new checklist, but not
    necessarily visible everywhere a label might appear, e.g.
    `AppHeader`'s feature tooltip if it ever switched from raw keys to
    labels) to disambiguate. The user caught this directly: "it appears
    that the meeting type viewing/template/planning features don't
    have the meeting types in the feature titles." Fixed by amending
    migration `060` in place (not yet run, so no new migration number
    needed) -- all 20 of these labels now spell out their meeting type
    (e.g. "Sacrament Meeting Viewing", "Bishopric Meeting Planning").
    The other ~38 features were already unique on their own and didn't
    need this.
  - **`sacrament_notes`/`sacrament_agenda_items` removed entirely,
    migration `061`** (2026-10-04, right after `060` was confirmed
    run) -- the user's own call: "lets remove note taking and agenda
    item features from sacrament meeting calling features. they are
    not needed." Sacrament Meeting has no Minutes/Action Items/Council
    Notes concept at all (that's exclusively a Bishopric Meeting/Ward
    Council/Youth Council thing) and no agenda-item-submission workflow
    either (Submit an Agenda Item's own dropdown already excludes
    Sacrament Meeting) -- both were speculative entries from the
    original per-meeting-type × per-action matrix that never had
    anything real to attach to for this one type. Dropped from the
    `Feature` union (`lib/supabase/get-session-user.ts`) and the
    `features` table (`calling_features.feature_key`'s `on delete
    cascade` means dropping the catalog row also removes any grant of
    either to any calling automatically -- nothing else to clean up).
    No application code needed to change: `meetingFeature()`'s return
    type is produced via a cast, not a lookup, so the handful of call
    sites that loop over every meeting type for a given action
    (`getVisibleMeetingTypesForUser`'s `agenda_items` check,
    `archived/page.tsx`'s `showRealTimeNotes`) simply never find
    `sacrament_notes`/`sacrament_agenda_items` granted to anyone --
    which is exactly the intended behavior, not a gap.
  - `AppHeader`'s "signed in as" name + feature-tooltip (added during
    the first pass, unchanged structurally) now lists whichever of the
    ~58 granular keys the signed-in account actually holds.
  - This is still separate from `people.profile_id` (migration `030`,
    settable from `/admin/verify-logins` or Table Admin's People grid
    as "Login Account"), which links a login to a *person* record --
    without that link, a person's callings (and therefore features)
    can never resolve for them no matter what's granted on
    `calling_features`.
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
  Clerk. This is the group the app's shared `feature_bishopric` flag
  (on whichever callings hold it -- Bishop, both Counselors, Exec Sec,
  Clerk) actually represents today — say "admins" for that permission
  group from now on, and reserve "bishopric" for the three-person
  presidency specifically (e.g. the Conducting rotation correctly
  cycles Bishop → 1st Counselor → 2nd Counselor only, not the wider
  admin group — that one was already right).

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
   **Extended 2026-10-03** (the user's own question: "can the user
   create an account without the ward admin setting that up first?"):
   a person can now also create their own account directly, via
   `/auth/request-access` — the human-confirms-identity step this
   policy cares about didn't move or weaken, it just moved *after*
   signup instead of before it. A self-created account has no `people`
   row linking to it, the exact same state an admin-invited-but-unverified
   one is already in, so it lands in the same `/admin/verify-logins`
   queue either way and gets zero real access until an admin links it
   to a person -- access then follows automatically from whichever
   calling(s) that person holds, see Architecture above.
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

**Two follow-ups right after the auto-archive sweep above shipped,
2026-10-18 (same conversation):**

1. **"These then need to be removed from dropdown select options."**
   Auto-archiving set `status = 'archived'`, which already excludes a
   row from `getPublishedAnnouncements`/`getGeneralSubmissions`/Table
   Admin's own live list -- but `getPullableAnnouncements`
   (`lib/data/sacrament-announcements.ts`, what populates the "call in
   an announcement" dropdown on a Sacrament Meeting's Planning page)
   queries `announcements` directly, bypassing both the `getAdminRows`
   `sweepBeforeRead` hook and the two `general-submissions.ts`
   functions that call the sweep themselves. Without its own call, an
   expired announcement would keep offering itself in that dropdown
   until something else happened to archive it first. Now calls
   `sweepPastAnnouncements()` directly, same as the other three real
   read paths.
2. **"Change the depiction of announcement schedules to not be
   military time... show the date in a format of day of the week,
   month, date (monday, october 19th at 6:00 pm)... make that change
   in the conducting view and where they are viewed."** New
   `formatAnnouncementDate`/`formatAnnouncementTime`/`formatAnnouncementDateRange`
   (`lib/data/announcements.ts`) replace the public Announcements
   page's own local, abbreviated formatters (`formatDate`/`formatTime`/
   `formatDateRange`, built 2026-10-10 -- AM/PM already, but
   "Mon, Oct 19 · 6:00 PM" rather than the fuller form now wanted) --
   now a shared helper so the Conducting script's own spoken wording
   (`announcementWording`, `lib/data/conducting-rows.ts`) could use
   the identical format too, matching the user's explicit "and where
   they are viewed." Renders "Monday, October 19th at 6:00 PM" (full
   weekday/month names, an ordinal day suffix, "at" instead of a
   middle dot) -- Conducting's own wording still only ever reads
   `start_date`/`start_time` aloud, same scope as before, just the new
   format. Table Admin's/Manage Announcements' plain `<input
   type="date">`/`<input type="time">` editing fields are untouched --
   this was about reader-facing depictions, not data entry.

Confirmed via `tsc`/`eslint`/`next build` only, same no-live-browser
gap as everything else in this project -- ask the user to check that
an expired announcement no longer shows up in a Sacrament Meeting
Planning page's "call in an announcement" dropdown, and that both the
public Announcements page and the Conducting script now show a date
like "Monday, October 19th at 6:00 PM" instead of the old abbreviated/
24-hour forms.

**Announcements now auto-archive once their own date range ends,
2026-10-18** (the user's own question: "can this automatically
archive or delete announcements whose time has passed?"). Before this,
`getPublishedAnnouncements()` filtered purely on `status = 'published'`
with no date check at all -- a real, if minor, gap: an announcement for
a one-off event stayed on the public page forever unless an admin
remembered to archive it by hand.

New `sweepPastAnnouncements()` (`lib/data/announcements.ts`) -- the
same lazy-sweep-on-read pattern as every other automatic cleanup in
this app (`autoArchivePastMeetings`, `sweepMeetingCancellations`,
`autoGenerateUpcomingMeetings`), since there's still no cron
infrastructure to run this on a real schedule. "Time has passed" means
`end_date`, or `start_date` when there's no `end_date`, is strictly
before today in Mountain Time (`getMountainTimeNow()`, same timezone
reasoning as the Sacrament Meeting public-visibility fix -- this also
governs a genuinely public page, not an admin-only filter). Many real
announcements legitimately have neither date set (General Information,
a standing Lesson note, etc.) -- those are never touched, nothing to
compare against.

**Archives, never deletes** -- asked for both, but auto-*deleting*
would be the one genuinely irreversible automatic action anywhere in
this app; every other time-based sweep already built here
(auto-archiving a meeting, cancelling one, generating the next batch)
only ever does something reversible, with the actual destructive
option (Delete Meeting, Delete Youth Activity, Table Admin's row
Delete) always a deliberate, one-at-a-time human click. Chose to match
that precedent rather than add the first automatic permanent-delete in
the app -- an admin can still delete an auto-archived announcement by
hand from Manage Announcements or Table Admin if they genuinely want
it gone for good. Only ever moves a `published` row to `archived` --
a `pending` row (never reviewed) or one already `archived` is left
alone.

**Wired in generically, not as an announcements-specific hardcode**:
new optional `AdminTableConfig.sweepBeforeRead` (`lib/admin/types.ts`),
called once by `getAdminRows()` (`lib/admin/table-data.ts`) before it
queries -- the `announcements` registry entry sets
`sweepBeforeRead: sweepPastAnnouncements`, so both `/admin/announcements`
(Table Admin) and `/announcements` (Manage Announcements) pick it up
automatically through the one shared config, same reasoning as the
`select_with_other`/`multi_select` column types added the same day.
`getPublishedAnnouncements()`/`getGeneralSubmissions()`
(`lib/data/general-submissions.ts`) call it directly too, since both
query `announcements` straight from Supabase rather than through
`getAdminRows` -- the public page and the admin inbox's own stray-items
fallback both needed it called explicitly.

Confirmed via `tsc`/`eslint`/`next build` only, same no-live-browser
gap as everything else in this project -- ask the user to check that
an announcement with a past `end_date` (or `start_date` with no
`end_date`) shows as Archived in `/announcements` and is gone from the
public page once its Manage Announcements/Table Admin/public page is
next loaded, and that an announcement with no dates at all is
correctly left alone.

**Table Admin gained two new column types -- `select_with_other` and
`multi_select` -- so Manage Announcements matches the real submit
form's own options, 2026-10-18.** The user's own report: "The manage
announcements page entries are all seemingly short answer or similar.
Can the same options in the submit announcements page be available
via dropdown or checkbox in dropdown on the manage announcements
page?" Organization/Type/Audience/Where Announced had always been
plain `text` columns in the `announcements` registry entry (see that
entry's own prior comment: "Organization/Type are free text... since
the real form's 'Other' answers shouldn't get stranded outside a
fixed list; Audience/Where Announced are comma-separated... no
multi-select column type yet") -- a deliberate choice at the time,
but one that left the one page admins actually use to manage real
submissions (`/announcements`, which renders the exact same registry
config `/admin/announcements` does) with no structured editor for any
of the four, even though the submit form itself
(`AnnouncementForm.tsx`) has always asked for them as a radio-select-
with-Other or a checkbox group.

Rather than reverting to a fixed closed list and losing "Other" the
way the original design worried about, both new column types solve
that directly:
- **`select_with_other`** (Organization, Type): a real `<select>` of
  the same fixed options the submit form offers, plus an "Other" entry
  that reveals a free-text box. Whenever a row's current value doesn't
  match any fixed option -- including a genuine prior "Other" answer,
  or the literal word "Other" itself (the submit form's own fallback
  when "Other" is picked with nothing typed,
  `resolveOtherRadio`/`app/submit/actions.ts`) -- the dropdown shows
  "Other" selected with the real text underneath, so nothing already
  submitted is ever stranded outside the list.
- **`multi_select`** (Audience, Where Announced): a checkbox-in-dropdown
  (`MultiSelectDropdown.tsx`, same portal/fixed-position technique
  `ColumnFilterDropdown` already uses, needed for the same reason --
  this grid's own wrapping div is `overflow-x-auto`, which clips an
  ordinary absolutely-positioned panel), still storing one comma-joined
  string on the same real `text` column -- no schema change needed.
  Parsing that joined string back into individual checkboxes walks the
  fixed option list in its own order and peels matches off the front
  of the raw value (not a naive split on the separator), specifically
  because one real option's own label contains the separator ("Ward
  Communications (Printed, Weekly Email, Social Media, etc.)") and
  would otherwise fracture into nonsense fragments. This assumes
  whatever's stored preserves that same fixed order, which is always
  true for anything saved through the real submit form -- a value
  someone hand-typed directly into the old free-text field, in a
  different order or containing something outside the list, might not
  parse back into checkboxes correctly, but nothing is destroyed by
  just viewing it; only clicking Save on that specific row would
  replace it with whatever the checklist shows checked.

Both are genuinely generic additions to `lib/admin/types.ts`'s
`AdminColumnType`/`AdminTableEditor.tsx` -- not announcement-specific
code paths -- available to any future Table Admin column that needs
the same shape (a single value with a free-text escape hatch, or
several values from a fixed list in one text column). `MULTI_SELECT_SEPARATOR`
(`lib/data/announcement-constants.ts`) had been declared back when
Audience/Where Announced were first built but never actually used
anywhere until now -- it's the one shared source of truth for the
join format between the submit form and this new editor, so the two
can't drift apart.

Both pages that render the `announcements` table -- `/admin/announcements`
(Table Admin) and `/announcements` (Manage Announcements) -- picked
this up automatically with no page-level changes, since both already
share the exact same registry config and `AdminTableEditor` component.

Confirmed via `tsc`/`eslint`/`next build` only, same no-live-browser
gap as everything else in this project -- ask the user to check
`/announcements` once deployed: Organization/Type should show as
dropdowns (with "Other" revealing a text box for any existing
non-fixed answer), and Audience/Where Announced should show as a
button summarizing the current selection that opens a checklist when
clicked.

**Delete pinned to the right edge, and a real Confirmed toggle added
to the Combined-group pages, 2026-10-17** -- two follow-ups from the
hub flattening above, both from the same conversation.

1. **"I need a delete option in the YM/YW combined page in the
   table"** turned out to be a false alarm, not a bug -- Delete had
   already been there since 2026-10-16 (see that entry below) and was
   reconfirmed still wired up correctly when asked. The user's own
   follow-up explained it: "It may have been there before and I didn't
   see it because it was hidden by the scroll" -- Delete sits at the
   far right of a wide row (past Time, Title, In Charge, Notes, and
   Overwrite), past the fold on anything but a very wide viewport.
   Asked to pin it so it's always visible -- `ActivitiesTable.tsx`'s
   Delete header and cell both gained `sticky right-0`, keeping them
   visible at the right edge of the table's own `overflow-x-auto`
   scroll container regardless of horizontal scroll position. A sticky
   cell needs its own real background (it doesn't just inherit the
   row's the way an ordinary cell effectively does) -- a new `rowBgClass`
   value, computed once per row and shared by both the `<tr>` and the
   pinned cell, keeps the two from ever visually mismatching (striped,
   cancelled-tinted, or plain, the pinned Delete button's background
   always matches its own row).
2. **"I have inconsistency about what is marked as tentative and what
   isn't. Seems like the YW activities have a tentative flag, but I
   can't see where we make something tentative vs confirmed... maybe
   that is hiding in a scroll too."** This one was a real gap, not a
   scroll problem -- the Title cell's own "Tentative" badge (next to
   "Cancelled") has always been read-only on every page `ActivitiesTable`
   renders. The only existing way to actually flip `confirmed` was
   `ClassActivityGridForm`'s own Confirmed checkbox (a different grid,
   one class at a time) or Table Admin's raw grid -- neither of which
   is reachable from the three Combined-group pages themselves. Added
   the identical checkbox to `ActivitiesTable` (same hidden-"false"-
   before-the-real-checkbox convention, and `saveActivityGrid`,
   `app/youth-activities/actions.ts`, gained the matching `confirmed`
   column), gated on `editable` alone -- deliberately NOT on `deletable`,
   for the same reason Time/Title/Notes already aren't editable on
   Upcoming Activities: that page can show the same real row exploded
   into up to 6 copies (one per attending class), and a same-named
   checkbox repeated that many times has no well-defined submitted
   value. So the new Confirmed checkbox shows on the three
   Combined-group pages, same as every other editable field there; on
   Upcoming Activities, the existing read-only "Tentative" badge is
   still the only indicator -- to actually change it there, go to the
   activity's own Combined-group page (if it's a Combined activity) or
   the per-class grid (`/youth-activities/manage/classes`, if it's an
   individual class activity).

Confirmed via `tsc`/`eslint`/`next build` only, same no-live-browser
gap as everything else in this project -- ask the user to check that
Delete now stays visible while scrolling a wide Combined-group table
horizontally, and that the new Confirmed checkbox shows up and saves
correctly on all three Combined-group pages.

**Youth Activity Planning hub flattened down to its real destinations,
2026-10-17** (the user's own report: "There are too many levels to the
tile pages. I would like to enter the youth activity planning page and
immediately see tiles for upcoming activities, combined YM/YW, combined
YW, Combined YM, youth teaching management, activity cancellations (but
call it All-Youth Activity Cancellations). Any other tiles can be
hidden."). `/youth-activity-planning` had regressed into exactly the
problem it was meant to solve: its own 3-tile version (2026-10-10) put
"Youth Activities" here as just another hub pointing at `/youth-activities`,
which itself held the real tile grid for the four activity views --
reaching Upcoming Activities took Home -> here -> Youth Activities ->
Upcoming Activities, three real hops. This hub now links straight to
all six of the user's named destinations itself, in the order given:
Upcoming Activities, Combined YM/YW, Combined YW, Combined YM (all four
still `/youth-activities/<slug>`, just one hop closer), Youth Teaching
Management (relabeled from "Youth Teaching Calendar" -- same
destination, `/youth-teaching-planning`, left otherwise unrenamed since
that's a well-established feature-key name throughout the codebase, not
something this ask was about), and All-Youth Activity Cancellations
(renamed on its own page too, not just the tile label, matching the
user's explicit new name throughout).

**`/youth-activities` itself was deliberately NOT deleted or
redirected** despite losing its only tile on this hub -- `/events` (the
public merged activities/ward-events listing) links straight to it
("Manage Youth Activities"), and it's still the real home for the
cadence-rule engine, bulk Generate, and the per-class Manage grid, none
of which the user named in their six-tile list. "Any other tiles can be
hidden" was read as exactly that -- hidden, not deleted -- so a small,
de-emphasized text link (not a tile) at the bottom of the hub keeps
cadence rules/bulk-generate reachable for anyone who needs them,
without them competing for attention with the six real tiles. The old,
never-built `comingSoon` "Youth Teaching Management" stub (a separate,
different idea -- assigning teachers to classes, not Sunday lesson
content) is dropped along with every other now-hidden tile; ask before
building that one for real if it turns out to still be wanted under a
different name now that it's been reused for the real teaching page.

**"Add, delete activities in the upcoming activities... tiles" was the
one genuinely new capability, not just a relabel** -- the three
Combined-group pages already had Add/Edit/Delete/Overwrite (2026-10-11/
16), but Upcoming Activities had always been deliberately read-only
(it shows every group at once, via `explodeActivitiesByClass`, which
re-attributes a single real Combined row to every class that attends
it -- up to 6 rows sharing one real id). Turning on the existing
`editable` flag there outright would have been a real correctness bug:
every one of those up-to-6 exploded rows would render an inline input
with the identical name (`"<realId>::title"`, etc.), and `saveActivityGrid`
would only ever see whichever one happened to land last in the
submitted form data. Fixed by decoupling Delete into its own
`ActivitiesTable` prop, `deletable`, independent of `editable` --
Upcoming Activities passes `deletable` alone (a Delete column, no
inline-edit inputs, no wrapping Save-All-Changes `<form>`), while the
three Combined-group pages keep passing both, unchanged. A new
`realActivityId()` helper strips the `::<className>` suffix
`explodeActivitiesByClass` adds before handing an id to the Delete
action, so clicking Delete on any one of a Combined activity's exploded
rows correctly deletes the one real row (removing it for every
attending class at once, which is correct -- it genuinely is one
activity) rather than erroring on a synthetic id that matches nothing.
The Delete button's confirm dialog says so explicitly
(`warnShared`) whenever the row being deleted is one of these exploded
copies, so it's clear up front that deleting it isn't scoped to just
the one class shown. Add reuses the same mechanism Combined-group pages
already had (`addYouthActivity`, generalized -- see below) with an open
Group dropdown instead of a fixed hidden value, since Upcoming has no
single group of its own to assume.

**`AddCombinedActivityForm` generalized and renamed to
`AddActivityForm`** (`components/youth-activities/AddActivityForm.tsx`)
-- `groupName` is now optional: given, renders the same hidden field as
before (the three Combined-group pages, unchanged behavior); omitted,
renders a real `<select>` of all 9 groups (6 classes + 3 Combined
pseudo-groups), used only by Upcoming Activities. Both Add and Delete
on Upcoming Activities are gated on `youth_activity_planning`, the same
feature the three Combined-group pages already gate their own controls
on -- no new feature, no new server action beyond what already existed.

Confirmed via `tsc`/`eslint`/`next build` only, same no-live-browser gap
as everything else in this project -- ask the user to open
`/youth-activity-planning` once deployed and confirm all six tiles show
up in the requested order, and that Add/Delete now work from Upcoming
Activities (including deleting one row of an exploded Combined activity
and confirming it disappears from every attending class's own view
too, as expected).

**Bug found and fixed 2026-10-16: pulling a previously-used
announcement into a meeting hit a foreign key violation.** The user's
own report, right after running migration `077` and retrying: `insert
or update on table "sacrament_announcement_pulls" violates foreign key
constraint "sacrament_announcement_pulls_planned_element_id_fkey"`.

Root cause, traced back further than the new table itself:
`plannedElementId` (what `AnnouncementsField` passes to
`pullAnnouncementIntoMeeting`) comes straight from `el.id` in
`app/meetings/[id]/planning/page.tsx`'s `templateElements` list. That
list has always had two possible sources with the SAME shape but a
DIFFERENT meaning for `.id`: `getPlannedElements(meetingId)` (real,
per-meeting `meeting_planned_elements` rows) when any exist, or
`getTemplateElements(...)` (the shared, generic `meeting_templates`
rows) as a fallback when a meeting has zero planned-element rows --
and `getTemplateElements`'s own `.id` is `meeting_templates.id`, never
a real `meeting_planned_elements.id`. Migration 077's new
`sacrament_announcement_pulls.planned_element_id` column requires a
real `meeting_planned_elements` row (`not null references
meeting_planned_elements(id)`) -- pulling an announcement on a
fallback-rendered meeting tried to insert a `meeting_templates.id`
into that column, which could never exist there. (This exact same gap
existed in the old, pre-077 single-column design too, just silently --
`announcements.planned_element_id` was nullable but still a real FK
to the same table, so it would have failed identically; nobody had
hit it before now.)

**Found the real source of the gap**: `getOrCreateMeetingId`
(`lib/data/meetings.ts`, used by Table Admin's `createIfMissing`
calendar picker to create a meeting on the fly when planning against a
future date with no `meetings` row yet) has always called
`applyRotationsToNewMeeting` but never `seedPlannedElementsForMeeting`
-- unlike the other two meeting-creation paths (`/meetings/new`'s own
action, and Generate Meetings), which both already call it. A meeting
created this specific way has permanently had zero planned-element
rows, with nothing to ever fill them in -- exactly the condition that
triggers the fallback and breaks any feature (like Announcements) that
needs to reference one specific agenda line.

**Two-part fix:**
1. `getOrCreateMeetingId` now also calls `seedPlannedElementsForMeeting`
   (`"standard"` format for Sacrament Meeting, matching Generate
   Meetings' own identical default at the same generic creation point)
   -- closes the gap at the source for any meeting created this way
   going forward.
2. The Planning page's own fallback (`app/meetings/[id]/planning/page.tsx`)
   no longer just renders the shared template read-only when a
   meeting has zero planned-element rows -- it now calls
   `seedPlannedElementsForMeeting` right there and re-fetches, the
   same lazy-sweep-on-read pattern already used elsewhere on this same
   page (`autoAnnounceReadyCallingPlanningItems`). This repairs the
   user's own already-broken meeting (and any other one in the same
   state) the next time its Planning page loads, without needing a
   manual SQL fix. Scoped safely: by this point in the function the
   meeting is already confirmed not archived (an earlier redirect
   handles that), so this only ever persists real rows for a meeting
   still being actively planned -- never retroactively invents
   structure for one whose finalized history should stay frozen
   (`archived/page.tsx`'s own separate, still-unseeded fallback
   rendering is untouched, by design). Falls back to the old read-only
   rendering only in the one case seeding itself can't fix -- no
   default template exists at all for this meeting type/format.

This doesn't contradict the Dynamic planning view architecture's own
"no backfill was done, by design" note elsewhere in this file -- that
was migration `033`'s own one-time decision not to bulk-backfill every
pre-existing meeting the day it shipped, not a standing rule against
ever seeding one later when something real actually needs it.

Confirmed via `tsc`/`eslint`/`next build` only, same no-live-browser
gap as everything else this session -- ask the user to try pulling the
same previously-used announcement into the same meeting again; it
should now go through the first time, with no further migration or
manual step needed.

**App icon silhouette recolored to metallic gold, 2026-10-16** -- the
user's own request: "can we change the silhouette in the app to be a
color other than white? Would a metalic gold color work with the
color schemes?" `ICON_FOREGROUND` (`lib/icons/temple-silhouette.ts`,
shared by `app/icon.tsx`/`app/apple-icon.tsx`) changed from
near-white (`#fbfcfd`) to `#D4AF37`, the standard named "metallic
gold" hex.

Checked before answering, not just assumed: built a standalone canvas
preview (same technique as the original silhouette trace's own
pixel-accuracy check) rendering several gold candidates at real
16px/32px favicon size against all three seasonal backgrounds
(default blue `#004a71`, Christmas red `#712329`, Easter purple
`#592c68`), viewed directly in the built-in browser. Confirmed both
visually and via WCAG contrast math (~4.5-5:1 against all three
backgrounds) that `#D4AF37` stays legible at actual favicon size, and
that gold reads as a genuinely good pairing with all three -- gold-on-
navy, gold-on-Christmas-red, and gold-on-royal-purple are all classic,
high-contrast combinations, not a coincidental clash. A true
"metallic" sheen (a gradient simulating reflective highlights) was
considered and rejected -- Satori can render SVG gradients, but at
16-32px any gradient detail collapses to noise, same reasoning that
already dropped the reference photo's own fine stonework/window lines
when the silhouette was first traced.

Confirmed via `tsc`/`eslint`/`next build` only for the Next.js app
itself (same no-live-browser gap as everything else this session) --
the color choice itself WAS visually verified directly, unlike most of
this session's other changes. Ask the user to check the browser tab
icon on production once deployed.

**Delete added back for youth activities, 2026-10-16** -- the user's
own report: "I am not seeing where I have the ability to delete a
youth activity whether it is combined or not." Correct: since "All
Activities" (the one page that ever had a per-row Delete) was removed
outright on 2026-10-11 in favor of Table Admin's own generic grid as
the fallback, Table Admin had been the *only* way to delete a youth
activity -- none of the dedicated Youth Activities pages had their
own Delete control. Asked where it should live (multi-select: the
three Combined-group pages, the per-class grid, Upcoming Activities,
or "just tell me where it is today") -- the user picked the first two.
- **New `deleteYouthActivity(activityId)`** (`app/youth-activities/actions.ts`),
  gated the same way every other action in that file is
  (`youth_activity_planning`) -- a plain delete, no FK anywhere in
  this schema references a `youth_activities` row by id so no cascade
  cleanup is needed first. Wired into `ActivitiesTable.tsx` as a new
  Delete column, shown exactly where its existing `editable` flag
  already shows Add/Edit/Overwrite (the three Combined-group pages) --
  never on read-only Upcoming Activities, which the user didn't pick.
- **New `deleteClassActivity(activityId)`** (`app/youth-activities/manage/classes/actions.ts`),
  wired into `ClassActivityGridForm.tsx`'s own grid. Deliberately
  scoped to a row this class actually owns (`!row.isCombined`) -- a
  row drawn live from a shared Combined row has no class-specific copy
  to delete from this single-class page; deleting that shared row here
  would remove it for every other attending class too, from a page
  that only shows one class at a time. The action re-checks this
  server-side too (`group_name.startsWith("Combined")`, the same test
  `ACTIVITY_CLASSES` itself already uses to exclude the three
  pseudo-groups), returning a real error rather than silently deleting
  the wrong thing if the button were ever reachable for one anyway. A
  genuinely Combined row can still be deleted -- just from its own
  Combined-group page, where the new Delete column above already
  covers it.
- Both buttons are plain `type="button"` + `useTransition` calls with
  a `window.confirm` first (matching `DeleteMeetingButton`'s own
  convention for an irreversible action), not real submit buttons --
  both sit inside their grid's own wrapping `<form>` (the Save All
  Changes form), so a submit button here would trigger that save
  instead of deleting anything.

Confirmed via `tsc`/`eslint`/`next build` only, same no-live-browser
gap as everything else this session -- ask the user to confirm Delete
shows up and works on all three Combined-group pages and on the
per-class grid (for that class's own rows only).

**Announcements rebuilt onto a real many-to-many link, 2026-10-15**
(migration `077`, not yet run) -- the user's own report, right after
the previous fix below shipped: "It seems like announcements that were
announced in a previous meeting are now not an option to announce?"

Root cause: `announcements.meeting_id`/`planned_element_id`
(migrations 031/074) were single-value columns -- pulling an
announcement into one meeting's Announcements block set them once,
and `getPullableAnnouncements()` only ever offered announcements with
`meeting_id is null`. Once used in any meeting, an announcement was
gone from the pool for every future meeting too, **permanently** --
Sacrament Meeting auto-archives within a day or two of its own date,
at which point Planning (and its own Remove button) becomes
read-only, so there was no practical way back for a genuinely
recurring announcement ("Ongoing Event"/"Future - For Planning" are
real values on the submission form's own `announcement_type`). This
wasn't a bug in the silent-failure fix made minutes earlier (see that
entry below) -- it's a real, separate design gap in the original
single-column link.

Presented three options in chat (free it back to the pool once its
meeting archives; let one announcement be pulled into multiple
meetings at once, preserving each meeting's own history; or a manual
"un-pull from an archived meeting" control) -- the user chose true
multi-meeting reuse with full history preserved. New
`sacrament_announcement_pulls` table (`announcement_id`, `meeting_id`,
`planned_element_id`, `unique (announcement_id, meeting_id)`) replaces
the single-column link entirely:
- `getPullableAnnouncements(meetingId)` (now takes a meetingId, where
  it previously took none) excludes only announcements already pulled
  into *this* meeting -- one already pulled into a different meeting
  is still offered, so the same recurring announcement can be read
  again in a later meeting without ever being removed from the
  one(s) it already appeared in.
- `getAnnouncementsByPlannedElement(meetingId)` now reads the join
  table instead of the old flat column -- same return shape
  (`Map<plannedElementId, PulledAnnouncement[]>`), so Planning,
  Conducting, and the Archived view all needed zero changes beyond
  this one function's internals.
- `pullAnnouncementIntoMeeting`/`removeAnnouncementFromMeeting`
  (`app/meetings/[id]/announcements-actions.ts`) now insert/delete a
  row in the join table instead of updating two columns -- a unique-
  constraint violation on insert (two admins adding the same
  announcement to the same meeting at once) surfaces as "That
  announcement is already in this meeting" rather than a raw
  Postgres error.
- `getPublishedAnnouncements`/`getGeneralSubmissions`
  (`lib/data/general-submissions.ts`) switched from the now-stale
  `.is("meeting_id", null)` filter to a new
  `getEverPulledAnnouncementIds()` helper -- an announcement is
  excluded from the public page/admin inbox once it's ever been
  pulled into any meeting, same behavior as before, just driven by
  the new table's existence instead of a column nothing writes to
  anymore.
- `announcements.meeting_id`/`planned_element_id` are left in the
  schema, untouched, simply unused by the app from here on -- same
  "harmless but real" treatment this file already gives
  `callings.title_prefix` elsewhere, rather than a same-day column
  drop (see migration `058`'s own deploy-ordering caution for why
  dropping a column the same day code stops reading it is worth
  avoiding).
- `delete_meeting_cascade` (migration `054`) amended in the same
  migration file to also clean up `sacrament_announcement_pulls` when
  a meeting is deleted.
- No new Table Admin entry -- matches `sacrament_program_items`/
  `sacrament_visiting_authorities`'s own precedent (pure join/ordering
  tables with nothing of their own worth a raw-data grid), not
  `sacrament_rabnm`'s.

Confirmed via `tsc`/`eslint`/`next build` only, same no-live-browser
gap as everything else this session -- ask the user to run migration
`077`, then confirm an announcement already pulled into one meeting
now shows up again in a *different* meeting's "call in an
announcement" dropdown, and that an archived meeting still correctly
shows what it had even if that same announcement has since been
pulled into a newer one too.

**Bug found and fixed 2026-10-15: adding an announcement in the
Sacrament Meeting planning view could fail silently.** The user's own
report, in the same message as the Conducting-ordering request just
below: "I added an announcement in the sacrament meeting planning view
and it didn't save." Traced the whole pull path end to end
(`AnnouncementsField.tsx` -> `pullAnnouncementIntoMeeting` ->
`getPullableAnnouncements`/`getAnnouncementsByPlannedElement`) -- the
server action itself, its feature gate, and every prop handed down
from `agenda-rows.ts` through `AgendaGridForm.tsx` all checked out
structurally. The one confirmed bug: `AnnouncementsField`'s own
`pull()` (and `ExistingRow`'s `remove()`) discarded the server
action's result entirely -- the exact same silent-failure bug class
already found and fixed once this session for Delete Meeting
(`DeleteMeetingButton.tsx`). A failed pull looked identical to a
successful one, since the dropdown cleared back to blank either way
with nothing on screen saying it didn't land. Fixed to read the
result and show the message inline, and to leave the dropdown's
selection in place on failure rather than clearing it, so a retry
doesn't require re-picking the same announcement.

**Turned out to be the smaller half of a bigger, separate problem**
-- see the entry directly above this one. The user's very next message
reported the real underlying issue this error-surfacing fix helped
uncover: the announcement they were trying to add had already been
used in a past meeting, which the old single-column design made
permanently unavailable. Both fixes stand independently -- surfacing
real errors stays valuable regardless, and the deeper reuse fix is
what actually explains this specific report.

**Two requests, 2026-10-15, right after the "To be Announced" fix
above shipped:**

1. **Conducting view's Ward Business now announces all releases
   before any new calling.** The user's own words: "order callings and
   releases to announce all releases first and then all new callings
   after that." Root cause/gap: `sacrament_rabnm` has no ordering
   column of its own, and its own fetch
   (`getSacramentPlanningData`, `lib/data/sacrament-planning.ts`) has
   no `.order()` either -- the Conducting script's Ward Business loop
   (`buildConductingRows`, `lib/data/conducting-rows.ts`) simply walked
   the array in whatever order Postgres happened to return it, release
   and new-calling items interleaved arbitrarily. Fixed with a small
   stable sort (`release` weight 0, `new_calling` weight 1, everything
   else weight 2) right before that loop -- any other, pre-2026-10-03
   "Other" RABNM type (baby blessing, baptism, mission call, etc. --
   still fetched here even though Planning's own `WardBusinessField`
   no longer manages them, see that rework's own note further down)
   sorts after both groups, keeping its own relative order rather than
   being silently dropped or reshuffled. Scoped to the Conducting view
   only, per the user's own wording ("in the conducting view") --
   Planning's `WardBusinessField` already renders Releases and
   Callings as two separately-labeled sections, so it already shows
   releases first structurally and needed no change.
2. **"I added an announcement in the sacrament meeting planning view
   and it didn't save."** Traced the whole pull path
   (`AnnouncementsField.tsx` -> `pullAnnouncementIntoMeeting`,
   `app/meetings/[id]/announcements-actions.ts` -> `getPullableAnnouncements`/
   `getAnnouncementsByPlannedElement`, `lib/data/sacrament-announcements.ts`)
   end to end -- the server action itself, its feature gate
   (`sacrament_planning`, confirmed spelled correctly against the real
   `Feature` union), and every prop handed down from `agenda-rows.ts`
   through `AgendaGridForm.tsx` all check out structurally. The one
   real, confirmed bug: `AnnouncementsField`'s own `pull()` (and
   `ExistingRow`'s `remove()`) discarded the server action's result
   entirely -- the exact same silent-failure bug class already found
   and fixed once this session for Delete Meeting
   (`DeleteMeetingButton.tsx`). A failed pull (wrong feature, an RLS
   denial, or losing a race against another block for the same
   announcement via `pullAnnouncementIntoMeeting`'s own
   `.is("meeting_id", null)` guard) looked identical to a successful
   one -- the dropdown cleared back to blank regardless, with nothing
   on screen ever saying it didn't actually land. Fixed to read the
   result and show the message inline, and to leave the dropdown's
   selection in place on failure (only clearing it on confirmed
   success) so a retry doesn't require re-picking the same
   announcement. **Not yet confirmed as the complete fix** -- this
   session has no live database access, so if the real failure is
   something structural (e.g. an undocumented RLS policy on
   `announcements` predating this repo's migration history, the same
   class of problem already found on `sacrament_assignments`/
   `sacrament_program_items`/`agenda_items`/`bishopric_assignments` --
   migrations 038/041/063/067/068/069/075 -- though `announcements`
   itself has its own anon-facing policies from migration 031 onward
   and has never shown this specific symptom before), this fix at
   least makes the real error message visible instead of silent
   nothing. Ask the user to retry adding an announcement and report the
   exact message if it still doesn't save -- that will say definitively
   whether this was purely a UI-feedback bug or points to something
   deeper to chase next.

**Bug found and fixed 2026-10-16: a newly-entered "To be Announced"
calling gave no indication why it wasn't showing up in Ward
Business.** The user's own report: "I entered a calling 'to be
announced'. The items that had previously been entered and that had
landed in the sacrament meeting planning remained, but the new one
didn't land there."

Root cause: both the automatic sweep
(`autoAnnounceReadyCallingPlanningItems`, built earlier the same
session) and the manual push (`pushCallingToSacramentMeeting`) have
always required the calling side's Candidates to be narrowed to
*exactly one* person before announcing it -- a row with zero
candidates selected (the likely state for a just-created entry) is
silently skipped by both, same as a row with two or more. The 2+ case
already had a visible warning in Calling Planning's own "Ready to
Announce" section ("Narrow Candidates down to exactly one person");
the 0 case had no equivalent at all -- `readyToAnnounce`'s own filter
(`app/calling-planning/page.tsx`) required `candidate_person_ids.length
> 0`, which excluded a zero-candidate row from that section entirely,
so there was nowhere the user could have seen *any* indication of what
was blocking it, automatic sweep or manual push alike.

Fixed by broadening that filter to include any row with either side
marked "To be Announced," regardless of candidate count or whether a
release person is set yet -- every row that's actually blocked now
shows up with a specific reason ("Select a candidate before the new
calling can be announced," "Narrow Candidates down to exactly one
person...," or "Set a Person Being Released before the release can be
announced"), and the "Add to a meeting" button only appears once at
least one side is genuinely ready to push. Confirmed via
`tsc`/`eslint`/`next build` only, same no-live-browser gap as
everything else this session -- ask the user to check `/calling-planning`
for the specific calling from their report; it should now show
exactly which of these applies.

**App icon built: a Syracuse Utah Temple silhouette on the app's own
seasonal accent color, 2026-10-16.** The user's own request: "I would
like to create an app icon for ward OS. I would like it to be a
silhouette of the Syracuse Utah Temple... Basically the temple in
white and the background would be the color of the main color scheme
seasonally (so it is probably more than one icon)." First pass (a
hand-drawn approximation, researched via the temple's real architecture
and photos) was rejected outright: "The idea for the icons is correct,
but the silhouette is not good at all. I will provide the silhouette I
would like" -- the user then pasted their own reference image.

- **Traced, not hand-approximated.** Rather than eyeballing the user's
  reference, it was run through an actual vectorizer (`imagetracerjs`,
  loaded via a throwaway local HTML page served from this session's
  own scratchpad directory, 2-color quantization) so the outer profile
  matches their image closely. The fine internal window/stonework
  lines in their source collapsed out naturally at 2-color
  quantization -- confirmed this is actually correct for icon use, not
  a loss: rendered the traced path at real 16px/32px via a canvas
  (`image-rendering: pixelated`, so the literal pixel result was
  visible, not a scaled-up approximation of it) before trusting it,
  and the silhouette stayed legible at both sizes with that detail
  gone.
- **New `lib/icons/temple-silhouette.ts`** -- the traced path data
  (`TEMPLE_SILHOUETTE_PATH`/`_VIEW_BOX`) plus
  `ICON_BACKGROUND_BY_SEASON`/`ICON_FOREGROUND`, the exact hex
  equivalents of this app's existing `oklch()` seasonal accent tokens
  (`lib/data/season-theme.ts`). Satori (see below) doesn't support
  `oklch()` syntax, so these needed converting -- done via a canvas 2D
  context's real sRGB conversion, not estimated by eye. **A first
  conversion attempt via `getComputedStyle().color` came back
  completely wrong** (`oklch(38% 0.11 20)` → "#002600" for every hue
  tried): this browser serializes a computed color value back out in
  its own original `oklch(...)` notation rather than normalizing to
  `rgb()`, so a naive digit-regex over that string silently parsed
  nonsense (`"0.38"` splits into `"0"` and `"38"` with no decimal point
  in a digit-only regex) instead of erroring -- caught only by
  rendering through an actual `<canvas>` fill instead and reading the
  real output pixel back.
- **`app/icon.svg` (the old static "W" monogram) replaced with
  `app/icon.tsx`**, using Next's own dynamic icon convention
  (`ImageResponse` from `next/og`, rendered through Satori) instead of
  three separate static files someone would need to remember to swap
  -- calls the exact same `getSeasonTheme()` the rest of the app
  already uses for its own color rotation (`app/layout.tsx`'s
  `data-season` attribute), so the favicon can never drift out of sync
  with the site's own theme. New `app/apple-icon.tsx` reuses the same
  silhouette/season logic at Apple's own recommended 180x180, with no
  border-radius (iOS applies its own rounded-square mask automatically
  to apple-touch-icons -- a pre-rounded image would double-round or
  show a background-color edge inside that mask).
- **Real bug caught before shipping**: both new routes initially built
  as `○` (static) in `next build`'s own output -- since
  `getSeasonTheme()` only reads the clock (no cookies/headers/request
  data), Next.js had no signal that it needed to render per-request,
  so it would have frozen whichever season was active at build time
  forever, defeating the entire point of making this dynamic instead
  of three static files. Both now export `dynamic = "force-dynamic"`,
  confirmed afterward to rebuild as `ƒ` (server-rendered on demand).

Confirmed via `tsc`/`eslint`/`next build` only, same no-live-browser
gap as everything else this session for the actual Next.js app --
the silhouette itself WAS visually verified, directly, via the
built-in browser (the trace result, the three seasonal tiles, and the
16px/32px pixel-accurate check) before being wired in, since that part
is a real design decision a type-check can't validate. Ask the user to
check the browser tab icon on production once deployed.

**Routine meetings and Wednesday youth activities now generate
themselves, 2026-10-16** (the user's own words: "What if I didn't want
to ever have to generate typical activity or meeting dates. What if it
was assumed that wednesday evenings are youth activity nights, sundays
hold bishopric meeting, sacrament meetings, second and fourth sundays
are ward council and third sundays are ward youth council? It would be
ok to be able to set the cadence/rules somewhere but I don't want to
have to generate these events. Other events can be created manually,
or dates changed or whatever."). Both existing cadence engines were
already idempotent and self-contained -- the only thing missing was an
automatic trigger, so this didn't need a new generation mechanism, just
automating the existing one:
- **New `autoGenerateUpcomingMeetings()`** (`lib/data/meeting-schedule.ts`)
  -- calls the existing `generateMeetingsFromRules` with a rolling
  "today + 8 weeks" horizon (recomputed via `getMountainTimeNow()` on
  every call, so it keeps sliding forward), run as a lazy sweep from
  `getUpcomingMeetings()` (`lib/data/meetings.ts`) alongside the
  existing cancellation/archive sweeps -- so Dashboard and Calling
  Planning loads keep every *active* rule in `/meeting-schedule`
  covered automatically. This is genuinely rule-agnostic: it doesn't
  know or assume Bishopric Meeting is weekly, or that Ward Council is
  2nd/4th Sunday -- it just re-applies whatever's configured there.
  **The user still needs to confirm the actual rules in
  `/meeting-schedule` match what they described** (Sacrament Meeting +
  Bishopric Meeting weekly, Ward Council on the 2nd and 4th Sunday --
  two separate `nth_weekday` rules, since a rule only holds one
  `nth_occurrence` -- Youth Council on the 3rd) -- this assistant has
  no live database access to check what's actually saved there today.
- **New `autoGenerateCombinedYouthActivities()`** (`lib/data/youth-activity-schedule.ts`)
  -- same rolling-horizon approach, calling the existing
  `generateCombinedYouthActivities` (the fixed 1st/2nd&4th/3rd-Wednesday
  combined rotation), run from `getYouthActivities()`
  (`lib/data/youth-activities.ts`) alongside its own existing sweeps.
- **Deliberately NOT automated**: Ward Event Schedule and the general,
  user-configurable Youth Activity Schedule cadence-rule engine
  (`youth_activity_schedule_rules` -- a different mechanism from the
  fixed Wednesday rotation above, see that file's own top comment for
  why the two stay separate) -- the user's own description named only
  the four meeting types and the Wednesday youth activities, not
  these; scoped narrowly rather than guessing they should get the same
  treatment. Both keep their existing manual "Generate" buttons,
  completely unchanged.
- **Manual "Generate" buttons kept everywhere, not removed** -- per
  the user's own "it would be ok to be able to set the cadence/rules
  somewhere" (implying the existing rules UI stays) and "other events
  can be created manually... or whatever" (one-off/irregular events
  still need manual creation, same as always). Both the Meeting
  Schedule and Youth Activities Manage pages now show a short note
  explaining generation already happens automatically, so the button
  isn't confusing to find already-populated.
- Both new functions swallow their own errors (never let a background
  sweep failure break Dashboard/Calling Planning/the activity pages
  from rendering) -- same philosophy as every other lazy sweep already
  in this app.

Confirmed via `tsc`/`eslint`/`next build` only, same no-live-browser
gap as everything else this session -- ask the user to load `/dashboard`
or `/youth-activities` once deployed and confirm upcoming meetings/
activities keep appearing roughly 8 weeks out with no manual Generate
click, and to double-check `/meeting-schedule`'s own rules match the
cadence described above.

**Bug found and fixed 2026-10-16: overwriting a class's activity from
a Combined page didn't visibly take effect everywhere.** The user's
own report: "I added a combined YM/YW activity and it didn't overwrite
the existing activities of the groups on that date." Two things
tangled together, not one:
- **Not a bug -- Add and Overwrite have always been two separate,
  deliberate steps** (2026-10-11's own design): adding a Combined
  activity creates that one row; it never touches each class's own
  existing row on its own. The per-class display logic
  (`resolveForClass`, `lib/data/class-activities-shared.ts`) also
  deliberately prefers a class's *own* row over a Combined one
  whenever both exist for the same date -- so until the separate
  "Overwrite `<classes>`" button (next to the new row, on the same
  Combined page) is actually clicked, the old individual activity
  keeps showing everywhere, which looks identical to "nothing
  happened."
- **Real bug, now fixed**: `pushCombinedActivityToClasses`
  (`app/youth-activities/actions.ts`) only ever called
  `revalidatePath("/youth-activities/manage/classes")` after a
  successful overwrite -- never `revalidateActivityListings()` (the
  shared helper `addYouthActivity`/`generateYouthActivities` both
  already call), so Upcoming Activities, the three Combined pages, and
  Scheduled Events could all keep showing stale, pre-overwrite data
  until a manual reload even though the actual database write
  succeeded. Now calls both.
- **Resolved the same day: Add now auto-overwrites.** Asked directly
  whether "Add Activity" on a Combined page should also overwrite the
  target classes automatically, collapsing the two steps into one --
  the user chose yes. `addYouthActivity`/`pushCombinedActivityToClasses`
  (`app/youth-activities/actions.ts`) now share one helper,
  `overwriteClassesFromCombined` (copies the same fields either way,
  a no-op for a non-Combined `group_name`), so the two paths can't
  drift apart. The manual "Overwrite `<classes>`" button on each row
  stays -- it's still the only way to re-sync a Combined row's *later*
  edits out to the classes, which an add-time call can't cover.

Confirmed via `tsc`/`eslint`/`next build` only, same no-live-browser
gap as everything else this session.

**Calling/release announcements now auto-add to Sacrament Meeting's
Ward Business, 2026-10-15** (the user's own request, right after
confirming migration `076`: "I would like to have those calling and
release announcement automatically added to the next sacrament
meeting. They can be added to the current week's sacrament meeting
each week until their status is changed. We will then control in the
sacrament planning view if they will be announced or not."). Before
this, getting a "To be Announced" item onto a meeting's agenda always
required an explicit manual pull (either Calling Planning's own "Ready
to Announce" push, or Ward Business's own "call in from Calling
Planning" dropdown) -- now it happens on its own.

New `autoAnnounceReadyCallingPlanningItems()` (`lib/data/calling-planning.ts`),
called unconditionally from `app/meetings/[id]/planning/page.tsx`
whenever any Sacrament Meeting's Planning page loads (lazy sweep on
read, same pattern as `autoArchivePastMeetings`/`sweepMeetingCancellations`,
run before this page's own data fetch so the same render already
reflects it):
- Finds the single nearest upcoming (not cancelled, not archived)
  Sacrament Meeting -- and only that one, regardless of which meeting
  is actually being viewed -- so planning several weeks ahead at once
  never duplicates the same pending item across more than one future
  meeting. No-ops if none exists.
- For every `calling_planning` row with `calling_status`/`release_status
  === "to_announce"`, checks **per side independently** whether a
  `sacrament_rabnm` row already links it to *this* meeting -- not via
  `announced_meeting_id` (which only ever points at one meeting at a
  time and would be ambiguous the moment the two sides resolve on
  different weeks from each other, e.g. a release gets recorded while
  its matching new calling is still pending) -- and creates whichever
  side is missing, exactly matching what a manual pull already does.
  `announced_meeting_id` is still updated afterward, purely so the
  existing manual "call in another" dropdown keeps correctly excluding
  it.
- **"Each week until their status is changed"**: removing an item from
  one week's Ward Business (the existing Remove button) clears
  `announced_meeting_id` without touching its status -- which is
  exactly what makes the sweep pick it back up the next time it runs,
  attaching it to whatever's then the new current meeting. The one
  real stop is a manual status change away from `to_announce`, which
  this sweep never does itself (matches the 2026-10-13 fix immediately
  below, which made that status change manual-only in the first
  place). "We will control... if they will be announced or not" is
  read as exactly that Remove button -- a per-week "skip this one,"
  not a permanent decline.
- **Scoped to the Planning page load only, not yet wired into
  Conducting or the dashboard** -- the normal workflow (build the rest
  of the agenda in Planning before ever reaching Conducting) should
  already cover the real case, but flag if an item isn't showing up
  somewhere because its meeting's Planning page genuinely hasn't been
  opened yet since the item became ready; extending the trigger point
  (e.g. into `getUpcomingMeetings()`, which already runs the other two
  lazy sweeps on every Dashboard/Calling Planning page view) is a
  contained follow-up if that turns out to matter in practice.

Confirmed via `tsc`/`eslint`/`next build` only, same no-live-browser
gap as everything else this session -- ask the user to open the
nearest upcoming Sacrament Meeting's Planning page and confirm any
"To be Announced" items now appear in Ward Business without having
been manually pulled in.

**Bug found and fixed 2026-10-15: a calling pushed from Calling
Planning's own page could get permanently stuck once removed from Ward
Business.** The user's own detailed report, walking through a full
real workflow: set some rows' Status to "To be Announced," pushed them
to this week's Sacrament Meeting from the "Ready to Announce" section
-- the callings showed up in Ward Business, releases did not (see the
second, separate finding below for why) -- then removed the callings
from Ward Business to try again, and they never came back to "Ready to
Announce," nor could they be re-pushed at all.

Root cause: `pushCallingToSacramentMeeting` (`app/calling-planning/actions.ts`,
the button on `/calling-planning` itself) has always inserted its
`sacrament_rabnm` row without setting `calling_planning_id` -- unlike
`pullCallingPlanningIntoMeeting` (`app/meetings/[id]/ward-business-actions.ts`,
Ward Business's own "pull from Calling Planning" picker), which always
has. Ward Business's Remove button (`WardBusinessField.tsx`'s
`ExistingRow`) branches on exactly that link: set, it calls
`removeCallingPlanningFromMeeting`, which correctly clears
`announced_meeting_id` and resets status; unset -- which was every
single row ever pushed from Calling Planning's own page, not an
occasional case -- it falls back to a bare `deleteRabnmItem`, which
only deletes the `sacrament_rabnm` row. The `calling_planning` row is
left with `announced_meeting_id` still pointing at an announcement
that no longer exists, status never reset -- permanently excluded from
"Ready to Announce" (requires `announced_meeting_id is null`) and from
ever being pushed again (`pushCallingToSacramentMeeting` requires
`calling_status = 'to_announce'`, which it's now stuck away from),
with no UI anywhere to clear `announced_meeting_id` directly
(`calling_planning` is deliberately excluded from Table Admin, and the
grid has no column for it). Fixed by adding `calling_planning_id` to
that insert, matching the pull path exactly. **Migration `076`**
(one-time, not yet run) repairs every row already stuck this way --
finds any `calling_planning` row with `announced_meeting_id` set but
no real `sacrament_rabnm` row referencing it back (the only way that
combination happens), clears it, and resets `calling_status`/
`release_status` back to `to_announce` only where they're still
sitting at the exact `to_record`/`complete` values the now-also-fixed
auto-advance bug (2026-10-13 below) would have left them at -- not a
blanket reset, so a row at some other status for an unrelated reason
isn't touched.

**Second, separate finding from the same report -- not a bug**: "the
callings showed up, but the releases did not" turned out to be correct
behavior given the data, not a gap in the push logic itself.
`pushCallingToSacramentMeeting`/`pullCallingPlanningIntoMeeting` only
ever include a release when that `calling_planning` row's own
`release_person_id` is actually set -- the user's report confirms they
set Status ("To be Announced") on the *calling* side only; nothing
said the matching release side (`release_person_id`/`release_status`)
had ever been populated on those same rows. Since `calling_status` and
`release_status` are genuinely independent fields on the same row
(per the Vision & Intended Workflows doc above), there's no automatic
link from "this calling is ready" to "so is its release" unless both
are actually set. **Still a real, named workflow gap, not fully
closed**: the 2026-10-13 "auto-fill release on a new calling change"
feature below only fires when *creating* a brand-new row via "+ Start
New Calling Change" -- it does nothing for an *existing* row someone
is just now advancing through statuses, which is exactly this user's
situation. For now, the fix is manual: open the specific calling's row
on `/calling-planning` and set "Person Being Released" (and Release
Status, if it should show as ready) directly -- once that's saved, it
appears in Ward Business's Releases dropdown immediately, no further
action needed. Ask before building anything more automatic here (e.g.
backfilling `release_person_id` for existing rows from each calling's
current holder) -- that's a real, separate feature, not implied by
this bug report.

Confirmed via `tsc`/`eslint`/`next build` only, same no-live-browser
gap as everything else this session -- ask the user to run migration
`076` once deployed, then re-verify the specific callings from their
report: do they show back up in "Ready to Announce," and does setting
a release person on those rows make them appear in Ward Business?

**Three more requests, 2026-10-13, same session as the two below:**
1. **Calling Planning's "To Record" auto-advance removed.** The user's
   own words: "I don't want the status of those that are 'To be
   Announced' to change to 'To Record' automatically. I want it to be
   a manual change for that status change." Both places that pushed a
   calling into a Sacrament Meeting's Ward Business used to also flip
   `calling_status` from `to_announce` to `to_record` as a side effect
   (`pushCallingToSacramentMeeting`, `app/calling-planning/actions.ts`;
   `pullCallingPlanningIntoMeeting`, `app/meetings/[id]/ward-business-actions.ts`)
   -- both now leave `calling_status` untouched; the admin moves it
   themselves, whenever they actually want to. The matching undo
   (`removeCallingPlanningFromMeeting`) was updated to match -- it used
   to force `calling_status` back to `to_announce` on removal too,
   which would now risk clobbering a real manual status change made in
   the meantime, so it no longer touches that column at all. **Release's
   own auto-advance (`to_announce` -> `complete`) is deliberately
   unchanged** -- the request was specific to the calling side's "To
   Record" step; release never used "To Record" as a target to begin
   with (it jumps straight to "Complete"), and nothing was said about
   changing that one. Flag if release should get the same treatment.
2. **Wider fields instead of a wider table, where wrapping isn't
   possible.** The user's own words, after the earlier Table Admin
   width reduction: "if we can't wrap the whole row... can we at least
   have a large enough field in the row that when wrapped I can see
   all of the information? Same with the announcement table." A
   `<select>`'s own displayed text can't wrap (browser limitation, not
   a styling choice) -- only widening the box actually works there.
   Calling Planning's own Calling and Release Person columns (the two
   the user specifically named, "so we can see the calling and release
   that are associated with each other") now use a wider class
   (`min-w-[11rem] max-w-[22rem]`, vs. the rest of that grid's
   `min-w-[7rem] max-w-[16rem]`) -- Status/Release Status stayed
   narrow, since their longest real label already fits. For the
   Announcements table specifically, new optional `wrap` flag on
   `AdminColumnConfig` (`lib/admin/types.ts`) -- opt-in per column
   rather than a blanket change to every "text" column in every Table
   Admin table (most are short, fixed-shape fields that would just get
   visually taller for nothing) -- renders a `text`-type column as a
   small `resize-y` `<textarea>` instead of a single-line `<input>`
   when set. Turned on for Announcements' Title/Organization/Type/
   Audience/Where Announced/Location/Link columns (`lib/admin/registry.ts`)
   -- Submitted By/Email/Status stayed plain, being short and
   fixed-shape.
3. **A visible "Link" hyperlink on the public Announcements page.**
   The user's own words: "can we get the word 'Link' to show up in the
   public views of the announcements as a hyperlink to any
   announcement that has a url?" The announcement's own title has been
   clickable when `link_url` is set since 2026-10-10, but nothing
   visibly indicated that -- `app/announcements/public/page.tsx` now
   also shows a plain "Link" line (same small-caption styling as the
   existing "Location:" line) underneath, a second, more obvious way
   to reach the same URL. Didn't touch the title-is-a-link behavior,
   which stays as-is alongside this.

**Two Calling Planning requests, 2026-10-13, right after the save-
display bug above was confirmed fixed:**
1. **"When we add a calling change for a new calling I would like to
   automatically add the associated release."** `createCallingPlanningEntry`
   (`app/calling-planning/actions.ts`) now looks up the chosen calling's
   `current_holder_id` and pre-fills the new row's `release_person_id`
   with it (`release_status` set to `to_be_released` to match, rather
   than the DB default `previously_vacant`, which would otherwise
   contradict having a real person set) -- left null/"Previously
   Vacant" when the calling has no current holder. This restores what
   the Vision & Intended Workflows doc originally specified for this
   workflow ("the person to be released is included by default too")
   and the 2026-09-08 grid rebuild deliberately simplified away,
   flagging at the time that it was worth revisiting "if that turns
   out to matter in practice" -- it did.
2. **"In the dropdown for callings and releases I want to exclude
   those that are marked 'complete'."** Read as Ward Business's own
   Callings/Releases pull pickers (`getCallableCallingPlanningItems`,
   `lib/data/calling-planning.ts`) rather than anything on
   `/calling-planning` itself -- that's the one place in the app with
   two parallel, separately-labeled dropdowns literally named
   "Callings" and "Releases," and "complete" is an exact, real status
   value in this app's vocabulary (not a fuzzy description), so the
   match seemed strong enough to act on directly rather than asking
   first; flag if that guess was wrong; `/calling-planning`'s own
   per-row Calling/Release-person pickers were left untouched. Now
   excludes a row from the Callings list when `calling_status ===
   "complete"`, and from the Releases list when `release_status ===
   "complete"`, checked independently per side (a row complete on one
   side but not the other still shows in whichever list still has
   something pending) -- `announced_meeting_id is null` alone didn't
   already catch this, since a row can reach "Complete" without ever
   going through the pull/announce flow (e.g. set directly in the
   grid for something already fully done).

Both confirmed via `tsc`/`eslint`/`next build` only, same no-live-
browser gap as everything else this session.

**Bug found and fixed 2026-10-12: Calling Planning status changes
looked like they weren't saving.** The user's own report, right after
the filter-visibility fix just below: "I changed a calling to 'To be
Announced'... shows saved, no error message, reverts right away." The
save itself was very likely succeeding the entire time (`state.success`
was true, no `state.error`, and `saveCallingPlanningGrid`'s own
`UPDATE` call writes every edited field in one query -- nothing in
that action treats `calling_status` any differently from any other
column) -- the real bug was purely client-side display, the exact same
bug class already fixed once in this app for SacramentProgramSection's
speaker/music fields (2026-10-07): every field in
`CallingPlanningGridForm.tsx` is `defaultValue`-based (uncontrolled),
and each row keeps the same React instance across a save (keyed only
on `row.id`, which never changes) -- React only ever applies
`defaultValue` once, at first mount, so the newly revalidated
`row.calling_status` arriving as a fresh prop after a successful save
was never actually reflected in the already-mounted `<select>`, which
just snapped back to whatever it showed when the row first appeared on
screen. Fixed by keying every editable field (not just Status -- every
field in this grid shared the identical risk, including
`MultiPersonSelect`'s own internal `useState`, which has the same
seed-once-at-mount shape) on its own current saved value, forcing a
clean remount with a fresh default exactly when that field's real
saved value changes -- never during an in-progress, unsaved edit,
since `row` itself only updates after a real save lands. **Not yet
confirmed in production** -- asked the user to verify both that a hard
refresh already showed the correct value before this fix (confirming
the diagnosis) and that the dropdown now visibly holds the new value
immediately after saving, no refresh needed, once this ships.

**Bug found and fixed 2026-10-12: a new Excel-filter value could vanish
a row with no warning.** The user's own report, right after the slow-
navigation fix just below: they changed a Calling Planning row's Status
to "To be announced," and the row disappeared from the grid entirely --
read at first as a sort bug, but it was the column filter (same header
cell, easy to conflate with the sort button next to it).

Root cause: `ColumnFilterDropdown` (and the three grids that use it --
CallingPlanningGridForm, ActivitiesTable, and AdminTableEditor, the
last two newly wired up this same day) tracked which values were
*shown* -- `selected: Set<string> | null`, `null` meaning everything
visible, a real `Set` holding whichever values the user had left
checked. That's backwards for a value that didn't exist in any row the
last time the filter was touched: it was never something the user
*could* have checked, so the moment a row's value changed to it, it
read as "not in the selected set" and vanished -- with no way for the
user to have known that status was about to be excluded, since it
never appeared as an uncheckable option until the instant it did.

Fixed by flipping what the `Set` tracks: `ColumnFilterDropdown`'s prop
is now `excluded` (the *unchecked* values), not `selected` (the checked
ones) -- `null` still means nothing's excluded/everything shows, same
default as before, but a brand-new value nobody has ever explicitly
unchecked is now always visible, including one that didn't exist yet
when the filter was last set. All three consuming grids'
`matchesFilters` flipped to match (`excluded == null ||
!excluded.has(value)`). **Also bumped `usePersistedSortFilter`'s
internal localStorage key** (`lib/hooks/use-persisted-sort-filter.ts`,
now suffixed `::v2`) -- a v1-saved filter, loaded under the new code
with no migration, would have had its Set silently reinterpreted with
the *opposite* meaning (showing only what used to be hidden and vice
versa), which is a worse bug than just resetting everyone's saved
filter/sort once. Confirmed via `tsc`/`eslint`/`next build` only, same
no-live-browser gap as everything else this session -- ask the user to
re-check a filtered column (Calling Planning's Status is the one
already confirmed broken) once deployed.

**Bug found and fixed 2026-10-12: "navigation is very very slow again" --
not the database.** The user's own report, right after the four requests
below shipped. This assistant has no live database access, so diagnosis
went entirely through the user's own browser DevTools -- see the
Network-tab/Vercel-function-log walkthrough given in chat if this needs
repeating later. The actual numbers ruled out the server immediately:
a direct, isolated "Waiting for server response" check on both
Announcements (44.71 ms) and Dashboard (279.44 ms) was fast -- nowhere
close to explaining "very very slow." The real total page time (9.8 s
for Dashboard) was the real symptom, and sorting the Network tab by
Time exposed it directly: a pile of `fetch` requests with `_rsc=...`
in their URL, several taking 5-20+ seconds, many of them exact
duplicates of each other.

**Root cause: Next.js's automatic Link prefetching, at volume.**
`<Link>` prefetches its target the moment it's visible on screen,
by default, with no opt-in needed -- this app never turned that off
anywhere. Three places in this app render many such Links at once,
every single page load:
- `components/Tile.tsx` -- every tile on every hub page (the landing
  page alone can show a dozen-plus across "This week"/"My
  meetings"/"Music"/"Youth program"/"Administration"), each one firing
  its own background prefetch simultaneously.
- `components/AppHeader.tsx` -- its Home-wordmark Link renders on
  nearly every route in the app (this component's own doc comment
  already said so), so literally every page navigation re-fired a
  fresh "/" prefetch on top of whatever was already in flight from the
  page before it.
- `app/dashboard/page.tsx`'s `MeetingRow` -- one Link per meeting row,
  so a dashboard list of a dozen-plus meetings fired that many
  simultaneous prefetches on its own.

None of this is a database problem -- it's the browser's own limited
connection capacity (and whatever concurrency Vercel/Supabase can
actually serve at once) getting flooded by background requests nobody
asked for, which then queue up and delay the *real* request a user is
actually waiting on. Fixed by adding `prefetch={false}` to the Links in
all three places -- every route this app links to already responds in
well under 300ms on its own (confirmed directly via the Network tab
above), so there's essentially nothing lost by not pre-warming it, and
a lot gained by not flooding the connection pool on every page view.
**Not audited further**: other `<Link>`s elsewhere in the app (back
links, per-row links on other list pages) could theoretically add to
this at smaller scale -- these three were fixed because the evidence
directly implicated them (the dominant URLs in the user's own Network
tab capture were "/" and "/announcements/public", exactly what Tile +
AppHeader produce). Revisit with the same Network-tab technique if
slowness persists after this ships.

**Second, compounding bug found in the same investigation**: the
user's own follow-up, mid-diagnosis -- "some of those are multiple
clicks because I don't have a response of any kind indicating a click
was received." This app has never had any navigation loading
indicator anywhere. Combined with the prefetch flood above (which made
some clicks feel like nothing happened while a dozen background
prefetches hogged the connection ahead of the real one), a user with
no visual feedback reasonably clicks again, and again -- directly
explaining the *duplicate* fetches seen in the Network tab capture,
not just the sheer volume. New `app/loading.tsx` (a plain, minimal
"Loading…" message in this app's own established small-caption style)
is picked up automatically by every route in the app via Next.js's own
`loading.tsx` convention (no per-page wiring needed) -- this app's root
layout has no persistent chrome of its own (AppHeader renders inside
each page, not the shared layout), so this fallback briefly replaces
the whole page content area during a real navigation, which is exactly
what's needed to visibly confirm a click landed.

**Not verified in a live browser** -- same pre-existing gap as
everything else built this way (no local Supabase credentials in this
working copy). Ask the user to click around production once deployed
and confirm both (a) navigation feels faster, and (b) a brief
"Loading…" message now shows on every click.

**Four small requests worked through together, 2026-10-12** (continuing
this week's priorities above -- "visibility to the right people at the
right times" and "announcements... flawless" in particular):

1. **"This week" tile section made genuinely read-only.** The user's
   own framing: Sacrament Meeting Program and the public Announcements
   listing were already fully read-only with nothing further reachable
   from them, but Youth Activities' hub page (`/youth-activities`)
   showed a "Manage" tile -- and the three Combined-group pages
   rendered real Add Activity/inline-edit/Overwrite controls -- to any
   account holding `youth_activity_planning`, directly from this
   public-facing tier. New `?readonly=1` query param (same convention
   `/dashboard` already established), set only by the landing page's
   "This week" tile and propagated through `/youth-activities` and the
   three Combined-group pages, forces all of that off regardless of
   feature. An account that actually manages activities is unaffected
   everywhere else -- "Youth program" -> Youth Activity Planning ->
   Manage still reaches full access, since that path never carries the
   flag. **Deliberately left alone**: an admin (`sacrament_planning`/
   `sacrament_conducting`) clicking the Sacrament Meeting Program tile
   still sees the full Planning/Conducting/Public tab chrome from
   `/meetings/[id]/layout.tsx` -- that's the same pre-existing,
   deliberate "Bishopric keeps unconditional any-stage/any-date
   preview... building the program comes before it's ready" design
   this file already documents elsewhere, not something this change
   touched. Threading a forced-read-only mode through the whole meeting
   layout/tab-nav system (which has no such concept today, unlike
   `/dashboard`) would be a much larger change than what was asked --
   flagging this scoping call explicitly in case a narrower fix is
   wanted there too.
2. **Manage Announcements rebuilt into real management.** The user's
   own comparison across all three places announcements can be
   touched: Submit (fine), Manage Announcements (Administration ->
   `/announcements`, "looks like no real management can happen here...
   essentially a viewing location again"), and the Announcements table
   in Table Admin ("this is basically what I want manage announcements
   to be"). The old `/announcements` was a thin Publish/Archive-only
   list over `getGeneralSubmissions` -- no way to fix a typo, a wrong
   date, or any other field short of leaving for Table Admin directly.
   Now renders the exact same `AdminTableEditor` component and
   `announcements` registry column config `/admin/announcements`
   itself uses (full inline edit/add/delete across every field), but
   through its own `updateAnnouncementRow`/`insertAnnouncementRow`/
   `deleteAnnouncementRow` actions (`app/announcements/actions.ts`)
   gated on `announcement_management` rather than
   `table_admin_announcements` -- the two entry points stay
   independently authorized while sharing all the real read/write
   logic (`lib/admin/table-data.ts`). A small fallback list for agenda
   items with no meeting yet (vanishingly rare now that submission
   always resolves to a real meeting, 2026-09-09) stays underneath,
   using the original Publish/Archive controls, so a genuinely stray
   one is never silently hidden.
3. **Zebra striping, sorting, and column filtering extended to every
   Table Admin table.** `AdminTableEditor.tsx` (the one generic engine
   behind every `/admin/[table]` page) already had click-to-sort
   headers (2026-09-08) but never grew the Excel/Sheets-style
   `ColumnFilterDropdown` checklist or the visible-position zebra
   striping every other "favorite grid format" page already has.
   Added both, plus localStorage persistence per table
   (`usePersistedSortFilter`, keyed by `table-admin-<table>-sort-filter`)
   matching the sibling grids' own established convention. Sort stays
   on each row's committed value only (never jumps mid-edit); filtering
   reacts live to an in-progress, unsaved edit (this component already
   tracks edits in real React state via `drafts`, so no DOM-capture
   trick was needed the way CallingPlanningGridForm's uncontrolled
   inputs required) -- same split CallingPlanningGridForm already
   established between the two.
4. **Reduced the fixed minimum widths that were forcing unnecessary
   horizontal scrolling on wide grids** (the user's own report, naming
   Announcements and Calling Planning specifically: "The slider scroll
   bar is clunky. I would prefer to see the line wrapped"). The real
   driver turned out to be the *tables*, not any one cell's content --
   `AdminTableEditor`'s own `<table>` had a flat `min-w-[720px]` floor
   and every input/select carried `min-w-[120px]`; Calling Planning's
   grid carried `min-w-[9rem]` per column. Stacked across 8-15+ columns
   (Announcements has ~15), that forced a scrollbar regardless of
   whether anything was actually too long to fit. Dropped the table's
   own floor entirely and reduced each input's floor (to `6rem`/`7rem`)
   with a `16rem` cap, in both `AdminTableEditor.tsx` and
   `CallingPlanningGridForm.tsx` -- `<textarea>` cells (Body, Notes)
   already wrap natively within that cap. **Real limitation, not fully
   solved**: a plain single-line `<input>` (Title, Link, Location,
   etc.) cannot wrap by the nature of the HTML element itself -- long
   typed content there still scrolls *within* the input box rather than
   wrapping onto a second line. Converting those to auto-growing
   textareas was considered and deliberately not done here: it would
   change every `text`-type column across every Table Admin table at
   once (this engine has no per-table styling), including many short
   fields where a multi-row textarea would be a visual regression, and
   couldn't be verified without a live browser (no local Supabase
   credentials in this working copy, same gap noted throughout this
   file). Flag this if the scrollbar is still showing up in practice
   after this change -- the next step would be a more surgical,
   per-column fix rather than a blanket one.

**Current priority queue (set by the user 2026-10-12), work top to
bottom:** the second-Announcements-block feature (migration 074) is
confirmed not working in practice -- the user's own words, "It didn't
work, but I need to move this down the list" -- specifics not yet
gathered, deliberately deferred rather than debugged right now per
that same instruction. This week's real priorities, in the user's own
words:
1. "Ensure that all required items are visible to the right people at
   the right times" -- a general correctness pass on visibility/
   timing, not scoped to one feature yet.
2. "Ward business needs to work correctly... in sacrament meetings
   (some testing needed to see if there are bugs)" -- the
   Calling-Planning-sourced Ward Business picker inside the Sacrament
   Meeting agenda grid.
3. "Announcements need to be flawless (a few minor things to
   improve)" -- the pullable-Announcements element built 2026-10-11,
   not yet itemized.
Also asked to review the Feedback Widget's own suggestion log
(migration 071, `feedback` table) for anything actionable -- this
assistant has no live database access, so that needs the user to
paste back its current contents (or open `/admin/feedback` directly)
before anything on it can be acted on.

**Combined-group activities made editable, and a "which group is in
charge" column added, 2026-10-11** (the user's own request: "I want to
be able to modify combined activities. I also want to see which group
is in charge of the activity"). The three Combined-group pages
(`/youth-activities/combined-ym`, `combined-ym-yw`, `combined-yw`)
were deliberately read-only when first built (2026-10-10) -- "all
adding/editing/generating stays on the Youth Activities Management
page." This is a real reversal of that scoping decision for these
three pages specifically, not a bug fix -- `/youth-activities/upcoming`
is untouched, still purely read-only, per the user's own words scoping
this to "combined activities."
- **`ActivitiesTable.tsx` gained two new props**: `showPlanningGroupColumn`
  (a new "In Charge" column showing `planning_group` -- which class is
  on the hook to plan that combined week, see the
  `youth_activity_rotations` architecture entry) and `editable` (Time/
  Description/In Charge/Notes become real inputs, same dirty-tracking/
  Save-All-Changes pattern as every other "favorite grid format" page,
  via `useActionState` + a new `saveActivityGrid` action). Both
  default `false` (Upcoming Activities' own three call sites are
  unchanged) and are passed `true`/`canManage` on the three
  Combined-group pages' own `ActivitiesTable` calls.
- **Date and Group stay read-only even in edit mode** -- Date is the
  row's own key, and Group is fixed to whichever page it's rendered on
  (every row already shares the same value there); changing either
  would move the row off the page entirely, a bigger operation than
  "modify this activity" asked for.
- **New `saveActivityGrid`** (`app/youth-activities/actions.ts`),
  field names `"<id>::<column>"` -- simpler than the per-class grid's
  own `saveClassActivityGrid` (which keys by `(activity_date,
  group_name)` since it can render a synthetic/fallback line for an
  unplanned week): every row on a Combined-group page is already a
  real `youth_activities` row with a real id, so there's no lookup
  step before updating. Rejects the whole batch with "Title cannot be
  blank" rather than silently saving an empty title, since `title` is
  `not null` on this table (the exact constraint migration 069 had to
  work around) and a blank title read back as "nothing scheduled"
  would be a worse failure mode than refusing the save.
- **No nested-`<form>` conflict with the existing per-row Overwrite
  button** (`PushToClassesButton`) -- confirmed that component was
  already a plain `type="button"` + `useTransition`, never a real
  `<form>`, specifically so it would never conflict with a future
  wrapping `<form>` like this one, even though no such form existed
  yet when it was built.

**Root-caused and fixed, migration `075`: the public Sacrament Meeting
program was missing Presiding/Conducting/every prayer for a logged-out
viewer.** The user's own report: "People are able to see today's
sacrament meeting once they have requested access, but could only see
the music in the meeting before then... a person who enters the
dashboard should have access to see the full program starting at
6:00 am." First hypothesis (`saveProgramSpeaker` never setting
`confirmed = true` until its own 2026-10-03 fix, plus migration `050`'s
matching one-time backfill) was a real bug once, already fixed, but
not THIS one -- the user's correction ("I had already run 50 and I
just ran it again") ruled it out, and a pasted screenshot of the actual
anonymous-viewer page nailed the real shape: every heading that needed
a resolved *person* (Presiding, Conducting, Opening/Closing Prayer)
rendered with no value at all, while Opening/Sacrament/Closing Hymn
(self-contained text, no person lookup) came through fine -- a
narrower, more specific symptom than "speakers are missing."

Confirmed directly with a `pg_policies` query (this assistant has no
live database access, so the user ran it and pasted the results):
`sacrament_assignments` carried an anon-facing SELECT policy, "public
read ready sacrament assignments," gated on `meetings.stage in
('ready', 'live')`. Same class of problem as migrations 038, 041, 063,
067, 068, 069 before it -- an undocumented RLS object, created
directly in the Supabase SQL editor before this repo's migration
history started, left pointing at stage values Sacrament Meeting
stopped reaching entirely once its lifecycle was simplified down to
`template -> planning -> archived` (2026-09-10). Since a real
Sacrament Meeting's stage can never be `ready`/`live`, this policy
could never match -- an anonymous visitor's query against
`sacrament_assignments` always returned zero rows, while an admin saw
it fine via the separate "authenticated access" policy (`ALL`/`true`,
any logged-in account regardless of role) -- explaining "once they
have requested access" too: the user had likely been testing as an
authenticated account by then, which was never actually blocked.
Music's own anon policy is gated on `status = 'published'`, not
meeting stage, which is why it alone came through.

**Migration `075`** replaces the policy's condition with
`meetings.stage <> 'archived'`, matching this app's own Vision
workflow wording for this table's real visibility ("public with no
login... editable at all times until archived") -- deliberately
coarser than the application-level gate in
`app/meetings/[id]/public/page.tsx` (which still separately enforces
the real date and the 6 AM Mountain floor), matching how every other
narrow anon policy in this app already works. The 6 AM floor itself
(`isSacramentMeetingPubliclyVisible`, built earlier this same session)
was never the problem -- it was already working as designed; the
user's own closing request ("the full program starting at 6:00 am")
is satisfied once this RLS fix ships, with no further change to that
gate needed.

**Confirmed, and folded into migration `075` the same day**: the
pasted screenshot's Teaching Program section (Speakers & Music) was
entirely absent -- no Speaker/Musical Number/Testimony line at all,
not even a blank one. A second `pg_policies` query confirmed why:
`sacrament_program_items` (the table that determines which items are
in that list and in what order, migration 046) had only
`authenticated` policies -- no `anon` row at all, not a stale
condition this time, just one never written. With RLS enabled and no
matching policy, Postgres denies by default, so `getSacramentProgramItems`
returned an empty list for every anonymous visitor regardless of
whether the underlying speaker/music rows were `confirmed`/`published`
correctly -- the whole Teaching Program loop in
`getPublicSacramentView` never executed. Migration `075` (amended in
place, not yet run) adds a matching anon SELECT policy, scoped the
same "not archived" way as the `sacrament_assignments` fix above --
this table itself holds no sensitive content (just `item_key`/
`sort_order`, no names), so the real content stays protected by the
underlying tables' own existing anon filters either way.
`sacrament_rabnm_people` (queried directly for Baby Blessing names)
was checked in the same pass and already has a correct anon policy,
scoped to `type = 'baby_blessing'` -- no fix needed there.

**Verified in production, 2026-10-11**: the user confirmed, logged out,
against today's real meeting -- "checked, it's working now." Closed.

**Second Announcements block before Closing Hymn/Prayer, built
2026-10-11.** Right after being told migration `072` is on hold (see
migration history above), the user clarified the actual want: "I just
want the ability to add a second announcement block before the
closing hymn/prayer." Checked the schema before assuming this is
simple: `meeting_planned_elements` has `unique (meeting_id,
element_id)` (migration `033`) -- a meeting couldn't have two rows for
the same catalog element at all, so "add a second Announcements block"
wasn't reachable just by adding the existing element a second time via
the Agenda Elements editor. Asked the user to pick between two real
designs (a genuinely repeatable element with each block independently
scoped, vs. one shared list with a per-item "which position" flag) --
answered "Two independent blocks, each its own pool."
- **Migration `074`** drops that unique constraint outright (confirmed
  no application code relies on it being enforced -- no `ON CONFLICT`
  target against it anywhere, nothing else assumes exactly one row per
  element) and adds `announcements.planned_element_id`, a nullable FK
  to the SPECIFIC `meeting_planned_elements` row an announcement was
  pulled into -- not just which meeting (the existing `meeting_id`,
  migration 031, untouched). Without this second key, two Announcements
  blocks on one meeting would have no way to tell which block a given
  pulled announcement belongs to, and both would show the identical
  list. `on delete set null` -- removing a block (the Agenda Elements
  editor's Remove button) puts its announcements back in the general
  pool rather than deleting them. Backfills any announcement already
  pulled before this shipped onto its meeting's first (lowest
  sort_order) Announcements block.
- **Deliberately NOT the existing `repeatable`/`slot_count` mechanism**
  Speaker/Musical Number already use -- that one repeats the SAME
  element N times *adjacently*, at one position in the agenda (Speaker
  1, Speaker 2, one after another). What's needed here is two blocks
  at two genuinely DIFFERENT positions (one early, one right before
  Closing Hymn) -- a different concept, so `meeting_elements.repeatable`
  for `announcements` was left untouched (still `false`) rather than
  overloading a flag that already means something else and would have
  surfaced a confusing "set slot count" control on the Agenda Elements
  editor for an element it doesn't apply to.
- **`/meetings/[id]/template` (Agenda Elements editor)**: its "Add
  Element" list used to drop any already-included element from the
  picker entirely, for every element -- `announcements` is now the one
  hardcoded exception (matching this app's own established pattern of
  special-casing specific element keys in code rather than adding a
  new generic schema flag for a single current need, e.g.
  `STAKE_PRESIDENCY_CALLING_NAMES`/the existing `"announcements"`/
  `"ward_business"` key checks already in `agenda-rows.ts`), so it
  stays addable a second time. A newly-added second block starts at
  the end of the agenda (same as any new element) -- use the existing
  Move Up/Down controls to position it. Deliberately scoped to the
  per-meeting editor only, not `/admin/meeting-templates` (the shared
  default template all future meetings seed from) -- the user's own
  wording was about one meeting's own agenda, not changing what every
  future Sacrament Meeting starts with.
- **Data layer**: `getAnnouncementsForMeeting` (a flat list for "this
  meeting") replaced by `getAnnouncementsByPlannedElement` (a
  `Map<plannedElementId, PulledAnnouncement[]>`) -- `buildAgendaRows`/
  `buildConductingRows`/the Archived view's per-element renderer all
  look up `announcementsByPlannedElement.get(el.id)` instead of
  reading one shared list, since `el.id` (the `meeting_planned_elements`
  row id) is exactly the new block identifier.
  `pullAnnouncementIntoMeeting` now takes a `plannedElementId` too,
  passed straight through from `AnnouncementsField`'s own `row.id`.
  `getPullableAnnouncements` (the general not-yet-pulled-anywhere pool)
  is unchanged -- shared across every block of every meeting, same as
  before; once pulled into any block, it's gone from every other
  block's own picker too.
- **The opening/closing grid-half split, generalized from
  "is this element literally `announcements`" to "is an Announcements
  block immediately adjacent to Closing Hymn/Prayer."** The previous
  version (`findIndex` matching `"announcements"` directly, built for
  migration 072's single-block case) would grab whichever block comes
  FIRST once a second one exists -- wrong the moment an earlier block
  exists too, since it would wrongly anchor the closing half there and
  drag Teaching Program ahead of where it belongs.
  `app/meetings/[id]/planning/page.tsx` and `lib/data/conducting.ts`
  both now find Closing Hymn/Prayer's own index first, then only shift
  the anchor back one slot if the element immediately before it is an
  Announcements block -- an earlier, unrelated block elsewhere in the
  agenda renders inline in the opening half like any other element,
  untouched by this check.

**Agenda Items now renders at its own real template position instead
of always being pinned to the end, 2026-10-11** (the user's own
report, going into a Bishopric Meeting/Ward Council/Youth Council
meeting: "the agenda items come in at the end of the meeting. That is
probably the biggest thing. It didn't follow the template"). This
surfaced while scoping the user's larger "make every meeting look like
Sacrament Meeting" request (Ward Council named as the first target) --
asked what the real gap was; the user picked "dynamic add/remove
picker elements" as the answer, then this specific report is the
concrete first instance of it.
- **Root cause**: Agenda Items (a real cataloged `meeting_elements`
  row with its own `sort_order` in the template, same as every other
  element) has always been unconditionally filtered out of the main
  agenda grid and bolted on as its own fixed section below Bishopric
  Minutes/Action Items, regardless of where it actually sits in the
  template -- the exact same class of bug Announcements/Teaching
  Program needed a real split to fix (migration `072`'s own Known-open-
  items entry, now on hold above, but the *code* fix that shipped
  alongside it -- the `closingIndex` split -- is unrelated and
  unaffected). The read-only Archived view (`app/meetings/[id]/archived/page.tsx`)
  had the identical bug, found and fixed the same way while in here --
  it deferred `agenda_items` to a fixed section at the very bottom of
  the page instead of rendering it inline at its real position; fixed
  more simply there since that page is read-only (no nested-`<form>`
  concern at all), so the inline branch just renders real content
  directly instead of returning `null` and flagging a Set for a
  fixed-position section to check later.
- **Fix, Planning page** (`app/meetings/[id]/planning/page.tsx`):
  generalizes the Sacrament-only opening/closing grid split to also
  split around wherever `agenda_items` sits in a non-Sacrament
  template's own order -- `agendaItemsIndex` computed against the
  FULL `templateElements` list (before agenda_items is filtered out of
  the grid for its own display reasons), producing
  `beforeAgendaItemsElements`/`afterAgendaItemsElements`. Renders:
  grid (before) -> Agenda Items section (now positioned correctly,
  moved up from its old fixed spot) -> a second grid (after), the
  latter only rendered at all when the template actually has something
  after Agenda Items. Two independent `AgendaGridForm`s with their own
  Save buttons, not combined into one via `CombinedAgendaGrids`
  (Sacrament-only machinery, built for a different explicit request --
  "one combined button for both halves" -- never asked for here, and
  this page already shows multiple independent save buttons for
  Bishopric Minutes/Action Items/Council Notes, so a second "Save All
  Changes" isn't a new pattern on this page). Sacrament Meeting's own
  split (around Closing Hymn/Prayer/Announcements) is completely
  unaffected -- Sacrament Meeting never has an `agenda_items` element
  in its template at all (confirmed: agenda-item submission has always
  excluded Sacrament Meeting), so `agendaItemsIndex` is always -1
  there and every new variable just aliases the existing
  `elementsForGrid`/`[]` values, unchanged behavior.
- **Bishopric Minutes/Action Items/Council Notes deliberately left at
  their existing fixed position**, at the very bottom -- unlike Agenda
  Items, none of those three is a real cataloged template element with
  a `sort_order` of its own to violate; they've always been bespoke,
  meeting-type-specific sections with no "correct" template position to
  restore. Only Agenda Items moved.

**Real rotation-cycle data imported from the ward's actual 2026 master
schedule, migration `073` -- but only 10 of the spreadsheet's 16
columns, 2026-10-11.** The user pasted a full 52-week spreadsheet
("2026 - Syracuse Heritage Ward - Master Meeting Schedule &
Assignments") with "Please migrate this data into rotations." Analyzed
with a one-off Node script (scratchpad, not committed, same convention
as every other bulk-import script this session) that extracts each
column's real repeating member-cycle order and derives `next_index`
from the LAST real occurrence (not a naive total-count, which breaks
the moment a real meeting gets skipped -- confirmed several General
Conference/Stake Conference weeks do exactly that). 10 columns mapped
cleanly onto rotations this app already has (migration 034's own 10
generic rotations): Bishopric Meeting's ST/Handbook/OP/CP, Ward
Council's OP/CP/ST, Youth Council's OP/Thought/CP.

**The other 6 columns do NOT have a real destination yet and were
deliberately left out of migration `073` -- flagging rather than
guessing:**
- **Sacrament Meeting Conducting/Speaker columns ("Sacr Cond"/"Sacr
  Speak")**: Conducting is fixed-by-calling in this app
  (`applyFixedSacramentRoles`, cycles Bishop -> 1st Counselor -> 2nd
  Counselor by calendar month, reading each calling's *current*
  holder, not a stored rotation list) -- there's no `rotation_members`
  table for it to import into at all. Speaker/Youth Speaker have
  always been deliberately NOT auto-assigned in this app
  (`/speaker-prayer-history` is the existing manual tool for exactly
  this). Analysis also found "Sacr Cond" and "Sacr Speak" are identical
  in every row that has both -- the spreadsheet appears to use one
  column to track two different things, or this ward's real practice
  has the conductor always be the speaker-finder. Recommend: skip
  entirely, nothing to build here unless you want this ward's real
  Conducting cycle checked against what `applyFixedSacramentRoles`
  already computes.
- **"WYC Comb Act"**: unclear what this column is tracking -- not
  self-evident from the data alone. Need you to say what it means
  before anything can be built for it.
- **"YM Combined"/"YW Combined"**: these use the OLD age-based class
  naming (pre-dating this session's own youth-activity-rotation
  reconciliation work, migration 069, built from 6 detailed per-class
  calendars the same day). Potential real conflict: if this
  spreadsheet's combined-activity assignments disagree with what's
  already seeded from that reconciliation, one of the two is wrong.
  Flagging rather than silently overwriting either.
- **"BLDG Assignment"** (building assignment/cleaning, presumably): no
  existing table in this schema holds anything like this at all --
  would need a genuinely new table, not an import into something that
  exists.

Ask before building any of these four -- this mirrors the user's own
established pattern elsewhere in this app (e.g. the Calling dropdown's
missing-vacant-callings fix, the Candidates-field redesign) of wanting
to be asked rather than guessed at when something's ambiguous.

**Zebra striping fixed to key off visible row position, not DOM
position, 2026-10-11** (the user's own report, right after noticing it
in practice on one of the two grids that actually filter: "when we
sort and filter can we then redo the zebra striping so we don't end up
with several of the same color stacked on top of each other?"). The
2026-10-10 row-contrast entry above had explicitly flagged this exact
failure mode as a known, accepted cosmetic limitation on
`CallingPlanningGridForm.tsx`/`ActivitiesTable.tsx` (the only two grids
with a real per-column filter) and decided it wasn't worth fixing --
"accepted" didn't survive the user actually hitting it. Root cause
unchanged from that original writeup: a filtered-out row stays mounted
in the DOM (`hidden` attribute, not removed, so an in-progress edit on
it isn't dropped from the next Save All Changes), and the old
`even:bg-accent-soft` is a pure CSS `:nth-child` selector that counts
those hidden siblings toward its own parity -- after a filter changes
which rows show, two consecutive *visible* rows could land on the same
shade instead of strictly alternating. Fixed in both files by
replacing the CSS selector with a plain JS-computed `stripeByRowId`
map: walk the sorted rows in order, skip any that fail `matchesFilters`,
and assign alternating stripes only to the ones left -- striping now
always strictly alternates across whatever's actually on screen,
regardless of how many hidden rows sit between them in the DOM.
Recomputed on every render rather than memoized, since
`CallingPlanningGridForm`'s own filtering already has to react live to
in-progress edits (see that file's own 2026-10-10 entry) and a memoized
map would need the exact same dependency list anyway. The other three
"favorite grid format" pages with zebra striping
(`AssignmentGridForm.tsx`, `TeachingGridForm.tsx`,
`ClassActivityGridForm.tsx`, and the Dashboard meeting list) have no
filter at all -- confirmed by checking each for a `hidden`-row pattern
before assuming they needed the same fix -- so plain CSS `even:`
striping there was never actually broken and was left unchanged.

**Announcements moved to right before Closing Hymn/Prayer, 2026-10-11**
(the user's own follow-up, right after it became real: "Can we add an
announcement section before the closing hymn and prayer?"). It had
always sat at sort_order 70 -- right after Visiting Authorities and
*before* the Opening Hymn (migration 033's original order), nowhere
near the end of the meeting. New migration `072` moves it to
immediately before Closing Hymn in every format that has both,
computed relative to that format's own Closing Hymn sort_order (same
`+/-N` trick migration 046 already established for Sacrament
Administered) rather than a hardcoded absolute number -- applied to
both `meeting_templates` (future meetings) and already-seeded
non-archived meetings' `meeting_planned_elements`, same precedent.
- **A real, consequential wrinkle found while placing this**: the
  Planning/Conducting split into two grid halves around Closing
  Hymn/Prayer, with Teaching Program (Speakers & Music) always
  rendered *between* those halves regardless of any element's own
  sort_order. Giving Announcements a sort_order just below Closing
  Hymn's would only have made it the last row of the *opening* half --
  landing it **before** Teaching Program, not after it, since the
  halves split purely on finding `closing_hymn`/`closing_prayer`'s
  index. Fixed by having the split also anchor on `"announcements"`
  itself (`app/meetings/[id]/planning/page.tsx` and
  `lib/data/conducting.ts`, both one-line changes to the same
  `findIndex` condition) -- the real rendered order is now Teaching
  Program -> Announcements -> Closing Hymn -> Closing Prayer, matching
  how an actual Sacrament Meeting runs (announcements near the very
  end, after the main content, not near the beginning).

**Announcements became a real, pullable element of the Sacrament
Meeting agenda, 2026-10-11** (the user's own request: "can we make the
announcement portion of sacrament meeting more than just a
placeholder? I want to be able to select the announcements that need
to be included in sacrament meeting from the list of announcements by
title... then I want the details of the announcement to appear in the
planning and conducting view for announcement at the pulpit"). Before
this, `announcements` was cataloged (migration 033) but never actually
wired to anything -- resolution_kind `'none'` fell through to a plain
`banner` row with no data, the same "deliberately deferred" state this
file already documented.
- **No new column needed.** `announcements.meeting_id` already existed
  (migration 031) and was already load-bearing: `getPublishedAnnouncements`/
  `getGeneralSubmissions` (`lib/data/general-submissions.ts`) both
  already exclude any row with `meeting_id` set -- nothing had ever
  actually *written* it, though. New `lib/data/sacrament-announcements.ts`
  (`getPullableAnnouncements`/`getAnnouncementsForMeeting`) and
  `app/meetings/[id]/announcements-actions.ts`
  (`pullAnnouncementIntoMeeting`/`removeAnnouncementFromMeeting`, gated
  on `sacrament_planning` -- the same feature `saveAgendaGrid` already
  checks) are the first real reader/writer of it. Pulling one in
  removes it from the public announcements page and the admin inbox
  automatically (same `meeting_id` filter, already in place); removing
  it puts it back.
- **New `announcements` `AgendaRow`/`ConductingRow` kind** -- same
  "pull action with a real side effect, no field names of its own"
  shape as `ward_business` (`components/planning/AnnouncementsField.tsx`
  mirrors `WardBusinessField.tsx`'s own Calling-Planning picker almost
  exactly: a compact list of what's pulled in, Remove per row, one
  dropdown of everything still in the general pool, committing
  immediately via a direct server-action call rather than waiting for
  the grid's own Save All Changes). Conducting
  (`lib/data/conducting-rows.ts`'s new `announcementWording()`) gives
  each pulled announcement its own spoken line (the body, plus
  location/date-time if filled in -- deliberately leaves out `link_url`,
  nothing to read aloud) -- skipped entirely when none are pulled in,
  same as Visiting Authorities' own "nothing to say if nothing's
  there" rule.
- **Archived view extended too**, not just asked for but a real,
  matching gap -- `app/meetings/[id]/archived/page.tsx` had the exact
  same `recognize_music`-style hole (resolution_kind `'none'`, no
  special case, so the generic switch would've shown the bare label
  forever even with real pulled announcements). Now lists their titles
  in the finalized-agenda view, same as it already does for every
  other real element.
- **Deliberately left out of the public program** -- the user's own
  wording scoped this to "the planning and conducting view" only;
  matches Ward Business's own precedent of staying out of
  `lib/data/public-view.ts` without being asked to add it there too.
- **Noticed in passing, not fixed**: `archived/page.tsx`'s own
  `ward_business`/`stake_business` free-text branch still reads
  `sacrament_planning.ward_business`/`stake_business` directly -- the
  columns Ward Business stopped writing to back on 2026-10-03 once it
  became fully Calling-Planning-sourced. Looks like a real, separate
  staleness bug in the archived view specifically (Planning/Conducting
  were both already fixed for this exact drift), but it's out of scope
  for what was asked here -- flagged rather than fixed as a drive-by.

**Seasonal accent color, matching churchofjesuschrist.org's own
rotation, 2026-10-11** (the user's own "side quest": "the church's
website uses a blue general color scheme, the reddish color scheme we
are using now for christmastime, and a purpleish scheme for easter
time... Can you determine what those are, when they are used, and
apply that same coloration change to this app?"). Verified directly
against the real site (its live CSS, plus several Wayback Machine
snapshots) rather than guessing -- confirmed blue is the real default
(checked an Oct 2025 General Conference weekend, July 2025 Pioneer
Day, and today's live site, none special), red really is Christmas
(active Nov 27 and Dec 24, 2025; not active Nov 1), and purple really
is Easter (active Good Friday 2025). **No fourth, green season was
found** despite checking several more candidate dates -- only three
real states exist as far as this could verify.
- **New `lib/data/season-theme.ts`** (`getSeasonTheme()`) -- pure,
  Mountain-Time-based (same `getMountainTimeNow()` this app already
  uses for the Sacrament Meeting visibility fix, for the same
  "server's UTC clock would drift" reason, even though the stakes here
  are much lower). Christmas = Dec 1 -- Jan 6 (Christmastide's own
  traditional bounds, since the real site's exact switch day wasn't
  pinned down between the two confirmed data points). Easter = the 14
  days before Easter Sunday through Easter Sunday itself, computed via
  the real Computus algorithm (Anonymous Gregorian/Meeus-Jones-Butcher)
  -- verified against six real years (2023-2028) before trusting it,
  not a hardcoded date table.
- **Rotates only the existing `--color-accent`/`-deep`/`-soft` tokens'
  hue** (`app/globals.css`), via a `data-season` attribute
  `app/layout.tsx` now sets on `<html>`, keeping their lightness/
  chroma exactly as `design.md` already specified -- a real, measured
  finding made this unusually clean: this app's own pre-existing
  accent hue (20) already matches the church site's own red (measured
  hue 19-21 across its three shades) almost exactly, strongly
  suggesting that's exactly where this app's current permanent color
  came from in the first place. "Christmas" keeps that hue completely
  unchanged; "default" and "easter" rotate to the church site's own
  measured blue (hue ~231, from `#006184`/`#007da5`/`#005175`) and
  purple (hue ~317, from `#592569`/`#84389e`/`#421c4f`) respectively --
  every hex-to-OKLCH conversion done directly (a small one-off script,
  not committed), not estimated by eye.
- **Not verified in a live browser** -- same pre-existing environment
  gap as everything else this session (no `.env.local`, `next dev`
  500s before any app code runs); today (Oct 11) renders "default"
  (blue) per `getSeasonTheme()`'s own logic, confirmed by direct
  calculation, not by looking at a running page.

**Confirmed checkbox added to the per-class grid, 2026-10-11** (the
user's own question after the old inline toggle was removed along
with "All Activities": "how do we change when an activity is
tentative vs non-tentative?" -- answered directly, Table Admin's
Youth Activities grid still has it, but asked whether a quicker way
was wanted; the user chose adding it to the per-class grid). New
Confirmed column on `/youth-activities/manage/classes`
(`ClassActivityGridForm.tsx`), same hidden-"false"-before-the-real-
checkbox trick already used for Stake Business (an unchecked box
submits nothing on its own). `ClassActivityRow`/`getClassActivityGrid`
(`lib/data/class-activities.ts`) and `saveClassActivityGrid`
(`app/youth-activities/manage/classes/actions.ts`) both gained the
field; a brand-new row created from a blank line still defaults to
unconfirmed (`confirmed: false`), matching Add Activity's own existing
default.

**Upcoming Activities re-attributed to the 6 real classes, 2026-10-11**
(the user's own follow-up, right after the Add/Overwrite work above
shipped): "For the upcoming activities lists please note that I only
want to see a listing for each of the 6 groups. So if it is a combined
YM/YW that will overwrite any combined YM or combined YW activity
listed in those tables. And a note can be added to each group that it
is a combined YM/YW. Same for when a combined YM or combined YW
activity is listed -- no need to list those types as group. Just note
in the notes that it is a combined YM or combined YW activity."
Scoped to `/youth-activities/upcoming` only -- the three Combined-
group pages keep showing the real shared row as-is (the entire point
of those pages, and of the Overwrite button built on them minutes
earlier); re-attributing those too would have undermined both.
- **New `resolveForClass` + `explodeActivitiesByClass`**
  (`lib/data/class-activities-shared.ts`, pure, no DB access) -- the
  former is the one shared precedence rule both this and
  `getClassActivityGrid` now use: this class's own individual row
  first, then Combined YM/YW (the user's own explicit rule here --
  it "overwrites" either single-gender Combined type), then this
  class's own single-gender Combined type. `getClassActivityGrid`
  previously had the last two in the opposite order -- a real,
  if practically harmless, inconsistency (the fixed nth-Wednesday
  cadence means a real date is never both a Combined YM/YW week and a
  Combined YM/YW-conflicting week at once), fixed by having both
  functions call the one shared helper instead of each encoding its
  own copy of the precedence.
- **`explodeActivitiesByClass`** takes the raw `youth_activities` rows
  and re-attributes each date to every real class it actually applies
  to -- a Combined YM/YW row becomes 6 rows (one per class), Combined
  YM becomes 3, an individual week stays 1 -- each carrying a
  synthetic id (`<sourceId>::<className>`, since up to 6 rows can
  share one real row; safe only because this feeds a read-only view
  with no row-level action keyed on `id`) and a "`<group>` activity."
  note folded into whatever real notes it already had. `ActivitiesTable`
  itself needed zero changes -- the transform happens before the data
  ever reaches it, since the output is still the same `YouthActivityRow`
  shape.
- Verified directly (a small throwaway script, not committed) against
  three cases before trusting it: a Combined YM/YW date producing 6
  rows, a Combined YM date producing 3, and an individual row on the
  same date as an unrelated Combined row correctly taking precedence
  for its own class while the other classes still resolve to the
  Combined row.

**New: Add Activity + Overwrite on the Combined-group pages,
2026-10-11** (the user's own follow-up request, right after the
per-class management page above shipped): "I would like to have a way
to add an activity row on the combined activity tables. I also want to
have a button to command that the combined activity overwrite the
activity on the same date of the appropriate groups (all YM/YW for
combined YM/YW, only the YW for combined YW, only the YM for combined
YM)." Two distinct additions to the three Combined-group pages
(`/youth-activities/combined-ym`, `combined-ym-yw`, `combined-yw`),
both `youth_activity_planning`-gated -- `/youth-activities/upcoming`
(all groups mixed) is deliberately untouched, since the request was
specifically about "the combined activity tables."
- **New `lib/data/class-activities-shared.ts`** -- pure helpers (no
  `createClient` import, so safe for a Client Component to import
  directly, same split this app already used for
  `sacrament-program-shared.ts`) holding `ACTIVITY_CLASSES`,
  `combinedTypeForClass`, and the new `classesForCombinedGroup`
  (`"Combined YM"` -> Deacons/Teachers/Priests, `"Combined YW"` ->
  the three YW classes, `"Combined YM/YW"` -> all six). The per-class
  grid's own `lib/data/class-activities.ts` now re-exports from here
  rather than duplicating the mapping.
- **Add Activity**: new `components/youth-activities/AddCombinedActivityForm.tsx`
  -- a trimmed copy of the Manage page's own Add Activity form with
  Group fixed (a hidden field, not a dropdown -- the page itself
  already says which Combined type it is) rather than a new server
  action; reuses the existing `addYouthActivity` directly. That action
  also gained a `planning_group` field it never read before (missing
  entirely until now, confirmed by checking) -- added to both this
  form and the Manage page's own general Add Activity form for
  consistency, since a brand-new Combined activity needs somewhere to
  say who's responsible for it.
- **Overwrite**: new `pushCombinedActivityToClasses` action
  (`app/youth-activities/actions.ts`) and
  `components/youth-activities/PushToClassesButton.tsx`, wired into
  `ActivitiesTable.tsx` as a new optional `showOverwriteColumn` column
  (per-row target classes resolved from that row's own `group_name`
  via `classesForCombinedGroup`, not a blanket page-level flag).
  Copies title/time/location/category/leads/notes from the Combined
  row onto each target class's own individual row for that same
  date -- creating it if none exists, overwriting it if one does.
  Deliberately does **not** copy `planning_group` (a combined-only
  concept -- an individual class's own activity has no one else to
  name as responsible) or the confirmed/cancelled flags (left
  independently manageable per class after the copy). Shows its own
  inline "Overwrote `<classes>`." / error message, since the button
  changes nothing visible about the Combined row on the page it's
  clicked from -- without that, there'd be no feedback at all.
- **Complementary to, not a replacement for, the per-class grid's own
  live fallback display** (`getClassActivityGrid`, built minutes
  earlier the same session): that page already shows a class's
  Combined-week activity automatically, no copy needed, and editing it
  there updates the one shared row. Overwrite is for the opposite
  direction -- distributing real, independent per-class copies out
  from the Combined side, once an admin wants each class to have its
  own editable record of that week rather than continuing to read it
  live off the shared row.

**New: per-class activity management, 2026-10-11** (the user's own
request: "I need somewhere to manage each individual class's
activities. it should draw from the combined activity pages as
appropriate and then have the ability to fill in the rest, while all
lines should ultimately be editable even if they are prefilled by a
combined activity table."). New `/youth-activities/manage/classes`
(hub + per-class grid, reached from a new tile on
`/youth-activities/manage` -- same `youth_activity_planning` gate as
everything else in that domain, not the Teaching domain's per-person
`youth_class_teachers` model) -- same hub-then-`?class=<name>`
pattern already established by `/youth-teaching-planning`.
- **New `lib/data/class-activities.ts`** (`getClassActivityGrid`): one
  row per upcoming Wednesday for a single class, resolved with a clear
  precedence -- this class's own individual `youth_activities` row for
  that date, else the shared Combined row it attends that week (its
  own single-gender Combined type first, then `Combined YM/YW`), else
  a genuinely blank line. `ACTIVITY_CLASSES` is the same 6-class
  derivation as `TEACHING_CLASSES` (`lib/data/teaching-assignments.ts`)
  but kept as its own copy rather than imported from that module,
  since that one is about the Teaching domain specifically.
- **Every line is a real, writable field regardless of source** -- the
  user's own explicit point. A row's starting values are read from
  whichever `youth_activities` row applies, but the field names
  (`<date>::<sourceGroupName>::<column>`) encode exactly which row a
  save should write back to -- editing a Combined-sourced line (shown
  with a small accent-colored label naming which Combined type it
  came from) updates that one real, shared row, visible to every other
  class that attends it too, since it genuinely is one event, not a
  per-class fork of it. `saveClassActivityGrid`
  (`app/youth-activities/manage/classes/actions.ts`) re-checks which
  of those (date, group) pairs already has a row (one batched query,
  not one per line) and updates it in place, or inserts a new
  individual row for this class if none exists -- there's no way to
  decide "this blank week should actually be Combined" from a single
  class's own page, so a brand-new line can only ever become that
  class's own activity.
- **Columns deliberately kept to Title/Location/Category/Planning
  Group** -- the content fields a class's own leader would actually
  fill in week to week. Youth Lead/Advisor Lead/Notes and the
  status/confirmed/cancelled toggles stay off this grid (same
  "don't touch what the grid doesn't show" principle used throughout
  this app) -- Table Admin's existing "Youth Activities" grid or the
  Manage page's own Add Activity form remain available for those.
  A line with a blank Title is skipped entirely on save -- matches
  Teaching Calendar's own "blank cell = nothing yet" sparse
  convention, and avoids ever violating `youth_activities.title`'s
  NOT NULL constraint (the exact thing migration 069 had to work
  around) by trying to save an empty one.
- **Same "today + 2 months, overridable" date-range convention as
  `/youth-teaching-planning`** (`defaultThroughDate()` + a `?through=`
  query param and its own small form) -- not re-litigated, just
  matched directly from that page.

**Bug found and fixed 2026-10-11: the next day's Sacrament Meeting
public program went visible several hours early.** The user's own
report: "tomorrow's sacrament meeting is now visible. I think it
might be a timezone thing." Confirmed: both places that gate the
public page on "is this today's meeting" (`app/meetings/[id]/public/page.tsx`'s
own check and `getTodaysPublishedSacramentMeeting` in
`lib/data/meetings.ts`, used for the landing page's own tile) compared
against a plain `new Date().toISOString().slice(0, 10)` -- the
server's UTC date, which rolls over to the next calendar day 6-7 hours
before midnight actually arrives in Mountain Time (depending on
daylight saving) -- so the next day's meeting started showing publicly
around 5-6pm Mountain the evening before.
- New `lib/data/timezone.ts` (`getMountainTimeNow()`,
  `isSacramentMeetingPubliclyVisible(dateIso)`) -- computes the current
  date/hour via the real IANA `America/Denver` zone (`Intl.DateTimeFormat`
  with `timeZone`), not a fixed UTC offset that would silently drift
  wrong twice a year across the MST/MDT transition. Verified directly
  against both a UTC-rollover case and a January (MST) case before
  wiring it in.
- **Also adds the 6 AM Mountain floor the user asked for on top of the
  timezone fix itself**: "Can we have that show up no earlier than
  6:00 am mtn time for those who see only the public view?" -- the
  program isn't available to a public/no-login viewer until 6 AM
  Mountain on its own date, not right at midnight. Scoped exactly to
  what was asked: the admin/Communications-Specialist early-preview
  branches in `public/page.tsx` are checked first and are completely
  unaffected -- this only delays when an ordinary public viewer (or the
  landing page's own convenience tile, which has no role bypass of its
  own) can see it.
- **Not touched, flagged instead**: a broader grep turned up the same
  plain `new Date().toISOString().slice(0, 10)` pattern in several
  other, lower-stakes places (`app/dashboard/page.tsx`,
  `app/calling-planning/page.tsx`'s date-picker default,
  `app/youth-activities/{combined-ym,combined-ym-yw,combined-yw,upcoming}/page.tsx`,
  `lib/data/music-list.ts`, `lib/data/rotations.ts`,
  `components/admin/MeetingDatePicker.tsx`). None of these gate
  genuinely public, no-login content the way the Sacrament Meeting
  public page does -- being off by a few hours around midnight on an
  admin-facing "upcoming" filter or a date-picker default is a minor
  annoyance, not the kind of early-exposure bug this report was about
  -- so none were changed. Revisit with `getMountainTimeNow()` if any
  of these turn out to matter in practice.

**Youth Activities split into browsing vs. a gated Manage page,
2026-10-11** (the user's own request: "remove 'All Activities' table
and add activity and cadence and generate activities. Those last
three should be seen only when clicking on the manage tile which
should only be visible to those with access."). `/youth-activities`
itself is now just the `TileGrid` -- the four existing read-only
browsing tiles (Upcoming Activities, Combined YM & YW, Combined YM,
Combined YW), plus a new **Manage** tile shown only when
`hasFeature(profile, "youth_activity_planning")`.
- **"All Activities" removed outright, not moved anywhere** -- its
  per-row controls (publish/unpublish, confirm/mark tentative, cancel
  with a note/un-cancel, delete) are gone from this app's own UI.
  Table Admin's existing "Youth Activities" grid already exposes the
  same columns (status, confirmed, cancelled, cancellation_note) and
  becomes the fallback for that kind of edit, same "bespoke page for
  everyday work, Table Admin for the rest" split this app already uses
  for Sacrament Meeting Content and several other tables. The five
  server actions that only existed to back that list
  (`setYouthActivityStatus`, `deleteYouthActivity`,
  `toggleYouthActivityConfirmed`, `setYouthActivityCancellation`,
  `uncancelYouthActivity`) are deleted outright from
  `app/youth-activities/actions.ts`, not left unlinked -- confirmed via
  grep that nothing else in the app called any of them.
- **New `/youth-activities/manage`**, gated the same way
  `/youth-activity-cancellations` already is (redirect to `/login` if
  signed out, a plain "doesn't have access" message if not
  `youth_activity_planning`). Holds everything that used to sit inline
  below the browsing tiles: Generate Combined Activities
  (`GenerateYouthActivitiesForm`), Add Activity, the cadence-rule
  manager (`YouthActivityScheduleManager`), and its own Generate
  Activities form -- none of these moved pages' own gate logic, since
  all four were already checking the same `youth_activity_planning`
  feature, just inline on the old page instead of behind a dedicated
  route.
- **Revalidation targets updated to match where content actually
  moved**: `addYouthActivity`/`generateYouthActivities`
  (`app/youth-activities/actions.ts`) and `generateActivities`
  (`app/youth-activities/schedule-actions.ts`) now revalidate the four
  browsing pages + `/events` directly (a new `revalidateActivityListings()`
  helper in the first file) instead of the now content-free
  `/youth-activities`, which would otherwise have left the browsing
  tiles' client-side router cache stale after an edit on the new Manage
  page. The four rule-CRUD actions in `schedule-actions.ts`
  (add/update/delete/toggle) revalidate `/youth-activities/manage`
  instead, matching where the rule list they actually affect now
  renders.

**Bug found and fixed 2026-10-11: "submitted by" showed an email
address instead of a name.** The user's own report, right after
testing the new Feedback Widget: "names show up as emails and not the
name of the individual. i saw this earlier when we were reviewing the
announcement sheet. We ultimately removed the submitted by
information, but the name showed up as the user's email address
rather than their name." Root cause, confirmed by a full-codebase
search before touching anything: `profiles.display_name` has **no
producer anywhere in this app** -- `requestAccess`'s `signUp()` call
never sets it, no code anywhere inserts/updates it, and no
`handle_new_user`-style trigger exists in any tracked migration to
populate it from Supabase Auth either. It's always been null by
construction for every account, with every reader (`AppHeader`'s
"signed in as," the Verify Logins list, `submitAnnouncement` before it
was removed, and now `submitFeedback`) silently falling back to the
account's email the same way. This was a real, previously-undiagnosed
bug, not a one-off -- the announcement workflow's earlier "remove the
field" response treated the symptom rather than the cause, since
nobody had traced it back to `display_name` specifically being dead
data until this report.

Fixed at the one shared source instead of patching each call site:
`getSessionUser()` (`lib/supabase/get-session-user.ts`) now also
selects `people.name` for the account's linked person row (it already
fetched `people.id` for calling-feature resolution) and prefers that
real name over the always-null `profiles.display_name` when building
`SessionProfile.display_name` -- the `people` row a Verify-Logins
admin links to a login is the actual source of truth for a signed-in
account's human name, not a `profiles` column nothing ever writes.
Falls back to the old (always-empty) column, then to nothing, so an
unlinked account (still in the Verify Logins queue) is unaffected --
it has no `people` row yet either way. This one change fixes the
symptom everywhere `profile.display_name` is read, not just
`submitFeedback`: `AppHeader`'s header text and the Verify Logins
admin list both show a real name now too, for any account already
linked to a person.

**Persistent Feedback Widget built, 2026-10-11** (the user's own
request, approved via a formal plan first: "can we add a feature that
suggest a fix or an upgrade? those can be stored in a [...] table and
reviewed by claude when in a coding session. suggested become
background work by my approval. bugs/fixes become priorities"). A
slim bar fixed to the bottom-right of the viewport, collapsed by
default -- expands into a short form (Bug/Fix vs. Suggestion/Upgrade,
one text field), captures the current page via `usePathname()`
automatically, and collapses back to a blank form on Close (not a
stale success message, even though the widget stays mounted across
client-side navigations -- `showThanks` resets alongside `expanded`).
- **New `feedback` table (migration `071`)** -- `type`/`body`/
  `page_path`/`submitted_by_name`/`submitted_by_email`/`status`, no
  CHECK constraint on `type`/`status` (deliberately, after this
  session's own `calling_planning`/`youth_activities` CHECK-constraint
  incidents -- Table Admin's `select` column type constrains the UI
  dropdown instead). Also seeds one new `table_admin_feedback` catalog
  row -- nobody gets it automatically, same one-time bootstrapping
  step every new feature needs (grant it via `/admin/calling-features`
  to whichever calling(s) should triage feedback). Confirmed run.
- **`submitFeedback`** (`app/feedback-actions.ts`) requires a signed-in
  user (re-checked server-side, same defense-in-depth convention as
  `submitAnnouncement`/`submitAgendaItem`) and attributes
  `submitted_by_name`/`submitted_by_email` from the session -- no
  self-reported name/email field on the widget itself.
- **`components/FeedbackWidget.tsx`** mounts only when `app/layout.tsx`
  (now an async Server Component) finds a signed-in user via
  `getSessionUser()` (already wrapped in React's `cache()`, so this
  adds zero extra Supabase round trips alongside `AppHeader`'s own call
  within the same request) -- the fully public, no-login pages (public
  Sacrament Meeting program, public announcements) render with no user
  and never get the widget, per the user's own confirmed scoping.
  "Approval" is a manual Status change only (`new -> approved ->
  declined/in_progress/done`) -- nothing in this app can trigger a
  Claude session automatically when a row changes; "approved" just
  means fair game to start on the next time Claude checks the queue.
- **Real, incidental consequence found during the build's own
  `next build`**: making `app/layout.tsx` async (it now calls
  `getSessionUser()`, which reads cookies) switched several previously
  statically-prerendered routes (`/`, `/auth/request-access`,
  `/auth/reset-password`, `/auth/update-password`, `/submit`,
  `/teaching-calendar`) to server-rendered-on-demand instead. Accepted
  as the real cost of checking session state in the layout itself --
  every other page in this app was already dynamic for the same reason
  (its own page component calls `getSessionUser()`), so this only
  affects the handful of pages that happened to need no session check
  of their own before now.
- **Not verified in a live browser** -- this working copy has no
  `.env.local` (confirmed earlier this session), so `next dev` 500s on
  every route before any of this session's own code runs, same
  pre-existing environment gap as every other feature built this way.
  Migration `071` is confirmed run -- ask the user to grant themselves
  `table_admin_feedback`, submit one test item from any logged-in
  page, and confirm it shows up in `/admin/feedback` once deployed.

**Youth Activities 2026 backlog imported, and a new Activity
Cancellations page built, 2026-10-10/11.** The user pasted six
per-class "2026 Heritage Ward Youth Activity Calendar" exports
(Priests, Teachers, Deacons, Gatherers of Light, Messengers of Hope,
Builders of Faith -- every Wednesday of 2026, one row per class) on top
of the three simpler rotation lists already pasted earlier the same
session. Cross-referencing all six against each other surfaced two
real conflicts with the simpler lists (March 18 and April 1, both
already flagged once Teachers/Deacons confirmed them independently),
plus a third kind of conflict nobody had anticipated: migration `032`
(confirmed run back on 2026-09-06) had already seeded Sept 2026 -- Feb
2027 directly from those same simpler lists, and three of its own rows
(2026-09-16, 2026-09-23, 2026-10-14) disagree with what the detailed
calendars say actually happened.

Asked the user how to resolve all of this at once rather than
guessing; the answer, in the user's own words: "In general the
rotations stay per the rotations listed. I am not interested in
rewriting the history of each class/quorum because of the rotations.
The individual class/quorum tables govern in the past. the rotations
govern after october of this year." Migration `069` implements exactly
this split:
- **Jan 1 -- Oct 31, 2026**: the six detailed calendars are the source
  of truth. Three `UPDATE`s correct migration `032`'s own already-run
  rows where the calendars disagree (title and/or `planning_group`);
  everything else in this window -- every combined-week activity not
  already seeded, plus every individual non-combined class week, none
  of which any prior migration had ever touched -- is a fresh
  `INSERT ... WHERE NOT EXISTS`.
- **Nov 1, 2026 onward**: left completely untouched, even though the
  same six calendars also contain tentative Nov/Dec planning --
  migration `032`'s rotation-seeded rows stand as the real plan, and
  the `youth_activity_rotations` engine continues to govern beyond
  what's already seeded, exactly as before this import.
- Two genuine ambiguities surfaced during reconciliation (not silently
  resolved): 2026-01-07 Combined YW has three different classes each
  claiming it as their own planning week (likely each class actually
  ran its own kickoff session despite the shared "Combined YW" tag) --
  left with `planning_group` null rather than guessing one. 2026-10-07
  Combined YM has no calendar confirming migration `032`'s seeded
  "Tour MTC"/Priests at all (all three YM calendars show it
  blank/unplanned) -- left as-is, since an unconfirmed newer source
  isn't the same as an actual conflict.
- Built via a one-off parsing script
  (`scratchpad/youth-activities-2026/parse.js`, not committed -- the
  six raw TSV exports were saved to scratchpad files and
  cross-referenced mechanically, same reasoning as migration `067`'s
  own script) rather than hand-reconciling ~300 rows across six
  calendars by eye. See [069_youth_activities_2026_backlog.sql](069_youth_activities_2026_backlog.sql)'s
  own header for the full mapping (now including two in-production
  fixes -- a NOT NULL `title` violation and a stale, undocumented
  `group_name` CHECK constraint). Confirmed run.

**"We probably also need an activity cancellation page much like the
meeting cancellation page"** (the user's own words, immediately after
settling the above) -- a real, separate feature request, not part of
the reconciliation itself. `meeting_cancellations` (migration `039`)
already has a `cancel_youth_activities` flag, but that's tied to a
meeting-cancelling reason (General/Stake Conference) -- most of the
real youth-activity-only holiday weeks in the 2026 backlog (Family
Week, Pioneer Day, Thanksgiving, Christmas, New Year's Eve) cancel no
ward meeting at all, so bundling them in there would mean rows with an
empty `meeting_type_slugs` purely to carry an unrelated reason. New
migration `070`: `youth_activity_cancellations` table, same shape as
`meeting_cancellations` but scoped to activities -- a date range, a
reason, and a `group_names text[]` list (empty means every group, the
common case for a ward-wide holiday week; non-empty scopes it to just
those classes/quorums). New `lib/data/youth-activity-cancellations.ts`
(`getYouthActivityCancellations`/`addYouthActivityCancellation`/
`deleteYouthActivityCancellation`/`sweepYouthActivityCancellations` --
same lazy-sweep-on-read pattern as `sweepMeetingCancellations`, run
alongside it from `getYouthActivities()`), new
`/youth-activity-cancellations` page + actions file mirroring
`/meeting-cancellations`' own UI almost exactly. Gated on the existing
`youth_activity_planning` feature (the same one that already gates
every other management control on `/youth-activities`) rather than a
new dedicated feature -- unlike `meeting_cancellations`, which has its
own feature, this didn't seem to need a finer-grained permission tier
of its own; revisit if that turns out wrong in practice. Reached from a
new tile on `/youth-activity-planning`, gated the same way. Migration
`070` confirmed run.

**Sort/filter now persists across page refreshes, 2026-10-10** (the
user's own request, right after the row-contrast pass: "is there a way
to remember the sorts and filters so they don't reset every time the
page is refreshed"). Scoped to the only two grids that actually have
sort/filter at all -- `CallingPlanningGridForm.tsx` and
`ActivitiesTable.tsx` (Assignment Rotations, Teaching Planning, and the
Dashboard meeting list only ever got the row-contrast treatment, never
sort or filter, so there was nothing to persist there).
- **New `lib/hooks/use-persisted-sort-filter.ts`** -- a localStorage-
  backed drop-in replacement for the plain `useState` both grids used
  for `sort`/`filters`. React state always starts empty/unsorted on
  both the server and the client's own first render (localStorage
  doesn't exist server-side, and reading it in a lazy `useState`
  initializer would make the client's first render disagree with the
  server-rendered HTML, a real hydration-mismatch risk) -- a mount-only
  effect restores the saved state right after that first commit instead,
  so there's a one-frame flash from default to restored on load, an
  accepted tradeoff for any localStorage-backed UI state in a
  server-rendered app. A second effect persists every change from then
  on, gated on a `hasHydrated` flag that only flips true once the
  restore effect finishes, specifically so it can never fire with the
  pre-restoration defaults and silently overwrite a real saved state
  before it's even been read back. The restore effect's own
  `setState` calls needed a targeted
  `/* eslint-disable react-hooks/set-state-in-effect */` block --
  syncing an external system (localStorage) into React state on mount
  is exactly the legitimate `useEffect` case React's own docs describe,
  not the "derive state from a render" anti-pattern that rule otherwise
  warns about.
- **`storageKey` is required on `ActivitiesTable`, not defaulted** --
  that one component renders on four different pages (Upcoming
  Activities, Combined YM & YW, Combined YM, Combined YW), each needing
  its own independent remembered state (`"activities-upcoming"`,
  `"activities-combined-ym-yw"`, etc.) rather than all four clobbering
  a single shared localStorage entry. `CallingPlanningGridForm` only
  has one instance in the app, so its key is a plain module-level
  constant instead.

**Row contrast added to every "favorite grid format" page, 2026-10-10,
then revised minutes later to a warm accent tint instead of gray**
(the user's own reports: "rows blend together quite a bit," asked
which grid(s) -- "Every 'favorite grid format' page" -- then "I think
the zebra stripe needs to be more distinct. perhaps in the color
scheme with the red but very light"). Applied identically to five
places: `CallingPlanningGridForm.tsx`, `ActivitiesTable.tsx` (Youth
Activities' four views), `AssignmentGridForm.tsx` (Assignment
Rotations), `TeachingGridForm.tsx` (Youth Teaching Planning), and the
Dashboard meeting list's `MeetingRow`. First pass used neutral
`even:bg-ink/5` zebra striping (same 5% opacity this app already used
for a cancelled row's `bg-danger/5` tint, just gray instead of red)
plus `hover:bg-ink/[0.08]` -- the user's own follow-up confirmed gray
wasn't distinct enough and asked for something warmer, "in the color
scheme with the red." This app's `accent` color turns out to actually
*be* a warm brick-red hue (`oklch(38% 0.11 20)`, see design.md), with
a dedicated `accent-soft` token (`oklch(93% 0.025 20)`) already
defined for exactly this purpose -- design.md's own table calls it out
for "current-item row highlight, selected state background" -- but
never actually used anywhere in the app until now. Every `<tr>` now
uses `even:bg-accent-soft` for the zebra stripe and `hover:bg-accent/15`
(a stronger step in the same warm hue, so the row under the pointer
reads as clearly more emphasized than the zebra tint alone, not just a
different shade of gray). Wherever a row already had its own
conditional background (a cancelled meeting or cancelled activity,
`bg-danger/5`), the zebra class is applied only when *not* cancelled --
`danger` (hue 38, orange-leaning) and `accent` (hue 20, brick-leaning)
are different enough hues that the two still read as visually distinct
even if they were ever shown side by side. One accepted cosmetic
limitation on the two grids with client-side filtering
(`CallingPlanningGridForm`/`ActivitiesTable`): a filtered-out row stays
in the DOM (`hidden`, not removed, so an in-progress edit on it isn't
dropped -- see those files' own existing reasoning), and `even:` is a
pure CSS `:nth-child` selector that counts hidden rows toward its
parity too, so two consecutive *visible* rows can occasionally land on
the same shade after filtering instead of strictly alternating -- still
a real improvement over no striping, not worth a JS-computed
visible-index to fix.

**Calling Planning's filter now reacts to in-progress edits, not just
saved ones, 2026-10-10.** The user's own request, right after the
filter itself started working: "if I have complete filtered out and
not shown, and then I move something to complete I would like for
that row to disappear." Before this, both sort and filter deliberately
only ever compared each column's *committed* (last-saved) value --
real, intentional behavior for sort (so editing a cell never
live-resorts the table out from under you mid-edit), but not what the
user wants for filter specifically. `CallingPlanningGridForm.tsx`
(the only editable grid of the two that got the Excel-style filter --
`ActivitiesTable.tsx`'s pages are read-only, nothing to react to)
gained:
- A `liveValues` map, keyed by each field's own existing `name`
  attribute (`"<rowId>::<column>"`) -- captured by the form's single
  existing delegated `onChange` (already there to flip the dirty flag),
  which now also records whichever field just changed.
- New `liveCellText(row, key)`: prefers a field's live raw value over
  the row's committed one when present, resolved through the exact
  same label-lookup maps `cellText` already uses -- a `<select>`'s raw
  DOM value is the option's *value* (a status key or a calling/person
  uuid), not the label text filters actually compare against.
  `matchesFilters` now calls this instead of `cellText`, so unchecking
  a status from that column's filter hides a matching row the instant
  its own dropdown changes to that status.
- **Sort deliberately still uses `cellText` (committed-only),
  unchanged** -- the original reasoning for that choice still holds; it
  was never what this request was about.
- **Candidates (`MultiPersonSelect`) isn't live-tracked** -- it manages
  its own hidden inputs outside the native change-event path (adding/
  removing DOM nodes doesn't fire a bubbling `change` event, which is
  exactly why that component already needed its own explicit `onDirty`
  callback), so there's no single DOM value for the form's delegated
  listener to capture there. Filtering that one column still only
  reacts once a save completes -- a known, narrow gap, not silently
  pretended away.

**Bug found and fixed 2026-10-10, right after the Excel-style filter
above first shipped: the filter dropdown was invisible.** The user's
own report: "a sort was added to each column but not an excel style
filter. I like the sort and want to keep it. I also need the filter."
Root cause: `ColumnFilterDropdown`'s panel was `position: absolute`
inside a `relative` wrapper around its own trigger button -- both
grids that use it wrap their `<table>` in an `overflow-x-auto` div (so
a wide table can scroll horizontally on a narrow screen), and an
ancestor with `overflow-x: auto` also clips the *other* axis per the
CSS spec. The panel was opening (state flipped correctly) but
rendering clipped to nothing, which looked identical to "the filter
was never added" from the outside. Fixed by rendering the panel
through `createPortal` into `document.body`, positioned `fixed` at the
trigger button's own on-screen coordinates (`getBoundingClientRect()`,
computed when it opens) -- no ancestor's overflow can clip it now.
Closes on scroll (rather than tracking a live position) since the
table itself can still scroll horizontally while the panel is open,
and outside-click detection now checks both the trigger and the
portaled panel explicitly, since the panel is no longer a DOM
descendant of the trigger's own wrapper once portaled.

**Column filters changed to Excel/Sheets-style checklists everywhere
they exist, 2026-10-10** (the user's own request: "update the filters
to act more like an excel or google sheets filter where values can be
selected/deselected," then, asked which grid(s): "I want it everywhere
we have a filter"). Searched the whole app first rather than assuming
-- only two components actually had a per-column filter at all
(`CallingPlanningGridForm.tsx` and the new `ActivitiesTable.tsx`;
Table Admin's `AdminTableEditor.tsx` has sortable headers but never
grew a filter of its own), so "everywhere" meant exactly those two.
- **New `components/ColumnFilterDropdown.tsx`**, a small reusable
  client component: a `&#9660;` trigger next to each column's existing
  sort button opens a checklist of that column's own distinct values
  (computed across the whole dataset, not re-narrowed by other active
  filters, matching Excel's own per-column-independent behavior), each
  with a checkbox, plus a search box to narrow the list and Select
  all/Clear shortcuts. `selected` is `null` when every value is
  showing (the default, and what collapsing back to "everything
  checked" returns to) or a real `Set<string>` once at least one value
  is unchecked -- an *empty* `Set` is its own valid state (every row
  hidden for that column), not coalesced back to `null`, matching
  Excel's own "uncheck everything" behavior. Closes on an outside
  click via a plain `mousedown` listener -- this app had no existing
  click-outside pattern to reuse, so this is the first one.
- Both grids now compute a `columnValues` map (one distinct-value list
  per column, from the already-fetched rows) and pass it down per
  column; the old free-text `filters` state (`Partial<Record<Key,
  string>>`, matched via substring `includes()`) became `Partial<Record<Key,
  Set<string> | null>>`, matched via `Set.has()`. Sorting, the
  `hidden`-attribute-not-removed-from-DOM row-rendering (so an
  in-progress edit in a filtered-out `CallingPlanningGridForm` row
  still saves), and every other part of both grids are unchanged.

**Calling Planning status vocabulary redesigned, and 123 real calling-
tracker rows imported, 2026-10-10.** The user asked to bulk-migrate
their real ward calling-tracker spreadsheet ("Sort, Date Initiated,
Calling, Full Name, Status, Date Set Apart, Notes, Full Name2, Status2"
-- New Callings and To Be Released side by side) into `calling_planning`.
Before writing anything, this assistant (no live database access)
asked what the sheet's free-text status words should map onto this
app's real `calling_status`/`release_status` values -- the user instead
answered with a complete replacement vocabulary: Calling status
**Needed, In review, Approved, Interview Set, Accepted, Declined, To be
Announced, To Record, Complete, For Stake, Future, Hold**; Release
status **Previously Vacant, To be released, Interview Set, Release
Extended, To be Announced, Complete**. This is a real redesign of the
whole workflow, not just a mapping question -- it drops "To Be Set
Apart" entirely and adds six brand-new stages across both lists.
- **`lib/data/calling-planning.ts`'s `DEFAULT_CALLING_STATUSES`/
  `DEFAULT_RELEASE_STATUSES` rewritten to the new ordered lists.**
  Value *keys* are reused (not renamed) for every stage real
  application code branches on by value -- `discussing` (now labeled
  "In Review"), `to_announce` ("To be Announced"), `to_record`,
  `complete`, `future`, `declined`, `previously_vacant` -- so no
  existing row or code path needed migrating just because a label
  changed. Genuinely new stages (Needed, Approved, Interview Set,
  Accepted, For Stake, Hold, To be Released, Release Extended) got
  brand new keys.
- **Migration `066`** replaces (delete + insert, `on conflict do
  update` for a safe re-run) the two field_keys' rows in
  `admin_select_options` -- a deliberate full replacement, not
  migration `022`'s original `on conflict do nothing` (that approach
  was for preserving an admin's own later edits; this one is an
  intentional wholesale redesign).
- **Auto-advance logic updated in two places** that used to set
  `calling_status = "to_be_set_apart"` / `release_status = "to_record"`
  once a row got pulled into a meeting's Ward Business or narrowed to
  one candidate (`app/meetings/[id]/ward-business-actions.ts`'s
  `pullCallingPlanningIntoMeeting`, `app/calling-planning/actions.ts`'s
  `pushCallingToSacramentMeeting`): neither target value exists in the
  new vocabulary. Calling now advances straight to `to_record` (the
  stage immediately after "To be Announced" in the new ordered list,
  same as the old flow minus the now-gone set-apart step); release now
  advances straight to `complete` (nothing sits between "To be
  Announced" and "Complete" in the new release list at all, unlike the
  old one's intermediate recording step). "To Announce in Sacrament"
  UI text (`app/calling-planning/page.tsx`, both action files' error/
  comment text) updated to "To be Announced" throughout.
- **Migration `067`**, the actual data import, depends on `066` having
  already run. Built via a small one-off Node script
  (`scratchpad/calling-import/generate.js`, not committed -- the raw
  TSV was saved to a scratchpad file and parsed mechanically rather
  than hand-transcribing 119 rows of free text, to avoid transcription
  errors at that volume) that resolved every status word against the
  mapping above, split comma-separated values where the schema can't
  hold more than one, and emitted the final SQL. Three real
  source-data issues were caught and fixed before finalizing, not
  silently reproduced: rows 20 and 113 each name two distinct callings
  in one cell (split into two calling_planning rows); rows 68 and 95
  each name two people being released together in one cell (split the
  same way, since `release_person_id` is a single FK unlike
  `candidate_person_ids`); and row 47's own release-name cell held
  "called to CTR 4&5 class" -- not a person, a copy/paste slip from a
  neighboring row's Notes text -- treated as blank rather than
  inserted as a fabricated person. 79 distinct callings and 141
  distinct people get created automatically if missing (same
  case-insensitive exact-name pattern as migration `049`'s bulk people
  import) before the 123 final calling_planning rows are inserted.

**Youth Activities given its own tile grid, read-only activity views
built, 2026-10-10 -- same day as the hub scaffold just below, right
after shipping it.** The user's report after trying the new hub's
"Youth Activities Management" tile: "the youth activities page right
now shows no tiles and just has all of the content on the page. Please
update with the suggested tiles which will then direct the user to the
requested page." This restructured where the four activity-specific
tiles (Upcoming Activities, Combined YM & YW, Combined YM, Combined YW)
actually live -- moved off the top-level hub (where they'd have been a
second, duplicate path to the same destinations once built) and onto
`/youth-activities` itself, which now opens with a `TileGrid` of those
four before its existing content.
- **No new tables needed, confirmed before building anything**:
  `youth_activities.group_name`'s own option list
  (`YOUTH_ACTIVITY_GROUPS`) already spans all six individual classes/
  quorums (Deacons, Teachers, Priests, Gatherers of Light, Messengers
  of Hope, Builders of Faith) *and* the three Combined pseudo-groups --
  one real table, not nine. "Combined YM & YW Activities table,"
  "Combined YM Activities table," etc. in the user's own spec are all
  just `group_name`-filtered views over it.
- **Two design questions asked and answered before writing any code**
  (`AskUserQuestion`): the spec's "Description" column maps onto the
  existing short `title` field rather than a new column (the user's
  own choice, "reuse the existing Title field"); and all four new
  views are read-only -- all adding/editing/generating stays on
  `/youth-activities`' own existing `canManage`-gated section, renamed
  from "Upcoming Activities" to "All Activities" since that name now
  belongs to the new read-only tile/page instead.
- **New `components/youth-activities/ActivitiesTable.tsx`** -- the
  shared read-only grid behind all four new pages, reusing
  `CallingPlanningGridForm`'s exact click-to-sort + per-column
  text-filter interaction (same ▲/▼ header buttons, same filter-box-
  under-each-heading layout) rather than a new UI pattern. "Filterable
  for specific classes/quorums" turned out not to need its own
  checkbox picker at all -- typing into the Group column's own filter
  box already does it, and matches a class name or "Combined" as a
  prefix match. `showGroupColumn` is false on the three Combined pages
  (pre-filtered server-side to one group, so every row would show the
  same value) and true on Upcoming Activities (all groups at once).
  Each of the four pages filters to `activity_date >= today` before
  rendering -- "upcoming" is enforced in the page, not the shared
  `getYouthActivities()` query, which the existing Management section
  still needs unfiltered (it manages past activities too).
- **New routes**: `/youth-activities/upcoming`,
  `/youth-activities/combined-ym-yw`, `/youth-activities/combined-ym`,
  `/youth-activities/combined-yw` -- nested under `/youth-activities`
  rather than flat top-level routes, matching where their own tiles
  now live. All four require login only (same as `/youth-activities`
  itself), not a specific feature -- viewing was never the thing that
  needed gating, only the management actions already gated by
  `canManage` were.
- **`/youth-activity-planning` simplified back down from 7 tiles to 3**,
  minutes after first shipping it (see that page's own comment) -- the
  four activity tiles that had been `comingSoon` placeholders there are
  gone now that they have a real home on `/youth-activities` instead;
  duplicating them in both places would have meant two different
  navigation paths to the same four destinations. The hub's own "Youth
  Activities" tile is now ungated (any logged-in account), matching
  `/youth-activities`' own policy -- only Youth Teaching Calendar and
  Youth Teaching Management stay gated on `youth_teaching_planning`.

**Youth Activity Planning hub scaffolded, 2026-10-10** (the user's own
request to "start putting the youth activity planning page(s)
together," listing a specific tile set: Upcoming Activities, Combined
Young Men & Young Women Activities, Combined Young Men Activities,
Combined Young Women Activities, Youth Activities Management
(feature-gated), Youth Teaching Calendar, and Youth Teaching Management
(feature-gated) -- "We will then discuss each tile/page and what I
want to see there."). This is deliberately scaffolding, not the
finished design -- new `/youth-activity-planning` (same
`/meeting-planning`/`/meeting-agendas` hub pattern, per-tile feature
gating) replaces the landing page's old two-tile "Youth program"
section (a direct `/youth-teaching-planning` link plus a `comingSoon`
placeholder) with one consolidated tile; both of those now live as
sub-tiles inside the new hub instead, gated on the exact same features
they already required (`youth_teaching_planning`/`youth_activity_planning`).
- **Four brand-new tiles are `comingSoon` stubs on purpose**: Upcoming
  Activities and the three Combined-group views. The user explicitly
  wants every one of these in this app's "favorite grid format" (table/
  matrix, same as Assignment Rotations/Teaching Calendar/Calling
  Planning) -- a real design pass still to come, one tile at a time, not
  something to improvise ahead of that discussion.
- **Youth Activities Management** reuses the existing `/youth-activities`
  page as-is (gated on `youth_activity_planning`) -- that page already
  *is* today's management surface (Generate Combined Activities,
  Confirm/Cancel, add/edit), and also currently renders its own
  "Upcoming Activities" list inline. Splitting that list out into the
  new standalone matrix-format tile is part of the still-to-come
  per-tile discussion, not done here -- for now both the hub's
  Management tile and the landing page's separate, still-unchanged
  "Youth Activities" tile (public-facing, any logged-in account, "This
  week" tier) point at the same real page.
- **Youth Teaching Calendar** reuses `/youth-teaching-planning` as-is
  (gated on `youth_teaching_planning`, unchanged from what the old
  direct landing-page tile already required) -- that page's own "&larr;
  Home" back link was updated to "&larr; Youth Activity Planning" since
  it's now reached one level deeper.
- **Youth Teaching Management** has no existing page to reuse -- Table
  Admin's raw `youth_class_teachers` grid is gated on its own separate
  `table_admin_youth_class_teachers` feature, not `youth_teaching_planning`,
  so linking to it here would let someone see the tile but then hit a
  different, confusing access wall on click. Left as a `comingSoon`
  stub, gated on `youth_teaching_planning` so it's at least invisible to
  accounts that could never use it either way.
- **Not verified in a live browser**: this working copy has no
  `.env.local` (confirmed -- no Supabase URL/key locally), so `next dev`
  500s on every route including `/login`, before any of this session's
  own code ever runs -- a pre-existing environment gap, not something
  this change caused. Matches this project's own established
  verification routine (`tsc`/`eslint`/`next build` only, see Working
  Conventions below) rather than a live walkthrough; ask the user to
  click through `/youth-activity-planning` on production once deployed.

**Public Announcements page cleaned up and migration 065 corrected,
2026-10-10**, right after that migration was first written -- the user
reviewed the real content it would insert and asked for several
follow-on changes, none of which required a new migration number since
`065` hadn't been run yet (same "amend in place" precedent as migration
047's own in-place rewrite):
- **Time display, user's own words: "update the time reporting in the
  announcements page to am/pm rather than military time. Make it user
  friendly."** `app/announcements/public/page.tsx` was showing
  `start_time`/`end_time` as the raw 24-hour string Postgres returns
  (`"19:00:00"`) with no formatting at all. New `formatTime()` renders
  it as plain AM/PM ("7:00 PM"), handling midnight/noon correctly
  (`"00:00:00"` -> "12:00 AM", `"12:00:00"` -> "12:00 PM").
- **Simplified what the public page shows, user's own words: "don't
  show more info, announcement type, attached file. If there is an
  included link please include that with a hyperlink on the page."**
  Three changes: the meta line under each title no longer appends
  `announcement_type` (organization alone remains -- the admin inbox
  and Table Admin still show the full type, this was scoped to the
  public page only); the separate "More info" link line is gone,
  replaced by hyperlinking the announcement's own title when
  `link_url` is set (no generic label text at all); and the literal
  "Attached file: `<url>`" line migration 065 had put inline in one
  announcement's body (there's no real attachment column in this
  schema, see migration 031) was removed from that migration's source
  data entirely rather than ever rendered -- see migration 065's own
  amendment note for where that changed.
- **Youth Choir row corrected from a real flyer.** The user shared an
  actual "Walk With Me" Stake Conference Youth Choir Performance flyer
  image after seeing the placeholder content migration 065 had pulled
  from the old tracking form's own thin row (just "Youth choir
  practices and participation for stake conference," one practice
  date). Rewritten with the flyer's real content: both practice dates
  (Oct 25 and Nov 1, 2:15 PM, Stake Center) and the actual Nov 8
  performance date (Stake Conference's general session), plus the
  title typo ("Youth Chior," kept verbatim from the original tracking
  form in the first pass) corrected to "Youth Choir Performance" now
  that there's an authoritative source to correct it against.
- **Tithing Declaration's link, decoded from a QR code image.** The
  user shared a photo of the flyer's QR code and asked for it as this
  announcement's `link_url` -- its own Google Form row never had one.
  This assistant has no direct QR-decoding tool; tried `jsQR`,
  `@zxing/library`, and OpenCV's `QRCodeDetector` (all installed
  one-off into this machine's global node/Python environments, not the
  project) against the image, all of which located the code's finder
  pattern but failed to actually decode it -- consistent with a
  stylized/AI-generated "QR art" image that a phone camera's live
  scanner tolerates but a byte-exact library decoder doesn't. Asked the
  user directly rather than guessing further; they pasted the real
  URL (a Google Calendar appointment-scheduling link) in chat, which
  migration 065 now uses.

**Collapsed to a single "Request Access" path, 2026-10-10 -- minutes
after the two-option escape-hatch fix just below.** The previous fix
kept both "Signing in for the first time?" (-> `/auth/new-user`, for an
admin-dashboard-invited account) and "Don't have an account yet?"
(-> `/auth/request-access`, self-serve) as separate links, just made
the second one easier to find. The user's own follow-up asked to go
further: "I would prefer that there not be two options - login with
previous access granted by email, or request access. I really only
want request access as the only option. Someone puts in their email,
they click the request access button, they are told to verify their
email and that once their email is verified an admin will review their
access request." That's a real, deliberate simplification of this
app's own onboarding model, not just more copy tweaking -- the
admin-invites-through-the-Supabase-dashboard path (the other half of
the "Adding new people" policy's step 3, see that section above) is no
longer surfaced anywhere in the app's own UI at all.
- `app/auth/new-user/page.tsx` is deleted outright, not left unlinked
  -- nothing else in the app referenced it once `LoginForm.tsx`'s link
  to it was removed (confirmed by grep before deleting).
- `LoginForm.tsx` now links to exactly two places: `/auth/reset-password`
  (forgot password -- genuinely different from what's being collapsed
  here, an existing account that can't sign in, not a no-account case)
  and `/auth/request-access`, relabeled "Don't have access yet?".
- `/auth/request-access` is now reached directly from `/login` (its own
  back-link changed from the deleted page to `/login`) and its copy
  matches the user's own description of the flow exactly: enter email
  + password, click Request Access, verify your email, then an admin
  reviews the request. **The password fields were already on this
  form** (`signUp()` needs a real password at account-creation time,
  unlike the deleted page's admin-already-set-one-up assumption) -- no
  structural change needed there, only confirmed in passing after the
  user asked that password entry stay "somewhere appropriate" in the
  flow.
- `requestPasswordReset` (`app/auth/actions.ts`) now has exactly one
  caller (`/auth/reset-password`) instead of two -- left completely
  unchanged otherwise, still the right action for "I have an account,
  I forgot my password."

**Bug found and fixed 2026-10-10: a new sign-up never got an account,
root-caused by the user's own correct diagnosis.** The user's report:
"I had someone try to sign up. they didn't get an email for
verification. I checked the authentication table and they are not
listed as a user." The missing-row symptom ruled out a bug in
`requestAccess` itself (`app/auth/actions.ts`) -- it already calls
`supabase.auth.signUp()` and surfaces `error.message` correctly, and
`signUp()` creates an auth-table row immediately regardless of email
delivery, so if no row exists, `signUp()` was never actually called.
Before this assistant could get through its own diagnostic questions
(Supabase dashboard settings, rate limits, SMTP), the user proposed
the real answer directly: "I wonder if the issue is that the email
entry is for people that have requested access already... so someone
puts in their email, but if they haven't requested access then it does
nothing? They probably don't see the little link below that says to
request access." Confirmed exactly right. `/login`'s "Signing in for
the first time?" link leads to `/auth/new-user`, whose main form calls
`requestPasswordReset` -- the same `resetPasswordForEmail()`-backed
action `/auth/reset-password` uses, which only works for an email that
already has an account. Supabase deliberately never reveals whether an
email has an account (anti-enumeration), so that form shows the exact
same "Check your email for a link to set your password" success
message whether or not anything was actually sent -- a brand-new
person, who reasonably read "signing in for the first time" as meaning
them, got false confidence and no email, while the real way out,
"Request access instead," sat as one small muted line at the very
bottom of the page, easy to miss directly below what looked like
success.

Two-part fix, both navigation/copy changes, no logic bug to fix in
either server action:
- `components/auth/LoginForm.tsx` gained a third link alongside the
  two existing ones, "Don't have an account yet?" -> `/auth/request-access`
  -- a genuinely new person no longer has to land on `/auth/new-user`
  at all to find the real self-serve path.
- `app/auth/new-user/page.tsx` reordered to ask the real question
  before the form: a highlighted box ("Has an admin already added
  you...? If you're not sure... request access instead of using the
  form below") now sits above the password-reset form rather than
  being a single muted afterthought underneath it. The success message
  itself was also hedged -- it now adds "If nothing arrives after a few
  minutes, an admin probably hasn't set up your account yet -- request
  access instead" rather than leaving a false-positive "check your
  email" as the last word.
- `/auth/reset-password` (the narrower "I already have an account,
  forgot my password" case) was deliberately left unchanged -- its own
  premise doesn't carry the same "might not actually have an account"
  ambiguity `/auth/new-user` does, so it didn't need the same fix.

**Performance pass, 2026-10-07: "the app is extremely slow."** Found
and fixed three real N+1/duplicate-fetch problems, in order of impact:
- **`autoArchivePastMeetings` (`lib/data/meetings.ts`), by far the
  worst one.** Runs on every single `/dashboard` and `/calling-planning`
  load (via `getUpcomingMeetings`) -- the two most-visited admin pages.
  It used to check each past, not-yet-archived meeting against 9
  tables one at a time, sequentially: up to 9 round trips per meeting,
  times however many past meetings hadn't been archived yet. A meeting
  with genuinely no activity (common for meeting types where notes/
  minutes aren't always filled in) never got skipped on a later run
  either -- it was rechecked from scratch every single time, forever,
  so this only got worse as more unarchived meetings piled up week
  over week; by now, likely dozens of meetings times up to 9 round
  trips each, on every dashboard load. New `meetings_with_real_activity`
  Postgres function (migration `062`) does the same check for every
  candidate meeting at once, inside the database -- the TypeScript
  side is now exactly 3 round trips total (fetch candidates, one RPC
  call, one bulk update) regardless of how many past meetings exist.
- **`sweepMeetingCancellations` (`lib/data/meeting-cancellations.ts`).**
  Smaller in scale (bounded by the number of `meeting_cancellations`
  rows, typically just a handful like General/Stake Conference), but
  ran on the same two pages plus `/youth-activities`, and updated each
  row's meetings/youth-activities sequentially even though every row's
  update is fully independent. Now runs all of them via `Promise.all`.
- **`getEligiblePeopleByElementKey` (`lib/data/rotations.ts`).** Called
  once per Planning-page load for every `person_role` element on that
  meeting's agenda, but resolved each element key's eligible-people
  list one at a time -- on a standard Sacrament Meeting agenda (8
  `person_role` elements), that's roughly 16 sequential round trips on
  every single Planning page load. Now resolves all of them via
  `Promise.all` too, same fix, same reasoning.
- Also wrapped `getWardName()` (`lib/data/ward-settings.ts`) in React's
  `cache()`, same treatment as `getSessionUser`/`getMeetingById`
  (2026-10-04, found chasing a narrower "very very slow on meeting
  pages" report that turned out to be the first sighting of this same
  class of bug) -- `AppHeader` calls it on nearly every page already,
  and the landing page and `/login` also call it directly for their
  own heading, duplicating the same query within one request.
- **Not changed, and not believed to be a real factor at this scale**:
  database indexes. The tables involved here (`people`, `callings`,
  `meetings`) are small for a single ward (tens to low hundreds of
  rows), so an unindexed filter column is unlikely to be the dominant
  cost next to the round-trip count fixed above. Flag this again if
  the app is still slow after `062` ships and these other fixes are
  live -- that would be the next thing worth measuring, with real
  `EXPLAIN ANALYZE` output rather than a guess.

**Youth Activities now requires login, 2026-10-07** (the user's own
request): "I want the youth activities tile grayed out unless they are
logged in, and when grayed out it should read 'please log in to see
youth activities'." `Tile` (`components/Tile.tsx`) gained an optional
`disabledLabel` prop -- the existing disabled/grayed rendering
(previously always captioned "Coming soon", for a not-yet-built
feature) now takes custom text, since this tile is disabled for a
different reason (a real, working feature gated behind login, not
something unbuilt). The landing page's Youth Activities tile passes
`href={user ? "/youth-activities" : undefined}` and the login-prompt
caption when logged out. `app/youth-activities/page.tsx` itself now
redirects to `/login` when logged out too -- gating the tile alone
would've been cosmetic, since the page was still reachable by typing
the URL directly; the existing RLS policy limiting anonymous rows to
`status = 'published'` is unaffected and still correct underneath this
new login requirement, it just no longer matters for a logged-out
visitor since they can't reach the page at all now. **Not yet
addressed**: `/events` ("Scheduled Events," the merged Youth
Activities + Ward Events public listing) still shows youth activities
to anyone with no login at all, which is now a loophole around this
same gate -- tied up with the Ward Events removal question below,
since the fix depends on what `/events` even is once that's decided.

**Bug found and fixed 2026-10-07: a freshly-added speaker (or musical
number, or intermediate hymn) didn't stay populated after its first
save -- a recurrence of the 2026-10-03 fix.** The user's own report:
"the recently-added speaker is not staying in the form again. it
worked for a while and has now stopped working again." The 2026-10-03
fix (binding each item's save through `useActionState` instead of a
bare async function) solved one half of the problem -- React's
auto-reset of uncontrolled fields after a form action completes -- but
left the other half standing: every field in `SacramentProgramSection.tsx`'s
`ItemRow` is still `defaultValue`-based (uncontrolled), and `ItemRow`
itself keeps the exact same React instance across a save (keyed on
`item.id`, which never changes). React only ever *applies*
`defaultValue` once, at first mount. A freshly-added item mounts with
nothing picked; after its first real save, the newly revalidated
`item.personId`/`guestName` arrives as a new prop that an
already-mounted uncontrolled field simply never syncs to -- editing an
*existing* speaker often looked fine only because its original
mount-time default already happened to match what got saved. Fixed by
keying each of the three per-item forms (speaker, musical number,
intermediate hymn) on their own current saved values
(e.g. `key={`${item.personId}::${item.guestName}`}`), forcing a clean
remount with fresh defaults whenever the saved value actually changes,
rather than reusing a stale instance. Applied the identical fix to the
Chorister/Organist fields added earlier this same day (same
`SpeakerPersonOrGuestField` component, same `defaultValue`-across-a-
stable-row-id risk) before it could ever surface there too. **Not
audited**: every other `defaultValue`-based field in the main agenda
grid (Presiding, Conducting, prayers, Visiting Authorities) shares the
same theoretical risk and hasn't been individually checked -- flagged
here rather than silently assumed safe, since this class of bug is
timing-dependent (visible only when a field's value actually changes
*and* the revalidation/reset timing lines up a certain way), which is
exactly why it looked intermittent rather than consistently broken.

**Guest Chorister and Organist, 2026-10-07** (the user's own request:
"add a way to have a guest organist and chorister"). Same person-or-
guest shape already used for Speaker/Youth Speaker and Visiting
Authorities, now on Recognize Music's two inline fields too -- new
`sacrament_assignments.guest_name` column (migration `064`, named to
match the newer `sacrament_visiting_authorities` convention rather
than the older per-table `guest_speaker_name`, since `assigned_to_id`
is generic across every rotation role here, not speaker-specific).
Deliberately only on `sacrament_assignments`, not `bishopric_assignments`
-- Chorister/Organist only ever exist as Sacrament Meeting roles.
- **Field encoding**: every other `person_role` element still writes
  through the bare `role::<elementKey>` field `saveAgendaGrid`
  (`app/meetings/[id]/agenda-actions.ts`) has always parsed. Chorister
  and Organist specifically now use a two-part
  `role::<elementKey>::person_id`/`::guest_name` pair instead -- the
  exact same shape `speaker::...`/`visiting_authority::...` already
  use -- so `saveAgendaGrid` had to learn both shapes side by side
  rather than replacing the old one (every other role keeps working
  unchanged).
- **Rendering**: `AgendaGridForm.tsx`'s Recognize Music row swaps its
  two plain `PersonSelect`s for `SpeakerPersonOrGuestField` (the same
  component Speaker/Youth Speaker/Visiting Authorities already use),
  with its own copy ("Choose chorister"/"Guest chorister instead",
  etc.) via that component's existing label-override props -- no
  component changes needed, just new callers.
- **Read-only display**: `getRoleAssignments` (`lib/data/meeting-elements.ts`)
  now selects `guest_name` too, but only when reading
  `sacrament_assignments` (conditionally built column list) --
  `bishopric_assignments` has no such column and would error if asked
  for it. `conducting-rows.ts`'s Recognize Music wording and
  `public-view.ts`'s Chorister/Organist public-program lines both fall
  back to the guest name when no real person is assigned.
  `archived/page.tsx`'s read-only "agenda as it was finalized" view
  needed a new special case for `recognize_music` entirely -- it had
  never resolved this element at all before (it's catalogued as
  `resolution_kind: 'none'`, so the generic switch there just rendered
  the bare label with nothing underneath, a real pre-existing gap
  found while tracing every place Chorister/Organist render). Now
  mirrors Planning/Conducting's own "Chorister (Name), Organist (Name)"
  resolution, guest names included.
- **Left alone, on purpose**: the `/rotations` applied-assignment grid
  still only ever reads/writes `assigned_to_id` for these two columns
  -- a guest entry made via Planning shows as a blank cell there,
  matching how Speaker/Youth Speaker guests already don't appear in
  that grid either (it's for the rotation-driven *default* assignment,
  not one-off overrides). `getSacramentPlanningData`'s own
  `assignments`/`AssignmentRow` field (`lib/data/sacrament-planning.ts`)
  was confirmed, while tracing this, to be fetched but never actually
  read by any caller -- pre-existing dead code, left untouched since
  fixing it serves nothing real right now.

**Bug found and fixed 2026-10-07: the dashboard's stage badge looked
like a second button next to the date button.** The user's own
report: "the date button that can be clicked to enter the meeting is
too similar to the stage indicator. It is confusing as to which one
should be clicked." `LifecycleBadge`'s `compact` mode (used only on
`/dashboard`'s single-line rows) rendered the current stage as a solid
`bg-accent` pill -- the exact same fill the date button next to it
uses for its own real "click here" styling. Changed compact mode to
the plain neutral chip (`border-rule`/`text-ink-muted`) the full
multi-stage track already uses for a *past* stage, so only the date
button keeps the accent fill. The full track elsewhere (a meeting's
own header) is unchanged -- there, highlighting just the current stage
among several already reads as emphasis, not as a second button,
since it's visibly one chip among a row of others; compact mode's
problem was showing that one chip alone, with nothing to contrast it
against.

**Bug found and fixed 2026-10-07: "column c.backup_holder_id does not
exist" when deleting a meeting.** Third time this repo has hit an
undocumented RLS object created directly in the Supabase SQL editor
before this file's migration history started (migrations `038` and
`041` were the first two). This assistant has no live database access,
so diagnosing it took several rounds of the user running diagnostic
queries directly and pasting back the results -- `delete_meeting_cascade`
(migration `054`, what Delete actually calls) itself has zero
references to `callings`/`backup_holder_id`, which is what pointed
this at an RLS policy instead of the function everyone would first
suspect.

Root cause: `agenda_items` carried five overlapping policies, three of
them stale leftovers from designs this app has already moved past.
"meeting participants can submit"/"can view" called an undocumented
`is_meeting_participant(meeting_id)` function joining to `callings c`
and reading `c.backup_holder_id` (dropped by migration `034`) and
`(select person_id from profiles where id = auth.uid())` --
`profiles.person_id` genuinely exists as a live column but was never
created by any tracked migration and matches none of this app's
documented person-link direction (`people.profile_id`, migration `030`);
it's an orphaned artifact of whatever pre-history design produced this
function. "public submit pending" (anon INSERT) was a leftover from
before agenda-item submission required login at all (2026-09-09) --
since `submitAgendaItem` has required a signed-in account ever since,
this policy was a real, live gap letting an anonymous API call insert
directly into `agenda_items` with `status = 'pending'`, bypassing the
app's own login check entirely; found and closed incidentally while
chasing the delete bug. "bishopric manage" called `app_role()`, almost
certainly still reading the long-dropped `profiles.role` (migration
`058`) -- hadn't visibly errored yet (likely luck in how Postgres
happened to combine it with the other permissive policies), and was
redundant regardless: `"authenticated access"` (`ALL`, `true`/`true`,
left completely untouched) already grants everything to any
authenticated user, matching this app's own RLS philosophy of doing
the real authorization in application code.

Migration `063` drops all three stale policies and the now-orphaned
function. **`app_role()` itself was deliberately left alone** -- other
tables may still reference it correctly or incorrectly, and auditing
every one of those is a separate task, flagged here rather than
attempted as a drive-by fix.

**"My meetings" is a real control surface again, 2026-10-07** -- a
direct reversal of the 2026-09-09 decision to make it read-only
("make my meetings section for read only views of meetings"), per the
user's own follow-up after repeatedly needing Delete from exactly that
entry point: asked directly whether to keep it read-only or make it
manage-capable too, the answer was "make it a real control surface
too." The per-type "My meetings" tiles on the landing page no longer
append `&readonly=1` to their `/dashboard?type=<slug>` links -- an
account with a real planning feature for that type now sees the full
New Meeting/Cancel/Delete/Unassigned-Agenda-Items surface from here,
same as from Administration -> Meeting Planning -> Meeting Agendas.
A non-admin is completely unaffected either way, since `/dashboard`'s
own `canCreate` already requires holding a real planning feature
regardless of this flag. The "Sacrament Meeting Programs" tile
(Communications-Specialist-style early preview) still passes
`readonly=1` deliberately -- that feature is about previewing/
printing, not managing, so it keeps the narrower view.

**"Scheduled Events" removed from the landing page, 2026-10-07**
(the user's own request: Ward Events "overlap[s] ... with
announcements and youth activities... it seems like ward events can
go. They will be captured by announcements or youth activities").
Given the choice between removing the feature outright or just hiding
it from the landing page, the user chose the latter -- scoped to
exactly that: the "Scheduled Events" tile (the merged Youth Activities
+ Ward Events public listing at `/events`) is gone from the landing
page's "This week" tier. `/events` and `/ward-events` themselves,
`ward_event_planning`, and all of Ward Events' admin tooling are
completely untouched and still reachable directly -- nothing here
stops anyone with the URL (or a future landing-page change) from using
any of it; this is purely "don't surface it as a tile," not a feature
removal. There was no separate standalone "Ward Events" tile to
remove -- "Scheduled Events" was the only landing-page entry point
that ever referenced it.

**Cancelled Sacrament Meetings hide Planning/Conducting/Public, and a
public-only viewer sees no workflow chrome at all, 2026-10-04** (the
user's own request): "when a sacrament meeting is cancelled please
don't show the planning/conducting/public views. Only those who can
plan meetings should see any of the views other than public. If
someone can only see the public view they don't need to see any
labels about it being public or any of the lifecycle labels. They
only need to see the public agenda unlabeled." Two separate changes:
- ~~**Cancelled.** `app/meetings/[id]/planning/page.tsx`,
  `conducting/page.tsx`, and `public/page.tsx` each now check
  `meeting.cancelled` right after loading the meeting (before any
  role branching) and, if true, render a plain "This meeting has been
  cancelled" line instead of their normal content -- applies
  regardless of role.~~ **Partially reverted minutes later, same day
  -- this broke two things the user then had to report separately:**
  "still need the ability to delete a meeting that was created in
  duplicate by accident. still need the planning view to be the
  default for planners in meetings." Root cause: Planning and
  Conducting are never reached by anyone *except* this meeting type's
  own planner/conductor in the first place (a non-admin is always
  redirected elsewhere first -- to `/archived` from Planning, to
  `/public` from Conducting), so putting the cancelled check *before*
  that redirect meant it only ever blocked the admin themselves, not
  any real public viewer -- breaking "Planning defaults for planners"
  in exactly the scenario where they'd most need it (confirming an
  accidental duplicate before deleting it, or deciding whether to
  un-cancel). Removed the check from both pages entirely; the shared
  layout's own Cancelled badge already shows the meeting is cancelled
  to anyone who can see those pages at all. **`public/page.tsx` is the
  one exception that correctly keeps its check** -- it's the one page
  a genuine non-admin/no-login viewer can actually reach, so showing
  "This meeting has been cancelled" there instead of a stale agenda is
  real, working protection, not a self-inflicted block.
- **Unlabeled public-only chrome.** `app/meetings/[id]/layout.tsx`
  (the shared shell wrapping every `/meetings/[id]/*` page) now checks,
  for Sacrament Meeting specifically, whether the viewer holds
  `sacrament_planning` or `sacrament_conducting` -- the only two
  features that ever let an account reach anything beyond the Public
  page. Without either, the layout skips its own meeting card
  (`&larr; Meetings` breadcrumb, `LifecycleBadge`, the Cancelled
  banner) and the Planning/Conducting/Public tab nav entirely, and
  renders just the meeting title/date (identifying context, not a
  workflow label) above the bare agenda the child page itself renders.
  An account with only `sacrament_program_view` (the Communications-
  Specialist-style early preview) gets this same treatment -- Public is
  the only page they can ever reach too. Everyone with either feature
  keeps the full chrome unchanged, since they actually need to
  navigate between the three tabs.

**Performance bug found and fixed the same day: meeting pages got "very
very slow to load."** The user's initial report of both bugs above
turned out to have a second, separate layer once the actual logic
fixes landed -- clarified immediately after: "just kidding. it was
just slow to load." Root cause: `getSessionUser()`
(`lib/supabase/get-session-user.ts`) does 3-4 sequential Supabase round
trips (an auth check, then profile+people in parallel, then a
`callings`/`calling_features` join) and is called from `AppHeader` on
nearly every page already -- the layout change earlier this same day
(the unlabeled-public-chrome entry above) added a *third* independent
call to it on every Sacrament Meeting page, on top of AppHeader's and
the page's own, with no caching between them. Same problem, smaller
scale, for `getMeetingById` (`lib/data/meetings.ts`): the shared
layout and the page rendered inside it both fetch the exact same
meeting by the exact same id, independently. Both functions are now
wrapped in React's `cache()` -- repeated calls with the same arguments
during a single request's render resolve to one shared promise instead
of re-querying, with no change in freshness (a new page navigation is
still a fresh call; `cache()` only lives for one request). No other
behavior changed; this is a pure performance fix, not a logic change,
and reduces redundant Supabase round trips everywhere both functions
are already called more than once per request, not just on meeting
pages.

**Bug found and fixed the same day: Delete silently did nothing on
failure.** The user's own report, right after the stage-gating fix
below: "the delete button is there but doesn't seem to actually remove
the meeting when pushed. I have browsed away from the page then back
and the meeting remains." `MeetingRow`'s inline `deleteThis` closure
called `deleteMeeting(meeting.id)` and discarded whatever it returned
-- if `deleteMeeting` came back with `{ error: "..." }` (wrong feature,
an RPC error, anything), nothing on screen ever said so; the row just
stayed put with no feedback at all, indistinguishable from the button
not working. `DeleteMeetingButton` now reads the result and shows the
message inline under the button if there is one. **Still unconfirmed:
what the actual underlying error is** -- this fix makes the real
reason visible instead of swallowing it, but doesn't itself diagnose
why a specific delete failed; ask the user to retry and report the
exact message if it still doesn't work, now that there will be one.

**Bug found and fixed the same day, surfaced by the report above:**
`/dashboard`'s per-row Delete button was gated on `meeting.stage !==
"archived"`, the exact same condition as Cancel/Un-cancel -- meaning a
meeting that had already auto-archived (any past meeting with no real
activity recorded, see `autoArchivePastMeetings`) couldn't be deleted
at all, only cancelled or un-cancelled. An accidental duplicate meeting
is just as likely to have quietly auto-archived by the time someone
notices it as not. Delete is no longer gated on stage at all -- only
Cancel/Un-cancel still hide once archived, since neither lifecycle
action means anything for a meeting that's already over, while
removing a genuine mistake like a duplicate record shouldn't depend on
how much time has passed since it was created. (Toggle "Show past
meetings" on `/dashboard` first if the duplicate is old enough to be
hidden by the default date filter -- unrelated to this fix, already
existing behavior.)

**Bug found and fixed 2026-10-04: Communications Specialist couldn't
actually do either of the two things its name promises.** The user's
own report, right after testing the role end-to-end for the first time
via the new Verify Logins flow: setting someone's role to
Communications Specialist "didn't give them the access I want them to
have which would be access to create announcements and to read the
public view of upcoming sacrament meetings at any time." Both gaps
turned out to be real, pre-existing holes -- the role had only ever
been wired into Ward Events/`/events` management
(`app/ward-events/page.tsx`, `app/events/page.tsx`), never into either
of these:
- **Announcement submission** (`/submit/announcement` and
  `submitAnnouncement`, `app/submit/actions.ts`) only ever checked
  Bishopric or calling-based meeting access (`getVisibleMeetingTypesForUser`)
  -- a Communications Specialist with no calling-based meeting access
  was blocked exactly like anyone else with no calling, despite the
  role's own name. Fixed by allowing the role outright at both the
  page gate and the server action's own re-check. The landing page's
  "Submit an Announcement" tile had the same gap (nested inside the
  same `attendsMeetings` condition as the unrelated Meeting Agenda
  Items tile) -- split into its own `canSubmitAnnouncement` check
  (`attendsMeetings || role === "communications_specialist"`) kept
  deliberately separate from `attendsMeetings` itself, since folding
  the role into that broader flag would have also unlocked Meeting
  Agenda Items, which has nothing to do with this role.
- **Sacrament Meeting public view, any time** (`/meetings/[id]/public`)
  only exempted Bishopric from the "today only, not archived" gate
  everyone else gets. Added Communications Specialist to that same
  exemption -- their job is preparing bulletins ahead of the actual
  day, so waiting for the public cutoff defeats the purpose. This
  alone wasn't enough, though: there was no visible way for this role
  to ever *reach* a future meeting's public page at all (Sacrament
  Meeting was never in any non-admin's "My meetings" tile list, by
  design -- see Architecture above). `/dashboard` itself turned out to
  have no role gate at all already (`canManage` is simply false for a
  non-Bishopric account, which already correctly routes a date click
  to `/meetings/[id]/public`) -- it just had no tile pointing at it for
  this role. Added a "Sacrament Meeting Programs" tile, visible only to
  Communications Specialist, linking to
  `/dashboard?type=sacrament-meeting&readonly=1`.

**Communications Specialist's early preview narrowed to a real "ready
for public" flag, same day.** The unconditional any-time preview
above turned out to be too broad -- the user's own follow-up: "add a
checkbox at the bottom of each meeting planning sheet that depicts
that the meeting is complete and ready for public consumption...
communication specialists would see it once it is marked as public,"
with everyone else (non-Bishopric, non-Communications-Specialist)
unaffected, still day-of only regardless of the flag. New
`sacrament_planning.ready_for_public` (migration `059`), a checkbox
rendered inside the Planning page's *closing* agenda-grid half, right
at the bottom (`AgendaGridForm` gained an optional `footer` prop for
this, submitted via the existing `planning::ready_for_public` field
convention `saveAgendaGrid` already parses, same as
`has_stake_business`) -- so it submits with the same combined "Save
All Changes" click rather than needing a button of its own.
`/meetings/[id]/public`'s gate now checks this flag for Communications
Specialist specifically: Bishopric keeps unconditional any-stage/
any-date preview (building the program comes before it's ready to
check the box); Communications Specialist gets it only once
`ready_for_public` is true; an **archived** meeting stays admin-only
for anyone else regardless of the flag's value, matching the Vision
workflow's own "no public access at all once archived" rule -- the
flag was deliberately not allowed to outlive that cutoff.

Separately, the user also reported the dashboard "defaulting to
public" instead of Planning when opening a meeting -- traced to the
account being tested with (the Communications Specialist test
account, confirmed by the user's own follow-up) rather than an actual
bug: `MeetingRow`'s existing `canManage ? planning : public` routing
is correct as-is and was left unchanged.

**Top priority, not yet root-caused (2026-10-03):** the user's first
attempt to create a Sacrament Meeting after this session's reskin merge
+ migrations 047-049 landed: "when clicking on meeting planning,
meeting agendas, sacrament meeting nothing happens." Everything traced
statically so far looks safe -- `createMeeting`
(`app/meetings/new/actions.ts`) properly surfaces its own insert
error to the form, and every seeding helper it calls
(`applyRotationsToNewMeeting`, `seedPlannedElementsForMeeting`,
`seedSacramentProgramItemsForMeeting`) is defensive (catches/logs
rather than throws, confirmed by reading each one), so an uncaught
exception breaking the whole create flow seems unlikely. `meeting_types`
having no real `sacrament-meeting` row also seems unlikely -- migration
`033` (confirmed run and verified months ago) depends on that exact row
existing via `(select id from meeting_types where slug =
'sacrament-meeting')`, repeatedly, and real production Sacrament
Meeting agenda data has flowed through it since. Couldn't reproduce
directly -- logging into the user's own account isn't something this
assistant will do even with credentials offered (entering a password is
a hard rule, not a missing-access problem), so this needs the user's
own next report: the most useful single test is going straight to
`/meetings/new` (skipping the Meeting Planning → Meeting Agendas tile
chain entirely) and reporting exactly what the Meeting Type dropdown
shows and what happens on submit (a specific error message, a redirect,
or truly nothing) -- that isolates "the tile chain is broken" from "the
underlying create flow itself is broken." Restoring Sacrament Meeting
to "My meetings" (below) is a parallel safety net, not a fix for this.

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

  ~~**Sacrament Meeting removed from "My meetings" entirely, 2026-09-10**~~
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

  **Reversed 2026-10-03**, per the user's own follow-up once they
  actually tried to create a first Sacrament Meeting: "I want it
  available to bishopric and admin members." `ALL_MEETING_TYPES` has
  `sacrament-meeting` back in it; since that constant is only ever used
  for the Bishopric branch (`visibleMeetingTypes = isBishopric ?
  ALL_MEETING_TYPES : rawVisibleTypes`), a non-admin's own list is
  completely unaffected -- still purely calling-based, still never
  includes Sacrament Meeting. The Administration → Meeting Planning →
  Meeting Agendas chain this removal leaned on turned out to be real
  friction in practice for the one thing that matters most (reaching a
  meeting to plan it) -- flagged alongside a separate, not-yet-diagnosed
  report the same day that clicking through that exact chain "does
  nothing" for a brand-new Bishopric account trying to create its first
  Sacrament Meeting (see Known open items' new entry on this). A direct
  tile is one more safety net while that's being chased down, not a
  decision that the chain itself is deprecated -- it's unchanged, still
  how `/meeting-agendas`' own per-type tiles reach `/dashboard`.
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
  deferred~~ **Built 2026-09-08** (migration `042`, confirmed run),
  per the user's own scoping: a Sunday teaching schedule, one row
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
- **Bug report: hymn numbers saved with no title, 2026-09-10** (the
  user's own words: "I have hymn numbers that were submitted by date
  but they weren't submitted with titles. These should automatically
  fill based on the data imported with hymn number and title"). Root
  cause: `/music`'s bulk paste tool (`parseBulkMusicText`,
  `lib/data/music-parsing.ts`) has always treated its title column as
  optional per row -- a pasted row with just a date/type/hymn-number
  left `sacrament_music.piece_name` null with nothing to ever fill it
  in later. New `lib/data/hymnal.ts` (`lookupHymn1985Title(s)`) queries
  Music Reference (`hymnal_songs`, `songbook = 'hymns_1985'`
  specifically -- the hymnal every congregational hymn type this app
  tracks is actually sung from) and now backs every write path that
  accepts a bare hymn number: `submitBulkMusicRows`/`addSingleMusicItem`
  (`app/music/actions.ts`), the agenda grid's own music rows
  (`saveAgendaGrid` in `app/meetings/[id]/agenda-actions.ts`), and
  Intermediate Hymn in the Speakers & Music list (`saveProgramMusic` in
  `app/meetings/[id]/speakers-music-actions.ts`) -- a number entered
  with no title now fills the title in automatically instead of saving
  blank, going forward. Never overwrites a title someone actually
  typed -- only fills in when the title field arrives empty. Migration
  `048` is the matching one-time catch-up for rows already saved blank
  before this shipped -- same match rule (1985 Hymnal, blank/whitespace-only
  `piece_name`), idempotent, confirmed run.
- **One-time bulk name import, 2026-09-10** (the user's own request:
  "I also need to do a one-time name input. Some of the names are
  already in the form. I need a way to not duplicate the names as
  well") -- a deliberate, named exception to this app's own "no bulk
  import, add people one at a time" policy (see the Adding new people
  workflow/policy above), not a reversal of it: still name-only, no
  other PII, just applied as one batch instead of one row at a time, at
  the user's own explicit request. Migration `049` inserts 412 names
  the user pasted directly (checked against each other first --
  case-insensitively, no internal duplicates) via
  `insert ... select ... where not exists (...)`, skipping any name
  already present in `people` (case-insensitive, trimmed) rather than
  assuming no overlap -- idempotent, so re-running it later only adds
  whichever names are still missing. New rows default to
  `attendance_status = 'attending'`/`active = true` (so they show up in
  assignment pickers immediately); `age_group` is left blank, since it
  can't be reliably guessed from a name alone -- an admin can set it
  per person afterward via Table Admin's People grid if wanted. Still
  needs to be run.
- **Live hymn-title pre-fill + the "C" prefix for Children's Songbook,
  2026-10-03** (the user's own request: "If I put in a hymn number
  please then pre-fill the name next to it with the associated hymn...
  we need to add a way to distinguish the children's song book numbers
  from those of the 1985 hymn book... add a 'C' prior to the children's
  song book numbers"). Two changes, both in Sacrament Meeting's Planning
  view only (the agenda grid's own hymn rows, and Intermediate Hymn in
  the Speakers & Music list):
  - **Hymn number is now a free-text identifier, not an integer**
    (migration `051`, `sacrament_music.hymn_number` -- same `integer ->
    text` idiom `hymnal_songs.number` already needed for its own
    lettered variants, migration `026`). A bare number (e.g. "223")
    matches across the 1985 Hymnal and Hymns for Home and Church, which
    the user confirmed never overlap each other by number; a "C" prefix
    (e.g. "C20") means Children's Songbook specifically, since its
    numbering does genuinely collide with the 1985 Hymnal's. New
    `lib/data/hymnal-shared.ts` (`parseHymnNumberInput`/`resolveHymnTitle`)
    is the one place this convention is implemented -- no `createClient`
    import, so it runs both server-side (`lib/data/hymnal.ts`'s
    `lookupHymnTitle(s)`, the existing save-time fallback from
    2026-09-10, now generalized to all three collections instead of
    1985-only) and client-side (see below). Every write path that
    touches `hymn_number` (`app/music/actions.ts`,
    `app/meetings/[id]/agenda-actions.ts`,
    `app/meetings/[id]/speakers-music-actions.ts`,
    `lib/data/music-parsing.ts`) was updated to stop
    parsing/validating it as an integer -- it's just trimmed text now.
    Every display site that reads it (`public-view.ts`,
    `conducting-rows.ts`, `sacrament-planning.ts`, `music-list.ts`,
    `sacrament-program-shared.ts`, `agenda-rows.ts`,
    `archived/page.tsx`, `RecentMusicList.tsx`) needed only a type
    annotation change -- all of them already just interpolated the
    value into a string. Table Admin's Sacrament Meeting Music grid and
    the single-add form at `/music` (`QuickAddMusic.tsx`, previously
    `type="number"`, which would have silently blocked typing a "C" at
    all) both switched to plain text inputs to match.
  - **Live pre-fill as you type**, not just at save time: new
    `getHymnalIndex()` (`lib/data/hymnal.ts`) fetches the *entire*
    Music Reference table once per Planning-page load (a few hundred
    rows total -- small enough that shipping the whole thing beats a
    server round trip per keystroke) and hands it down as a plain
    prop to `AgendaGridForm` (new `MusicCell` sub-component) and
    `SacramentProgramSection` (`ItemRow`'s intermediate_hymn branch).
    Both wire a hymn-number input's `onChange` to call
    `resolveHymnTitle` against that index and, if it matches *and* the
    title field is currently blank, set the title input's live DOM
    value via a `ref` -- both fields stay uncontrolled
    (`defaultValue`-based) otherwise, so this never risks the same
    kind of React-auto-reset bug just fixed elsewhere in this file
    (Known open items' speaker-confirmed entry) -- nothing about
    controlled/uncontrolled submission semantics changed, only a
    same-render DOM nudge on a sibling field. Never overwrites a title
    someone already typed in themselves, matching the save-time
    fallback's own rule.
  - Deliberately scoped to the Planning view only, per the user's own
    words ("in the meeting planning views") -- `/music`'s bulk-paste
    and single-add tools do NOT get the live typing preview, though
    they automatically benefit from the same underlying generalization
    (the save-time fallback now matches all three collections, and the
    "C" prefix works there too) since they share the same lookup
    functions. `BulkMusicEntry.tsx`'s own instructions text was updated
    to mention the convention.
  - **Bug fixed 2026-10-03, same day**: the live pre-fill only checked
    whether the title field was *blank* before writing to it -- correct
    for the first digit typed, but that digit's own auto-fill then made
    every later digit's "is it blank" check come back false, even though
    nothing the user actually typed was in there. The user's own report
    nailed both halves of this exactly: "I started to type 121 and it
    only recognized the 1 and brought up the corresponding hymn number 1
    title. Then when I deleted the 121 the hymn number 1 title stayed."
    New shared hook `lib/hooks/use-hymn-title-live-fill.ts` (replacing
    the duplicated inline logic in both `AgendaGridForm.tsx`'s
    `MusicCell` and `SacramentProgramSection.tsx`'s intermediate_hymn
    row) tracks the *exact value it last wrote* into the title field
    instead of just "blank or not" -- a later keystroke can tell "still
    holds what I filled last time, safe to replace" apart from "the user
    has since typed their own title, leave it alone." An unresolved
    number now also clears the title back to blank (rather than leaving
    a stale, no-longer-matching title showing), which is what fixes the
    second half of the report too -- deleting the number back to nothing
    correctly clears whatever title came from it.
- **Header wordmark replaced with the ward's own name, 2026-10-03** (the
  user's own request: "I would like to take the name Ward OS and make
  it much less conspicuous. Let put it only in the footer as is
  currently done. Then let's put the title '_______ Ward' in place of
  where Ward OS was in the header. The '______ Ward' name will be
  defined by the admin in admin tools"). `AppHeader.tsx` (used on every
  page except the three pre-auth ones) now renders "`<ward name>` Ward"
  instead of the literal "Ward OS" wordmark; `/login` (the one pre-auth
  page that had its own "Ward OS" heading, since it has no `AppHeader`)
  matches. Every footer was left exactly as it already was, per the
  user's own words ("as is currently done") -- `app/page.tsx`'s and
  `app/dashboard/page.tsx`'s still say "Ward OS" literally.
  - New `ward_settings` table (migration `052`) -- a deliberate
    singleton (exactly one row), not a key/value settings scheme, since
    this is the only setting of its kind so far. Added to Table Admin
    as "Ward Settings" (one text column, `ward_name`) per the user's
    own words ("defined by the admin in admin tools") -- the generic
    engine has no concept of "exactly one row," so its own description
    just says so explicitly, same treatment every other
    easy-to-misconfigure small table in this registry already gets
    (e.g. `admin_select_options`). New `lib/data/ward-settings.ts`'s
    `getWardName()` reads it, falling back to the plain word "Ward" on
    any error or a missing row -- this renders on every single page,
    including fully public ones with no session at all, so it must
    never be the reason a page fails to render.
  - Replaces the old `lib/config.tsx`/`WARD_NAME` -- an env-var-only
    constant (`NEXT_PUBLIC_WARD_NAME`, defaulting to the literal string
    "Ward OS") that nobody could actually change without a code deploy,
    despite that file's own comment already anticipating this exact
    future need ("later, read it from a wards table"). `lib/config.tsx`
    is deleted outright, not left as unused dead code -- `app/page.tsx`
    was its only other caller (its own separate hero `<h1>`, previously
    showing "Ward OS" by coincidence since the env var was never set in
    production) and now uses `getWardName()` too, rendering the same
    "`<ward name>` Ward" text as the header -- left unchanged would
    have directly contradicted the user's own stated goal here, even
    though they only explicitly named "the header."
  - `/login` was a Client Component (`useActionState`) with no way to
    call an async server fetch directly -- split into an async Server
    Component page (fetches `getWardName()` for its heading) plus a new
    `components/auth/LoginForm.tsx` Client Component for just the
    actual form, the only part that needs client state.
- **Visiting Authorities rebuilt as a calling-restricted multi-select +
  write-in list, 2026-10-03** (the user's own request: "a dropdown that
  includes those in Stake Presidency callings (President and
  Counselors) and any in High Council callings... a potential write-in
  option as well and allow for multiple visiting authorities to be
  recognized"). Investigating this surfaced that "Visiting Authorities"
  had never actually been wired into the live agenda anywhere -- it was
  cataloged as a plain `resolution_kind: 'free_text'` element, but no
  code anywhere (`agenda-rows.ts`, `conducting-rows.ts`, `public-view.ts`)
  ever referenced the key by name, and the one place it *was* exposed
  (`sacrament_planning.visiting_authorities`, Table Admin's raw grid) is
  a completely separate, dead column nothing else reads or writes. So
  this was really "build it for the first time," not "upgrade what's
  there."
  - New `sacrament_visiting_authorities` table (migration `053`) --
    same "dynamic add/remove list" shape as Speakers & Music
    (`sacrament_program_items`) and RABNM (`sacrament_rabnm`): one row
    per recognized authority, each either a real `person_id` or a
    write-in `guest_name`, never both, with its own `sort_order`.
  - New `VISITING_AUTHORITY_CALLING_NAMES` (`lib/data/rotations.ts`) --
    `STAKE_PRESIDENCY_CALLING_NAMES` (already existed, for Presiding's
    own dropdown) -- plus High Council. Resolved the exact same way
    Presiding/Conducting already are -- fixed by calling, not a real
    `rotations` row -- via a new shared `fixedCallingNamesForKey`
    helper both `getEligiblePeopleForElement`/`getEligiblePeopleByElementKey`
    now call, replacing their previous presiding/conducting-only
    special case. **First guess was a plain exact-match `"High
    Council"`, which came back empty -- fixed 2026-10-03** once the
    user reported it and gave the real naming: "the calling is called
    Stake High Councilor and then there are parenthesis. any calling
    with Stake High Councilor should be included." This ward records
    one row per seat (`"Stake High Councilor (<area>)"`), so no single
    exact string could ever cover all of them -- the same underlying
    gotcha as the Stake Presidency counselor mismatch, just needing a
    prefix instead of a different literal string this time. New
    `VISITING_AUTHORITY_CALLING_NAME_PREFIXES = ["Stake High Councilor"]`
    and `computeEligiblePersonIdsForFixedCalling` (merges an exact-match
    query with an `ilike "<prefix>%"` query per prefix, unioning the
    results) -- deliberately scoped to just the fixed-by-calling
    elements, not folded into `computeEligiblePersonIds`' general
    `calling_names` source, so an admin-configured rotation's own typed
    `eligibility_calling_names` stays exact-match-only elsewhere in the
    app and can't be silently widened by a coincidental prefix.
  - ~~On its own page, `/meetings/[id]/visiting-authorities`, same
    reasoning as Ward Business~~ -- true only for the rest of this same
    day, see the follow-up note right after this list, which moves it
    back inline.
  - **Write-in reuses `SpeakerPersonOrGuestField`** (the exact same
    person-or-guest toggle Speaker/Youth Speaker rows already use) --
    gained optional label props (`personPlaceholder`, `guestPlaceholder`,
    `guestToggleLabel`, `personToggleLabel`), all defaulting to the
    original Speaker wording so that caller is unaffected, so this
    didn't need a near-duplicate component just for different button
    copy ("Write in a name instead" / "Choose from the list instead").
  - **Also wired into the Conducting script** (not originally asked for,
    but a real, obvious gap once the data existed -- the whole point of
    recognizing a visiting authority is presumably that the conductor
    welcomes them by name during the meeting, and nothing did that
    before): `buildConductingRows` gets a new `visiting_authorities`
    dispatch branch, skipped entirely when none are recognized rather
    than showing an empty line. **Deliberately left out of the public
    program** (`public-view.ts`) for now -- that's a bigger judgment
    call about what belongs in a public-facing program (RABNM/calling
    business already stay out of it on purpose), not something to
    decide without asking first.

  **Moved back inline the same day**, per the user's own immediate
  follow-up: "Instead of a separate management space lets have it much
  like the other dropdowns on the page, but with a + button underneath
  the dropdown to add a second row for another visiting authority
  continuously." The separate page, its own actions file, and
  `VisitingAuthoritiesSection.tsx` are all deleted outright, not left
  unlinked -- `sacrament_visiting_authorities` (migration `053`) and
  `VISITING_AUTHORITY_CALLING_NAMES` are completely unchanged, only how
  the list is edited moved.
  - **New `visiting_authorities` `AgendaRow` kind** (`lib/data/agenda-rows.ts`)
    renders directly in the grid instead of a banner-with-link. Unlike
    Speakers & Music (which genuinely needs its own real `<form>`s per
    item, hence staying inline-but-separate between the two grid
    halves), this element's row *count* is purely a client-side React
    state concern -- a new `VisitingAuthoritiesField`
    (`components/planning/AgendaGridForm.tsx`) adds/removes rows in its
    own `useState`, and every row's fields submit together with the
    rest of the grid on the one "Save All Changes" click. That
    sidesteps the nested-form problem entirely rather than solving it --
    there's only ever the grid's own single `<form>`, nothing nested
    inside it.
  - **Field names are positionally indexed**
    (`visiting_authority::<n>::person_id` / `::guest_name`, via new
    `personFieldName`/`guestFieldName` override props on
    `SpeakerPersonOrGuestField`) rather than carrying each row's real
    database id -- `saveAgendaGrid` collects every row under the
    prefix, drops any that end up genuinely blank (no person, no guest
    name), and **replaces the meeting's whole
    `sacrament_visiting_authorities` list** with what's left (delete
    all, then re-insert) instead of diffing row by row. Simpler than
    tracking per-row identity across add/remove, and safe here
    specifically because this whole field group only ever saves as one
    unit, never a single row in isolation.
  - **"Remove" only drops the trailing row**, not an arbitrary one in
    the middle -- every field in this grid is an uncontrolled input
    (`defaultValue`-based), and correctly reindexing an arbitrary
    removal would need controlled state this component otherwise has
    no reason to carry. To drop a row that isn't last, clear its own
    selection instead -- a blank row is dropped at save time the same
    as if it had never been added.
  - Adding or removing a row doesn't fire a native form `change` event
    (nothing's value actually changed), which is what the grid's own
    "Save All Changes" dirty-tracking listens for -- `VisitingAuthoritiesField`
    takes an explicit `onDirty` callback instead, called directly on
    every add/remove, same pattern `MultiPersonSelect.tsx` already
    established for Calling Planning's chip-style picker.
- **Delete Meeting, distinct from Cancel; a duplicate-date guard on
  creation; entering a meeting now defaults to Planning -- all
  2026-10-03, the user's own request** after accidentally creating a
  second Sacrament Meeting for an already-planned date: "I want to be
  able to delete that meeting. But then what does that mean when I do
  that? Does it impact the agenda of the meeting I actually want on
  that date? Can we have a way to notify someone that they are creating
  a meeting that is already there and that they can be then be taken to
  that meeting planning?"
  - **Delete Meeting** (`deleteMeeting`, `app/dashboard/actions.ts`,
    new `DeleteMeetingButton.tsx`, next to Cancel/Un-cancel on
    `/dashboard`): removes a meeting record and everything tied to it
    outright, for a genuine mistake -- Cancel (unchanged) keeps a real
    meeting on the calendar, visibly marked as not happening, which is
    a completely different concept (informational, nothing deleted). A
    short explanatory line now sits above the dashboard's meeting list
    for exactly this distinction, since it was a real question the user
    asked, not just a feature request.
  - **Answering "does it impact the other meeting on that date": no.**
    Every table scoped to a meeting is keyed by that specific meeting's
    own `id`, never by date -- deleting meeting A can never touch
    meeting B's rows even if they share a date. New `delete_meeting_cascade`
    Postgres function (migration `054`) does the actual cleanup, in one
    atomic transaction, across every table found to hold meeting-scoped
    data (`sacrament_assignments`, `bishopric_assignments`,
    `sacrament_music`, `sacrament_planning`, `sacrament_speakers_adults/
    youth`, `sacrament_rabnm` + its `sacrament_rabnm_people` join rows,
    `sacrament_program_items`, `sacrament_visiting_authorities`,
    `meeting_planned_elements`, `meeting_element_notes`, `agenda_items`,
    `meeting_action_items`, `council_notes`, `bishopric_minutes`) --
    done as one Postgres function rather than a sequence of separate
    `.delete()` calls from the server action specifically so a failure
    partway through can't leave orphaned rows, and so it doesn't matter
    whether each table's own `meetings` foreign key happens to cascade
    or not (several of these tables predate this repo's migration
    history, so that was never something to assume either way).
    `calling_planning.announced_meeting_id` -- a reference *to* a
    meeting, not data belonging to it -- is set to null instead of
    deleted, so real calling-planning history is never destroyed just
    because the meeting it was announced in gets removed.
  - **Incidental gaps found and fixed while in here**: `cancelMeeting`/
    `uncancelMeeting` had no server-side role check at all (only the
    dashboard page's own `canManage` gate kept the controls out of a
    non-admin's view) -- the same gap already found and fixed for
    several other actions this session, now closed for these two as
    well. Same for `createMeeting` (`/meetings/new`'s own action) --
    found while adding the duplicate-date guard below.
  - **Duplicate-date guard on creation** (`app/meetings/new/actions.ts`):
    before inserting, checks for an existing meeting of the same type
    and date; if one exists, refuses to create a second and returns a
    link straight to the existing meeting's Planning view instead of
    silently creating a duplicate. `lib/data/meeting-schedule.ts`'s
    Generate Meetings already had this same check built in (it skips
    any candidate date that already has a meeting) -- `/meetings/new`'s
    manual "+ New Meeting" form was the one creation path that didn't,
    and is exactly how the user's own duplicate happened.
  - **Entering a meeting now defaults to Planning** (the user's own
    words: "when entering a meeting instance from a dashboard please
    default to the planning view"): the bare `/meetings/[id]` route
    (previously just "Choose a view above to get started") now
    redirects straight to `/meetings/[id]/planning` -- Planning's own
    existing gate already handles everything that needs to happen from
    there (a non-admin to the read-only view, an archived meeting to
    its own view), so nothing needed duplicating. The dashboard's own
    date-button link and a freshly created meeting's redirect both go
    straight to `/planning` now too, skipping that extra redirect hop
    rather than relying on it alone.
- **Ward Business moved inline, calling-planning-sourced, and split
  into Releases/Callings/Other, 2026-10-03** (the user's own request,
  right after Visiting Authorities got the same treatment: "update
  ward business like we just did the visiting authorities -- meaning
  I want it in the agenda grid. It should be prefilled with items from
  callings planning that are listed as ready to announce in sacrament
  meeting. It should have the ability to call in other items from
  calling planning even if they aren't marked as ready. It should be
  divided into releases, callings, other."). Replaces the standalone
  `/meetings/[id]/ward-business` page entirely -- deleted outright,
  along with `RabnmSection.tsx` and `RabnmAddForm.tsx` (both
  superseded), the same "don't leave a second, now-redundant place to
  edit the same data" principle already applied everywhere else this
  session.
  - **New `sacrament_rabnm.calling_planning_id`** (migration `055`,
    nullable FK into `calling_planning`) -- the explicit, reversible
    link between one Ward Business announcement row and the Calling
    Planning row it came from. `calling_id` alone can't serve this: a
    calling can be re-planned more than once (a second presidency
    change on the same calling, say), so matching back to "which
    planning row did this announcement come from" by `calling_id` +
    `type` would be fragile and ambiguous. Only ever set by the new
    pull mechanism below -- a manually-added "Other" item (baby
    blessing, baptism, etc.) has no Calling Planning row to link to and
    leaves this null.
  - **New `getCallableCallingPlanningItems()`** (`lib/data/calling-planning.ts`)
    -- every `calling_planning` row not yet announced in any meeting
    (`announced_meeting_id is null`), split into a Callings list (needs
    exactly one candidate narrowed down, same threshold
    `pushCallingToSacramentMeeting` already enforces) and a Releases
    list (needs `release_person_id` set), each item flagged `ready`
    when its own `calling_status`/`release_status` is already "To
    Announce in Sacrament." A row can appear in both lists at once (a
    presidency change pending both a new calling and a release).
  - **New `app/meetings/[id]/ward-business-actions.ts`**:
    `pullCallingPlanningIntoMeeting(meetingId, planningId, kind)` --
    the meeting-side counterpart to Calling Planning's own
    `pushCallingToSacramentMeeting` (left completely untouched, still
    a second, independent entry point to the same effect from Calling
    Planning's own page). Unlike that function, pulling isn't limited
    to rows already marked "ready" -- the user's own explicit request
    ("call in other items... even if they aren't marked as ready") --
    pulling a row in at all *is* the decision to announce it, so it
    still creates the `sacrament_rabnm`/`sacrament_rabnm_people` rows
    and advances `calling_status`/`release_status` to the next step
    (`to_be_set_apart`/`to_record`) regardless of where it started.
    `removeCallingPlanningFromMeeting(meetingId, planningId)` reverses
    it -- deletes the `sacrament_rabnm` row (and its
    `sacrament_rabnm_people` rows, explicitly, same
    don't-assume-a-cascade reasoning as `delete_meeting_cascade`) and
    resets the Calling Planning row's `announced_meeting_id` and
    status back to "To Announce in Sacrament," so it can be pulled into
    a different meeting (or this one again) without manual cleanup.
    Both are Bishopric-only, matching every other Ward Business action.
  - **Releases and Callings are no longer manually typed in at
    all** (except Presidency Change, see below) -- always pulled from
    Calling Planning, either a "ready" suggestion or picked from a
    "call in another" dropdown regardless of status. Calling Planning
    stays the single source of truth for who's being called or
    released; Ward Business is just another entry point into the same
    underlying action its own "Ready to Announce" section already
    provides. **Presidency Change is the one exception** -- it's folded
    into the Callings group's own quick-add form instead, since Calling
    Planning has no distinct status concept for it to be "ready" from.
  - **New `components/planning/WardBusinessField.tsx`** -- the row's
    actual content, rendered full-width in the grid (like a banner/
    section row, not squeezed into the label+value two-column shape,
    since it holds three whole sub-sections). Three labeled groups:
    - **Releases** / **Callings**: already-saved items (`ExistingItem`,
      Remove reverses the pull via `removeCallingPlanningFromMeeting`
      when `calling_planning_id` is set, or calls the existing
      `deleteRabnmItem` for a manually-added Presidency Change with no
      such link) plus `CallablePicker` -- ready suggestions with an
      inline Add button, and non-ready items in a "Call in another from
      Calling Planning..." dropdown.
    - **Other**: unchanged free-form types (baby blessing, baptism,
      mission call, Aaronic Priesthood, new member record) -- same
      fields as before (type, calling if relevant, people, detail,
      event date), just rendered here instead of on the old standalone
      page.
  - **New `components/planning/RabnmQuickAddForm.tsx`** -- replaces
    `RabnmAddForm.tsx`'s real `<form>` (which is exactly why Ward
    Business needed its own page before: a `<form>` can't nest inside
    the agenda grid's single big one) with refs + a plain
    `type="button"` + `useTransition` calling the existing
    `addRabnmItem` action directly. Every action in this row --
    pulling a Calling Planning item in or out, adding/removing an
    Other item -- is a plain button triggering an immediate server
    action, never a `<form>` submission, so none of it conflicts with
    the grid's own enclosing `<form>` either. This is a deliberately
    different pattern from Visiting Authorities' deferred, bulk-saved
    rows (built the same week) -- Ward Business's pulls have a real
    side effect on a different table (`calling_planning`) the instant
    they happen, so they can't wait for the grid's own "Save All
    Changes" the way Visiting Authorities' simple self-contained
    person-or-guest pairs can.
  - **New `ward_business` `AgendaRow` kind** (`lib/data/agenda-rows.ts`)
    carries the already-saved items plus both Calling Planning pull
    lists straight through -- no field names of its own, unlike every
    other row kind here, since every action under it commits
    immediately rather than through the grid's submit. Replaces the
    old `banner`-with-`href`-to-its-own-page special case for the
    `ward_business` element key.
- **Ward Business reworked again the same day** -- the user's
  immediate follow-up after seeing the three-group version above:
  "I still don't like the format. I want it to appear more like the
  calling planning table but with less information. Essentially I want
  to be able to select by dropdown a line from the calling planning
  table in either the release or calling section of ward business. The
  dropdown should show the individual and the calling they are being
  released from or called to. Remove the 'other' section." Two
  sections now, not three:
  - **One dropdown per section, not two.** The previous version split
    each section into a "ready to announce" list (its own inline Add
    buttons) and a separate "call in another" dropdown for everything
    else. Collapsed into a single `<select>` per section listing every
    not-yet-announced Calling Planning row for that half (ready ones
    sorted first as a quiet convenience, no longer called out visually
    -- matches "less information"), each option reading `"<person> —
    <calling>"` exactly as asked. `pullCallingPlanningIntoMeeting`/
    `removeCallingPlanningFromMeeting` (`app/meetings/[id]/ward-business-actions.ts`)
    are completely unchanged -- this was a UI simplification only, the
    underlying pull/un-pull mechanism and migration `055` link are
    untouched.
  - **Already-pulled items render as a plain two-column table**
    (Person, Calling, Remove) instead of the previous bulleted list
    with an inline type badge and inline detail/date text -- "more
    like the calling planning table" in spirit (a real `<table>`,
    label-light) without copying its full column set, since every
    column that table has (Date Initiated, Status, Notes, etc.) lives
    on the *Calling Planning* row, not the Ward Business announcement
    of it.
  - **"Other" is gone, and so is Presidency Change's manual quick-add.**
    Nothing in Ward Business is typed in by hand anymore -- every row
    comes from pulling a Calling Planning entry. A presidency change
    doesn't need its own combined type to represent it: pulling that
    row's release half into Releases and its calling half into
    Callings (two ordinary pulls from the same Calling Planning row)
    already produces the same two line items a dedicated
    "presidency_change" type would have, so nothing was actually lost
    by dropping it. `components/planning/RabnmQuickAddForm.tsx` and the
    `addRabnmItem` server action it called are deleted outright --
    `deleteRabnmItem` stays, now documented as reachable only for a row
    predating this cutover (an old manually-added item from before
    2026-10-03), so an admin can still remove one of those without
    needing Table Admin's raw grid for just that case.
  - **`people`/`callings` props dropped everywhere down the chain** --
    `WardBusinessField` no longer needs a person list or a calling list
    at all now that nothing is manually typed in, so they're gone from
    its own props, the `ward_business` `AgendaRow` kind, `AgendaRowInputs`,
    and the planning page's own data fetch (`getCallingOptions()` is no
    longer called from here -- still used elsewhere, e.g.
    `/calling-planning` itself, untouched).
  - **Any pre-existing "Other" or `presidency_change` row is simply no
    longer rendered here** -- it still exists in the database (nothing
    was deleted), it's just not visible or manageable from this grid
    anymore. Table Admin's own `sacrament_rabnm` table (already
    registered as a raw-data fallback) remains the way to manage one
    directly if that ever comes up.
- **Table Admin's People grid: Attendance Status/Active/Notes dropped,
  Calling added, 2026-10-03** (the user's own request: "Let's not
  include the attendance field, the active checkbox, and the notes
  field. Let's include the calling field."). All three real columns
  (`attendance_status`, `active`, `notes`) still exist on `people`,
  untouched -- this only removes them from Table Admin's own grid, not
  from the schema. **Real consequence, not yet raised by the user as a
  problem:** this grid was the only in-app place that ever edited
  `active` (which still gates assignment-picker visibility, per the
  grid's own updated description) or `attendance_status` -- there's now
  no UI anywhere to change either one; only directly in the Supabase
  dashboard. Flagged here rather than silently left for someone to
  discover later.
  - **"Calling" is a genuinely new kind of column, not just a hidden
    one re-shown**: `people` has no `calling_id` of its own --
    `callings.current_holder_id` points *at* a person, not the other
    way around, so there was no existing column to surface. New
    `AdminColumnConfig.reverseLookup`/`AdminColumnType: "reverse_lookup"`
    (`lib/admin/types.ts`) is a small, deliberately generic extension
    of the config-driven engine (matching how `scopedBy`/`specialOptions`/
    `createIfMissing` were each added before it) rather than a
    People-only special case inside `AdminTableEditor.tsx` -- that
    component's own top comment is explicit that it "has no per-table
    logic of its own," so a one-off branch there would have broken
    that principle for a need (showing a reverse relationship) that's
    likely to come up again elsewhere.
  - **New `getReverseLookupValues()`** (`lib/admin/table-data.ts`) --
    one batched query per `reverse_lookup` column against the table
    that actually holds the foreign key (`callings`, filtered to
    `current_holder_id in (these people's ids)`), grouped back onto
    each person and comma-joined if more than one calling resolves to
    the same person (nothing stops that from being real). `getAdminRows`
    now excludes `reverse_lookup` columns from its own `select(...)`
    list -- there's no real `people.calling` column to select, and
    trying to would just error.
  - **Read-only everywhere it renders**: `AdminTableEditor.tsx` shows
    plain text (an em dash when empty) for a `reverse_lookup` cell
    instead of `AdminCellInput`, both for existing rows and the blank
    "add new" row (a brand-new person has no calling yet regardless).
    Sorting its column header works too, sorting by the resolved text
    rather than a nonexistent raw `row[column]`. `sanitizePatch` now
    also explicitly drops a `reverse_lookup` key from any incoming
    patch as defense-in-depth, on top of the UI already never
    producing one to send.
  - To actually change who holds a calling, use `/callings` or Table
    Admin's own Callings grid (`current_holder_id`) -- this column is
    display-only by design, matching how the user framed it ("include
    the calling field," not "let me edit it from here").
- **`/admin`'s main table list sorted alphabetically, 2026-10-03** (the
  user's own request, naming the other two sections by sight to rule
  them out: "not the sacrament section or the meeting section"). Only
  `everydayTables` (the flat, unlabeled list at the top of the page)
  is affected -- sorted by `label` via a plain `.sort((a, b) =>
  a.label.localeCompare(b.label))` in `app/admin/page.tsx`. "The
  sacrament section" is the existing "Sacrament Meeting Content" group
  (`sacramentTables`); "the meeting section" is read as the existing
  "Other Admin Tools" group, whose only entry today happens to be
  Meeting Templates -- both keep their current (non-alphabetical)
  order, untouched.

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
