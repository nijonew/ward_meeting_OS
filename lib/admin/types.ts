/**
 * Config-driven admin table editor. A table only shows up under /admin
 * once it has an entry in lib/admin/registry.ts -- and only the columns
 * listed there are readable/writable through the generic actions. Any
 * column left out (id, created_at, and anything the app's own logic
 * depends on, e.g. rotations.next_index) simply never reaches the
 * client, by construction: lib/admin/table-data.ts always selects and
 * sanitizes against this exact column list.
 */

export type AdminColumnType =
  | "text"
  | "long_text"
  | "number"
  | "boolean"
  | "date"
  | "time"
  | "select"
  | "select_with_other"
  | "multi_select"
  | "foreign_key"
  | "reverse_lookup"
  | "presence_indicator";

/**
 * "select_with_other" and "multi_select" (2026-10-18, the user's own
 * request, naming the Announcements table specifically: "the manage
 * announcements page entries are all seemingly short answer... Can the
 * same options in the submit announcements page be available via
 * dropdown or checkbox in dropdown on the manage announcements page?").
 * Both store a plain string on a real `text` column, same as "text" --
 * there's no new column shape, only a richer editor UI on top of the
 * exact same data the submit form already writes:
 * - **"select_with_other"**: a single value from `options`, PLUS a free-
 *   text override (matching this app's own announcement submission
 *   form's radio-with-"Other" questions, e.g. Organization/Type). The
 *   stored value is either one of the fixed `options`' values, or
 *   whatever free text was typed -- never the literal word "Other"
 *   unless that's genuinely what was typed with nothing else. The
 *   editor shows "Other" selected (with the real text in the box
 *   beneath it) whenever the current value doesn't match any fixed
 *   option, so an already-submitted "Other" answer is never stranded
 *   outside the dropdown -- this is exactly the gap that made free text
 *   necessary here in the first place, now solved by always offering an
 *   escape hatch instead of giving up the fixed options altogether.
 * - **"multi_select"**: more than one value from `options` at once,
 *   joined into the one text column with `lib/data/announcement-constants.ts`'s
 *   `MULTI_SELECT_SEPARATOR` (matching this app's own announcement
 *   submission form's checkbox-group questions, e.g. Audience/Where
 *   Announced -- no "Other" on either, so this one has no free-text
 *   escape hatch). Rendered as a dropdown button that opens a checklist
 *   panel (`MultiSelectDropdown`), same "checkbox in dropdown" the user
 *   asked for literally. Parsing an existing joined string back into
 *   individual selections assumes `options`' own order is preserved in
 *   storage (true for anything saved through the real submit form,
 *   which always emits checked values in that fixed order) -- a value
 *   hand-typed into this column before it became multi_select, in a
 *   different order or containing something outside the fixed list,
 *   may not parse back into checkboxes correctly. Nothing is overwritten
 *   until a row is actually saved from this grid, so simply viewing such
 *   a row can't lose data; only clicking Save on one would replace it
 *   with just whatever the checklist shows checked.
 */

/** value/label plus an optional raw date, so a "meetings" lookup's
 *  options can be grouped onto a calendar (see MeetingDatePicker). */
export interface AdminOption {
  value: string;
  label: string;
  date?: string;
}

