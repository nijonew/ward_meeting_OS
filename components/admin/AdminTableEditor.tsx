"use client";

import { useMemo, useState, useTransition } from "react";
import type { AdminColumnConfig, AdminOption } from "@/lib/admin/types";
import { MeetingDatePicker } from "./MeetingDatePicker";
import { MultiSelectDropdown } from "./MultiSelectDropdown";
import { ColumnFilterDropdown } from "@/components/ColumnFilterDropdown";
import { DualScrollbar } from "@/components/DualScrollbar";
import { usePersistedSortFilter } from "@/lib/hooks/use-persisted-sort-filter";
import { MULTI_SELECT_SEPARATOR } from "@/lib/data/announcement-constants";

/**
 * Parses a "multi_select" column's stored, joined string back into
 * individual selections -- see types.ts's own doc comment on this
 * column type for the ordering assumption this relies on (always
 * correct for data saved through the real submit form; a hand-typed
 * legacy value could parse incompletely, never destructively, since
 * nothing writes back until Save is clicked on that row). Walking
 * `options` in their own fixed order and peeling one match at a time
 * off the front of `remaining` -- rather than a naive split on the
 * separator -- is what lets an option whose own label happens to
 * contain the separator (e.g. this app's real "Ward Communications
 * (Printed, Weekly Email, Social Media, etc.)" audience value) still
 * parse correctly instead of fracturing into nonsense fragments.
 */
function parseMultiSelectValue(raw: unknown, options: AdminOption[]): string[] {
  const str = raw == null ? "" : String(raw);
  if (!str) return [];
  const selected: string[] = [];
  let remaining = str;
  for (const opt of options) {
    if (remaining === opt.value) {
      selected.push(opt.value);
      remaining = "";
      break;
    }
    if (remaining.startsWith(`${opt.value}${MULTI_SELECT_SEPARATOR}`)) {
      selected.push(opt.value);
      remaining = remaining.slice(opt.value.length + MULTI_SELECT_SEPARATOR.length);
    }
  }
  return selected;
}

/** The literal placeholder committed when "Other" is picked with
 *  nothing typed yet, matching this app's own announcement submission
 *  form's identical fallback (`resolveOtherRadio`, app/submit/actions.ts)
 *  -- so a "select_with_other" value saved from either place reads the
 *  same way everywhere else in the app that already expects it. */
const OTHER_SENTINEL = "Other";

export type AdminRow = Record<string, unknown> & { id: string };
type ActionResult = { success?: true; error?: string };

/** Nulls/blanks always sort last regardless of direction -- a common
 *  enough convention that "reversing" a sort doesn't also mean hunting
 *  for blanks at the top. Everything is compared as the same display
 *  text `cellText` resolves (see below), via a locale-aware string
 *  compare with numeric awareness ("2" < "10"). */
function compareValues(a: string, b: string): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

const INPUT_CLASS = "w-full min-w-[6rem] max-w-[16rem] rounded border border-rule bg-paper px-2 py-1 text-xs text-ink";

/**
 * Generic spreadsheet-style grid for one table: every row's cells are
 * editable inline, "Save" only lights up once a row is actually dirty,
 * "Delete" asks for confirmation, and a blank row at the bottom adds a
 * new one. Which columns exist and how each renders (text/select/FK
 * dropdown/etc.) comes entirely from the table's AdminColumnConfig --
 * this component has no per-table logic of its own.
 *
 * **Sort/filter/zebra striping extended to every Table Admin table,
 * 2026-10-12** (the user's own request: "Can we also get the zebra
 * striping, sorting, and filtering on all tables in table admin?").
 * This grid already had click-to-sort headers (2026-09-08); filtering
 * (the same Excel/Sheets-style `ColumnFilterDropdown` checklist every
 * other "favorite grid format" page already uses) and zebra striping
 * (keyed to visible row position, not DOM position -- see
 * CallingPlanningGridForm's own comment for why `:nth-child`-based
 * striping breaks once a filter hides rows) are new. Sort/filter are
 * persisted to localStorage per table (`usePersistedSortFilter`, keyed
 * by `table`) for the same reason the sibling grids already do --
 * matches this app's own established convention rather than leaving
 * Table Admin as the one place sort/filter resets on every refresh.
 *
 * Sort uses each row's *committed* value only (not an in-progress,
 * unsaved edit) so sorting never jumps a row out from under someone
 * mid-edit -- same rule CallingPlanningGridForm already established.
 * Filtering, by contrast, reacts live to `drafts` (already tracked in
 * this component's own React state, unlike the sibling grids' plain
 * uncontrolled inputs) -- editing a cell to a value the active filter
 * excludes hides that row immediately, matching Calling Planning's own
 * "if I move something to complete I'd like that row to disappear"
 * behavior.
 */
