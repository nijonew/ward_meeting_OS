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
  | "foreign_key";

export interface AdminColumnConfig {
  /** Actual database column name. */
  column: string;
  /** Display label for the grid header. */
  label: string;
  type: AdminColumnType;
  required?: boolean;
  /** Fixed choices, for type: "select". */
  options?: { value: string; label: string }[];
  /** Lookup target, for type: "foreign_key". */
  foreignKey?: { table: string; valueColumn: string; labelColumn: string };
}

export interface AdminTableConfig {
  /** Database table name -- also used as the /admin/[table] route slug. */
  table: string;
  label: string;
  description?: string;
  orderBy?: { column: string; ascending?: boolean };
  columns: AdminColumnConfig[];
}