export interface AdminColumnConfig {
  /** Actual database column name -- except for type: "reverse_lookup",
   *  which has no real column on this table at all (see `reverseLookup`
   *  below); there, this is just a unique display key. */
  column: string;
  /** Display label for the grid header. */
  label: string;
  type: AdminColumnType;
  required?: boolean;
  /** For type: "text" only -- renders as a small wrapping <textarea>
   *  instead of a single-line <input> (2026-10-13, the user's own
   *  report: "a large enough field... when wrapped I can see all of
   *  the information," naming the Announcements table specifically).
   *  A plain <input> can't wrap at all -- long content just scrolls
   *  inside the box, out of view -- so this is the only real fix for a
   *  text column that regularly holds more than a few words. Opt-in
   *  per column (not a blanket change to every "text" column in every
   *  table) since most short text columns elsewhere in this registry
   *  would just get visually taller for no benefit. */
  wrap?: boolean;
  /** Fixed choices, for type: "select" | "select_with_other" | "multi_select".
   *  For "select", used directly if optionsFrom is absent; otherwise it's
   *  the fallback when that field_key has no rows yet in
   *  admin_select_options. "select_with_other" and "multi_select" always
   *  use this list directly -- neither reads from admin_select_options. */
  options?: AdminOption[];
  /** For type: "select" -- reads live choices from admin_select_options
   *  (field_key column) via lib/data/select-options.ts, so admins can
   *  add/remove/reorder them without a code change. Falls back to
   *  `options` above if that field_key has no rows. */
  optionsFrom?: string;
  /** Lookup target, for type: "foreign_key". A "meetings" target renders
   *  as a calendar picker instead of a dropdown (see AdminCellInput);
   *  meetingTypeSlug narrows it to just that meeting type's dates, since
   *  most tables that link to a meeting only ever mean one type of it.
   *  createIfMissing (meetings only, requires meetingTypeSlug) lets the
   *  calendar pick ANY date, not just ones with an existing meeting --
   *  planning can happen against a future Sunday well before that
   *  meeting is otherwise created. Resolved server-side (see
   *  lib/admin/table-data.ts) via lib/data/meetings.ts's
   *  getOrCreateMeetingId at save time. */
  foreignKey?: { table: string; valueColumn: string; labelColumn: string; meetingTypeSlug?: string; createIfMissing?: boolean };
  /**
   * Narrows a foreign_key column's choices to just what's relevant to
   * *this* row, based on another column on the same row -- e.g.
   * calling_planning.release_person_id should only offer the specific
   * calling's current/backup holder, not every person in the ward.
   * scopeColumn: the row's own column to read (e.g. "calling_id").
   * lookupTable: table to fetch by id using that scope value.
   * lookupColumns: columns on lookupTable, each holding a foreign key into
   *   this column's foreignKey.table (e.g. ["current_holder_id",
   *   "backup_holder_id"]) -- their values become the allowed choices.
   */
  scopedBy?: { scopeColumn: string; lookupTable: string; lookupColumns: string[] };
  /**
   * Extra pseudo-choices for a foreign_key column that don't correspond to
   * a real row -- e.g. "Previously Vacant / New Calling" for a release
   * person. Selecting one sets this column to null and merges `patch`
   * into the rest of the row in the same save.
   */
  specialOptions?: (AdminOption & { patch?: Record<string, unknown> })[];
  /**
   * For type: "reverse_lookup" only -- a read-only display column for a
   * relationship this table doesn't hold the foreign key for itself,
   * e.g. People's "Calling" column: `callings.current_holder_id` points
   * AT a person, not the other way around, so there's no real column on
   * `people` to select or edit here. `table`/`foreignKeyColumn` say
   * where to look (rows whose `foreignKeyColumn` equals this row's id);
   * `labelColumn` is what to display. Comma-joins more than one match,
   * since nothing stops a person from holding more than one calling at
   * once. See getReverseLookupValues (table-data.ts).
   */
  reverseLookup?: { table: string; foreignKeyColumn: string; labelColumn: string };
  /**
   * For type: "boolean" only -- maps the checkbox to two real text
   * values instead of an actual `boolean` column, e.g. People's Age
   * Group (Youth checked, Adult unchecked instead of a three-option
   * dropdown -- 2026-10-30, the user's own request: "can we update the
   * adult/youth assignment to be a checkbox on the line in people
   * rather than a dropdown"). `checkboxLabel` renders right next to
   * the checkbox so a bare tick mark isn't ambiguous about what
   * "checked" means. A row whose stored value is neither `trueValue`
   * nor `falseValue` (e.g. an existing "child" row, under People's own
   * three-value CHECK constraint) renders unchecked and is left
   * completely alone unless the checkbox is actually clicked -- only
   * then does it become `trueValue`/`falseValue`, same as any other
   * untouched field on a row keeps its original stored value.
   */
  booleanAsText?: { trueValue: string; falseValue: string; checkboxLabel: string };
  /**
   * For type: "presence_indicator" only -- a read-only Yes/No display
   * for a real column this grid shouldn't let you edit directly, e.g.
   * People's "Login Account" column: `profile_id` is a real FK, but
   * the only correct way to set it is Verify Logins' own
   * identity-matching flow, not a bare dropdown of every login's
   * (often-blank) display name. The column's own raw value still
   * selects normally -- only its type governs display (truthy ->
   * trueLabel, falsy -> falseLabel) and that it's dropped from any
   * patch before it reaches the database (see sanitizePatch).
   */
  presenceIndicator?: { trueLabel: string; falseLabel: string };
  /**
   * For type: "select" only -- renders as a small row of toggle
   * buttons (one per `options` entry) instead of a `<select>`
   * dropdown, e.g. People's Gender column (2026-10-31, the user's own
   * request: "a selection between male/female rather than a
   * dropdown"). Clicking a button sets the value to that option;
   * there's no explicit "clear" affordance, same as Age Group's own
   * checkbox -- a blank/unset value just shows neither button
   * pressed, and stays that way until one is actually clicked.
   */
  toggleButtons?: boolean;
}