export function AdminTableEditor({
  table,
  columns,
  rows,
  fkOptions,
  scopedFkOptions,
  reverseLookupValues,
  onUpdate,
  onInsert,
  onDelete,
}: {
  table: string;
  columns: AdminColumnConfig[];
  rows: AdminRow[];
  fkOptions: Record<string, AdminOption[]>;
  /** Per-column, per-scope-value option overrides -- see AdminColumnConfig.scopedBy. */
  scopedFkOptions?: Record<string, Record<string, AdminOption[]>>;
  /** Per-column, per-row display text for a reverse_lookup column --
   *  see AdminColumnConfig.reverseLookup. */
  reverseLookupValues?: Record<string, Record<string, string>>;
  onUpdate: (table: string, id: string, patch: Record<string, unknown>) => Promise<ActionResult>;
  onInsert: (table: string, patch: Record<string, unknown>) => Promise<ActionResult>;
  onDelete: (table: string, id: string) => Promise<ActionResult>;
}) {
  const [drafts, setDrafts] = useState<Record<string, Record<string, unknown>>>({});
  const [newRow, setNewRow] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { sort, setSort, filters, setFilters } = usePersistedSortFilter<string>(`table-admin-${table}-sort-filter`);

  const toggleSort = (columnKey: string) => {
    setSort((prev) => {
      if (!prev || prev.key !== columnKey) return { key: columnKey, direction: "asc" };
      if (prev.direction === "asc") return { key: columnKey, direction: "desc" };
      return null; // third click clears the sort, back to server/insertion order
    });
  };

  // No local copy of `rows`: onUpdate/onInsert/onDelete are server actions
  // called inside startTransition, so Next refreshes this route's props
  // (via each action's revalidatePath) once the transition resolves --
  // `rows` below is always the latest server state.
  const valueFor = (row: AdminRow, column: string) => drafts[row.id]?.[column] ?? row[column];
  const isDirty = (id: string) => Boolean(drafts[id]);

  // Resolves any column's value to the display text sort/filter/the
  // column-filter checklist all compare against -- select/foreign_key
  // resolve to their option's label (sorting/filtering by raw UUID
  // would be meaningless), reverse_lookup reads the precomputed map
  // (it has no real column on this row to draft at all), boolean
  // becomes Yes/No, everything else is just its string form.
  const resolveDisplayText = (column: AdminColumnConfig, raw: unknown, row: AdminRow): string => {
    if (column.type === "reverse_lookup") {
      return reverseLookupValues?.[column.column]?.[row.id] ?? "";
    }
    if (column.type === "presence_indicator") {
      return raw ? column.presenceIndicator?.trueLabel ?? "Yes" : column.presenceIndicator?.falseLabel ?? "No";
    }
    // A booleanAsText column stores plain text ("youth"/"adult"), not a
    // real boolean -- any non-empty string would otherwise read as
    // truthy and sort/filter as "Yes" regardless of its actual value.
    if (column.type === "boolean" && !column.booleanAsText) return raw ? "Yes" : "No";
    if (column.type === "select" || column.type === "select_with_other" || column.type === "foreign_key") {
      const opts = column.type === "foreign_key" ? (fkOptions[column.column] ?? []) : (column.options ?? []);
      const label = opts.find((o) => o.value === String(raw))?.label;
      // select_with_other falls through to the raw text below when no
      // fixed option matches (a genuine "Other" answer) -- unlike plain
      // "select"/"foreign_key", where that would mean stale/bad data.
      if (label) return label;
    }
    if (raw === null || raw === undefined || raw === "") return "";
    return String(raw);
  };

  // Committed (last-saved) display text -- used for sorting and for the
  // column-filter dropdown's own list of distinct values, so neither
  // jumps around while a cell is mid-edit.
  const cellText = (row: AdminRow, column: AdminColumnConfig): string => resolveDisplayText(column, row[column.column], row);
  // Draft-aware display text -- used for filter *matching*, so editing a
  // cell to a value the active filter excludes hides that row right
  // away (matches CallingPlanningGridForm's own live-filter behavior).
  const liveCellText = (row: AdminRow, column: AdminColumnConfig): string =>
    resolveDisplayText(column, valueFor(row, column.column), row);

  // Client-side only, per the open item this closes: re-sort the already-
  // fetched `rows` prop in place for display, nothing server-side or
  // persisted.
  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.column === sort.key);
    if (!column) return rows;
    const sorted = [...rows].sort((a, b) => compareValues(cellText(a, column), cellText(b, column)));
    return sort.direction === "desc" ? sorted.reverse() : sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cellText closes over fkOptions/reverseLookupValues already in deps
  }, [rows, sort, columns, fkOptions, reverseLookupValues]);

  // Every distinct value per column, across the whole (unsorted,
  // unfiltered) dataset -- what each column's own filter dropdown
  // offers, independent of any other column's active filter (matching
  // Excel's own AutoFilter).
  const columnValues = useMemo(() => {
    const result: Record<string, string[]> = {};
    for (const c of columns) {
      result[c.column] = [...new Set(rows.map((r) => cellText(r, c)))];
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cellText closes over fkOptions/reverseLookupValues already in deps
  }, [rows, columns, fkOptions, reverseLookupValues]);

  const matchesFilters = (row: AdminRow) =>
    columns.every((c) => {
      const excluded = filters[c.column];
      return excluded == null || !excluded.has(liveCellText(row, c));
    });

  // Which stripe (if any) each VISIBLE row gets, keyed by row id --
  // walks sortedRows in order and skips anything the active filters
  // hide, so striping always strictly alternates across whatever's
  // actually on screen (not DOM position, which still includes
  // filtered-out rows -- see this file's own doc comment).
  const stripeByRowId = new Map<string, boolean>();
  {
    let visibleIndex = 0;
    for (const row of sortedRows) {
      if (!matchesFilters(row)) continue;
      stripeByRowId.set(row.id, visibleIndex % 2 === 1);
      visibleIndex++;
    }
  }
  const visibleCount = stripeByRowId.size;

  /** Real FK choices for a column, narrowed to this row's scope if the
   *  column declares scopedBy, plus any config-defined pseudo-choices. */
  const optionsFor = (column: AdminColumnConfig, row: AdminRow | null): AdminOption[] => {
    let base: AdminOption[];
    if (column.type === "select" || column.type === "select_with_other" || column.type === "multi_select") {
      base = column.options ?? [];
    } else if (column.scopedBy && row) {
      const scopeValue = valueFor(row, column.scopedBy.scopeColumn);
      base = scopedFkOptions?.[column.column]?.[String(scopeValue)] ?? fkOptions[column.column] ?? [];
    } else {
      base = fkOptions[column.column] ?? [];
    }
    return column.specialOptions ? [...base, ...column.specialOptions] : base;
  };

  // A specialOptions pick (e.g. "Previously Vacant") isn't a real foreign
  // key value: it sets this column to null and merges its `patch` into
  // the rest of the row, in one save.
  const resolveSpecial = (column: AdminColumnConfig, value: unknown) =>
    typeof value === "string" ? column.specialOptions?.find((o) => o.value === value) : undefined;

  const setValue = (row: AdminRow, column: AdminColumnConfig, value: unknown) => {
    const special = resolveSpecial(column, value);
    setDrafts((prev) => ({
      ...prev,
      [row.id]: { ...(prev[row.id] ?? {}), [column.column]: special ? null : value, ...(special?.patch ?? {}) },
    }));
  };

  const setNewRowValue = (column: AdminColumnConfig, value: unknown) => {
    const special = resolveSpecial(column, value);
    setNewRow((prev) => ({ ...prev, [column.column]: special ? null : value, ...(special?.patch ?? {}) }));
  };

  const saveRow = (row: AdminRow) => {
    const patch = drafts[row.id];
    if (!patch) return;
    setError(null);
    startTransition(async () => {
      const result = await onUpdate(table, row.id, patch);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
    });
  };

  const removeRow = (row: AdminRow) => {
    if (!window.confirm("Delete this row? This cannot be undone.")) return;
    setError(null);
    startTransition(async () => {
      const result = await onDelete(table, row.id);
      if (result.error) setError(result.error);
    });
  };

  const addRow = () => {
    setError(null);
    startTransition(async () => {
      const result = await onInsert(table, newRow);
      if (result.error) {
        setError(result.error);
        return;
      }
      setNewRow({});
    });
  };

  return (
    <div className="rounded border border-rule bg-surface p-6">
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      <DualScrollbar>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-left font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">
            {columns.map((c) => (
              <th key={c.column} className="pb-2 pr-3">
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => toggleSort(c.column)}
                    className="flex items-center gap-1 hover:text-ink"
                    title="Sort by this column"
                  >
                    {c.label}
                    <span className="w-2.5 text-[9px]">
                      {sort?.key === c.column ? (sort.direction === "asc" ? "▲" : "▼") : ""}
                    </span>
                  </button>
                  <ColumnFilterDropdown
                    values={columnValues[c.column] ?? []}
                    excluded={filters[c.column] ?? null}
                    onChange={(next) => setFilters((prev) => ({ ...prev, [c.column]: next }))}
                  />
                </div>
              </th>
            ))}
            <th className="pb-2" />
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr
              key={row.id}
              hidden={!stripeByRowId.has(row.id)}
              className={[
                "border-b border-rule/40 align-top last:border-0 hover:bg-accent/15",
                stripeByRowId.get(row.id) ? "bg-accent-soft" : "",
              ].join(" ")}
            >
              {columns.map((c) => (
                <td key={c.column} className="py-2 pr-3">
                  {c.type === "reverse_lookup" ? (
                    <span className="block max-w-[16rem] whitespace-normal break-words text-xs text-ink-muted">
                      {reverseLookupValues?.[c.column]?.[row.id] || "—"}
                    </span>
                  ) : c.type === "presence_indicator" ? (
                    <span className="block text-xs text-ink-muted">{cellText(row, c) || "—"}</span>
                  ) : (
                    <AdminCellInput
                      column={c}
                      value={valueFor(row, c.column)}
                      options={optionsFor(c, row)}
                      onChange={(v) => setValue(row, c, v)}
                    />
                  )}
                </td>
              ))}
              <td className="whitespace-nowrap py-2">
                <span className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!isDirty(row.id) || pending}
                    onClick={() => saveRow(row)}
                    className="text-xs text-ink-muted hover:text-ink disabled:opacity-30"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => removeRow(row)}
                    className="text-xs text-danger/70 hover:text-danger"
                  >
                    Delete
                  </button>
                </span>
              </td>
            </tr>
          ))}

          <tr className="border-t-2 border-rule">
            {columns.map((c) => (
              <td key={c.column} className="py-2 pr-3">
                {c.type === "reverse_lookup" || c.type === "presence_indicator" ? (
                  <span className="text-xs text-ink-muted/50">—</span>
                ) : (
                  <AdminCellInput
                    column={c}
                    value={newRow[c.column]}
                    options={optionsFor(c, null)}
                    onChange={(v) => setNewRowValue(c, v)}
                  />
                )}
              </td>
            ))}
            <td className="py-2">
              <button
                type="button"
                disabled={pending}
                onClick={addRow}
                className="w-fit rounded bg-accent px-3 py-1.5 text-xs font-medium text-paper transition-colors hover:bg-accent-deep disabled:opacity-50"
              >
                Add
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      </DualScrollbar>
      {rows.length > 0 && visibleCount === 0 && <p className="mt-3 text-sm text-ink-muted">No rows match the current filters.</p>}
    </div>
  );
}

