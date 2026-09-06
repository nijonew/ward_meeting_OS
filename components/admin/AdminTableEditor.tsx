"use client";

import { useState, useTransition } from "react";
import type { AdminColumnConfig, AdminOption } from "@/lib/admin/types";
import { MeetingDatePicker } from "./MeetingDatePicker";

export type AdminRow = Record<string, unknown> & { id: string };
type ActionResult = { success?: true; error?: string };

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
    <div className="overflow-x-auto rounded-lg border border-rule bg-card p-6">
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-rule text-left font-mono text-[10px] uppercase tracking-widest text-slate/70">
            {columns.map((c) => (
              <th key={c.column} className="pb-2 pr-3">
                {c.label}
              </th>
            ))}
            <th className="pb-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
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
                    className="text-xs text-slate hover:text-ink disabled:opacity-30"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => removeRow(row)}
                    className="text-xs text-slate hover:text-ink"
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
