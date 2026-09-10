"use client";

import { useMemo, useState, useTransition } from "react";
import type { AdminColumnConfig, AdminOption } from "@/lib/admin/types";
import { MeetingDatePicker } from "./MeetingDatePicker";

export type AdminRow = Record<string, unknown> & { id: string };
type ActionResult = { success?: true; error?: string };
type SortDirection = "asc" | "desc";

/** Nulls/blanks always sort last regardless of direction -- a common
 *  enough convention that "reversing" a sort doesn't also mean hunting
 *  for blanks at the top. Numbers and booleans compare natively;
 *  everything else (including dates/times, which are ISO strings) is a
 *  locale-aware string compare with numeric awareness ("2" < "10"). */
function compareValues(a: unknown, b: unknown): number {
  const aBlank = a === null || a === undefined || a === "";
  const bBlank = b === null || b === undefined || b === "";
  if (aBlank && bBlank) return 0;
  if (aBlank) return 1;
  if (bBlank) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return a === b ? 0 : a ? 1 : -1;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

const INPUT_CLASS = "w-full min-w-[120px] rounded border border-rule bg-paper px-2 py-1 text-xs text-ink";

/**
 * Generic spreadsheet-style grid for one table: every row's cells are
 * editable inline, "Save" only lights up once a row is actually dirty,
 * "Delete" asks for confirmation, and a blank row at the bottom adds a
 * new one. Which columns exist and how each renders (text/select/FK
 * dropdown/etc.) comes entirely from the table's AdminColumnConfig --
 * this component has no per-table logic of its own.
 */
export function AdminTableEditor({
  table,
  columns,
  rows,
  fkOptions,
  scopedFkOptions,
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
  onUpdate: (table: string, id: string, patch: Record<string, unknown>) => Promise<ActionResult>;
  onInsert: (table: string, patch: Record<string, unknown>) => Promise<ActionResult>;
  onDelete: (table: string, id: string) => Promise<ActionResult>;
}) {
  const [drafts, setDrafts] = useState<Record<string, Record<string, unknown>>>({});
  const [newRow, setNewRow] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [sort, setSort] = useState<{ column: string; direction: SortDirection } | null>(null);

  const toggleSort = (columnKey: string) => {
    setSort((prev) => {
      if (!prev || prev.column !== columnKey) return { column: columnKey, direction: "asc" };
      if (prev.direction === "asc") return { column: columnKey, direction: "desc" };
      return null; // third click clears the sort, back to server/insertion order
    });
  };

  // Client-side only, per the open item this closes: re-sort the already-
  // fetched `rows` prop in place for display, nothing server-side or
  // persisted. select/foreign_key columns sort by their displayed label
  // (name, etc.) rather than the raw id, since sorting by UUID would be
  // meaningless -- falls back to the raw value if no option matches.
  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.column === sort.column);
    if (!column) return rows;

    let labels: Map<string, string> | null = null;
    if (column.type === "select" || column.type === "foreign_key") {
      const opts = column.type === "select" ? (column.options ?? []) : (fkOptions[column.column] ?? []);
      labels = new Map(opts.map((o) => [o.value, o.label]));
    }

    const sorted = [...rows].sort((a, b) => {
      const rawA = a[sort.column];
      const rawB = b[sort.column];
      const va = labels ? (labels.get(String(rawA)) ?? rawA) : rawA;
      const vb = labels ? (labels.get(String(rawB)) ?? rawB) : rawB;
      return compareValues(va, vb);
    });
    return sort.direction === "desc" ? sorted.reverse() : sorted;
  }, [rows, sort, columns, fkOptions]);

  // No local copy of `rows`: onUpdate/onInsert/onDelete are server actions
  // called inside startTransition, so Next refreshes this route's props
  // (via each action's revalidatePath) once the transition resolves --
  // `rows` below is always the latest server state.
  const valueFor = (row: AdminRow, column: string) => drafts[row.id]?.[column] ?? row[column];
  const isDirty = (id: string) => Boolean(drafts[id]);

  /** Real FK choices for a column, narrowed to this row's scope if the
   *  column declares scopedBy, plus any config-defined pseudo-choices. */
  const optionsFor = (column: AdminColumnConfig, row: AdminRow | null): AdminOption[] => {
    let base: AdminOption[];
    if (column.type === "select") {
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
    <div className="overflow-x-auto rounded-lg border border-rule bg-surface p-6">
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-rule text-left font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">
            {columns.map((c) => (
              <th key={c.column} className="pb-2 pr-3">
                <button
                  type="button"
                  onClick={() => toggleSort(c.column)}
                  className="flex items-center gap-1 hover:text-ink"
                  title="Sort by this column"
                >
                  {c.label}
                  <span className="w-2.5 text-[9px]">
                    {sort?.column === c.column ? (sort.direction === "asc" ? "▲" : "▼") : ""}
                  </span>
                </button>
              </th>
            ))}
            <th className="pb-2" />
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr key={row.id} className="border-b border-rule/40 last:border-0">
              {columns.map((c) => (
                <td key={c.column} className="py-2 pr-3">
                  <AdminCellInput
                    column={c}
                    value={valueFor(row, c.column)}
                    options={optionsFor(c, row)}
                    onChange={(v) => setValue(row, c, v)}
                  />
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
                    className="text-xs text-ink-muted hover:text-ink"
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
                <AdminCellInput
                  column={c}
                  value={newRow[c.column]}
                  options={optionsFor(c, null)}
                  onChange={(v) => setNewRowValue(c, v)}
                />
              </td>
            ))}
            <td className="py-2">
              <button
                type="button"
                disabled={pending}
                onClick={addRow}
                className="w-fit rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-paper transition-colors hover:bg-ink/90 disabled:opacity-50"
              >
                Add
              </button>
            </td>
          </tr>
        </tbody>
      </table>
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
        <option value="">{column.required ? "— choose —" : "— none —"}</option>
        {(options ?? []).map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  if (column.type === "long_text") {
    return (
      <textarea
        value={value == null ? "" : String(value)}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className={INPUT_CLASS}
      />
    );
  }

  const inputType = column.type === "number" ? "number" : column.type === "date" ? "date" : column.type === "time" ? "time" : "text";

  return (
    <input
      type={inputType}
      value={value == null ? "" : String(value)}
      onChange={(e) => onChange(column.type === "number" ? Number(e.target.value) : e.target.value)}
      className={INPUT_CLASS}
    />
  );
}