function AdminCellInput({
  column,
  value,
  options,
  onChange,
}: {
  column: AdminColumnConfig;
  value: unknown;
  options?: AdminOption[];
  onChange: (value: unknown) => void;
}) {
  if (column.type === "boolean" && column.booleanAsText) {
    const { trueValue, falseValue, checkboxLabel } = column.booleanAsText;
    return (
      <label className="flex items-center gap-1.5 text-xs text-ink">
        <input
          type="checkbox"
          checked={value === trueValue}
          onChange={(e) => onChange(e.target.checked ? trueValue : falseValue)}
        />
        {checkboxLabel}
      </label>
    );
  }

  if (column.type === "boolean") {
    return <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />;
  }

  if (column.type === "foreign_key" && column.foreignKey?.table === "meetings") {
    return (
      <MeetingDatePicker
        value={value}
        options={options ?? []}
        required={column.required}
        allowCreate={column.foreignKey.createIfMissing}
        onChange={onChange}
      />
    );
  }

  if (column.type === "select" || column.type === "foreign_key") {
    return (
      <select value={value == null ? "" : String(value)} onChange={(e) => onChange(e.target.value)} className={INPUT_CLASS}>
        <option value="">{column.required ? "Choose" : "None"}</option>
        {(options ?? []).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  if (column.type === "select_with_other") {
    const stringValue = value == null ? "" : String(value);
    const isFixedOption = (options ?? []).some((o) => o.value === stringValue);
    // Anything that isn't blank and doesn't match a fixed option is a
    // genuine "Other" answer (including the literal word "Other" itself,
    // the fallback this app's own submit form commits when "Other" is
    // picked with nothing typed) -- the dropdown shows "Other" selected
    // for all of those, never leaving a real answer stranded off the list.
    const selectValue = stringValue === "" ? "" : isFixedOption ? stringValue : OTHER_SENTINEL;
    return (
      <div className="flex flex-col gap-1">
        <select
          value={selectValue}
          onChange={(e) => onChange(e.target.value === OTHER_SENTINEL ? OTHER_SENTINEL : e.target.value)}
          className={INPUT_CLASS}
        >
          <option value="">{column.required ? "Choose" : "None"}</option>
          {(options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
          <option value={OTHER_SENTINEL}>Other</option>
        </select>
        {selectValue === OTHER_SENTINEL && (
          <input
            type="text"
            value={stringValue === OTHER_SENTINEL ? "" : stringValue}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Other (please specify)"
            className={INPUT_CLASS}
          />
        )}
      </div>
    );
  }

  if (column.type === "multi_select") {
    const selected = parseMultiSelectValue(value, options ?? []);
    return (
      <MultiSelectDropdown
        options={options ?? []}
        selected={selected}
        onChange={(next) => onChange(next.join(MULTI_SELECT_SEPARATOR))}
      />
    );
  }

  if (column.type === "long_text" || (column.type === "text" && column.wrap)) {
    return (
      <textarea
        value={value == null ? "" : String(value)}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className={`${INPUT_CLASS} resize-y`}
      />
    );
  }

  const inputType = column.type === "number" ? "number" : column.type === "date" ? "date" : column.type === "time" ? "time" : "text";

  // Native date/time inputs have no reliable, discoverable way to
  // clear a value once set -- the little "x" some browsers show is
  // hover-only (invisible on touch/trackpad) and inconsistent across
  // browsers, and selecting the text and pressing Delete doesn't
  // always work either. A real "Clear" button next to the input
  // (2026-10-25, the user's own request: "I need a way to remove the
  // time or date of an announcement") fixes this for every date/time
  // column in Table Admin, not just Announcements' -- onChange("")
  // already saves correctly as `null` (`sanitizePatch`,
  // lib/admin/table-data.ts, converts an empty string to null for
  // every non-text column type). Only shown once there's actually a
  // value to clear.
  if (inputType === "date" || inputType === "time") {
    return (
      <div className="flex items-center gap-1">
        <input
          type={inputType}
          value={value == null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value)}
          className={INPUT_CLASS}
        />
        {value != null && String(value) !== "" && (
          <button
            type="button"
            onClick={() => onChange("")}
            title={`Clear ${inputType}`}
            className="text-xs text-ink-muted hover:text-danger"
          >
            &times;
          </button>
        )}
      </div>
    );
  }

  return (
    <input
      type={inputType}
      value={value == null ? "" : String(value)}
      onChange={(e) => onChange(column.type === "number" ? Number(e.target.value) : e.target.value)}
      className={INPUT_CLASS}
    />
  );
}
