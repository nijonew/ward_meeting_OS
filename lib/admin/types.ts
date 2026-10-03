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
  | "foreign_key"
  | "reverse_lookup";

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
  /** Fixed choices, for type: "select". Used directly if optionsFrom is
   *  absent; otherwise it's the fallback when that field_key has no rows
   *  yet in admin_select_options. */
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
}

export interface AdminTableConfig {
  /** Database table name -- also used as the /admin/[table] route slug. */
  table: string;
  label: string;
  description?: string;
  orderBy?: { column: string; ascending?: boolean };
  columns: AdminColumnConfig[];
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