export interface AdminTableConfig {
  /** Database table name -- also used as the /admin/[table] route slug. */
  table: string;
  label: string;
  description?: string;
  orderBy?: { column: string; ascending?: boolean };
  columns: AdminColumnConfig[];
  /**
   * The one feature that gates this specific table (2026-10-04, the
   * user's own request: "table admin for each table as a separate
   * listing") -- a string rather than importing `Feature` directly, to
   * avoid this generic-engine file depending on the auth module;
   * `app/admin/page.tsx`/`[table]/page.tsx`/`[table]/actions.ts` cast
   * it to `Feature` when checking. Always `"table_admin_<table>"` by
   * convention, matching migration `060`'s seed data exactly.
   */
  requiredFeature: string;
  /**
   * An optional lazy sweep to run once before `getAdminRows` reads
   * this table (2026-10-18, the user's own question: "can this
   * automatically archive or delete announcements whose time has
   * passed?") -- same "run it on the way in, no cron" pattern this
   * app already uses for meetings/youth activities
   * (`autoArchivePastMeetings`, `sweepMeetingCancellations`, etc.),
   * generalized here as a config hook instead of a hardcoded
   * per-table branch, matching this file's own "no per-table logic"
   * principle. A table with none set is untouched, same as before
   * this existed.
   */
  sweepBeforeRead?: () => Promise<void>;
  /**
   * Marks this table as archive-instead-of-delete (2026-10-30, the
   * user's own request for `people`: "when someone is deleted from the
   * people page they should be added to a new archived people page").
   * `archivedColumn` is the real column that marks a row archived --
   * `getAdminRows` excludes any row where it's set, by default, so an
   * archived row disappears from the everyday grid without actually
   * being destroyed. `archiveRpc` is the name of a Postgres function
   * (taking a single `target_id uuid` argument) that this table's
   * Delete button calls instead of a real `DELETE` -- the function
   * itself is responsible for setting `archivedColumn` and for any
   * other side effects archiving this specific table should have
   * (e.g. `archive_person` also clears the archived person's calling
   * assignment(s) and login link). A table with neither set behaves
   * exactly as before this existed -- a real, permanent delete.
   */
  archivedColumn?: string;
  archiveRpc?: string;
}

/**
 * A `foreignKey.createIfMissing` meetings column doesn't always carry a
 * real meetings.id -- picking a date with no meeting yet produces this
 * sentinel instead, which lib/admin/table-data.ts resolves (creating the
 * meeting, applying rotations same as any other creation path) before
 * the row is actually written. Pure string encoding, safe to import from
 * a client component (MeetingDatePicker) as well as server code.
 */
const CREATE_MEETING_PREFIX = "__create_meeting__:";

export function encodeCreateMeetingValue(dateIso: string): string {
  return `${CREATE_MEETING_PREFIX}${dateIso}`;
}

export function decodeCreateMeetingValue(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith(CREATE_MEETING_PREFIX)) return null;
  return value.slice(CREATE_MEETING_PREFIX.length);
}
