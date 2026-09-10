"use client";

import { useMemo, useState, useTransition, useActionState } from "react";
import { saveCallingPlanningGrid, deleteCallingPlanningEntry } from "@/app/calling-planning/actions";
import { MultiPersonSelect } from "@/components/calling-planning/MultiPersonSelect";
import type { CallingPlanningRow, CallingOption } from "@/lib/data/calling-planning";
import type { PersonOption } from "@/lib/data/people";
import type { SelectOption } from "@/lib/data/select-options";

const initialState: { error?: string; success?: boolean } = {};
const INPUT_CLASS = "w-full min-w-[9rem] rounded-md border border-rule bg-paper px-2 py-1.5 text-xs text-ink";
type SortDirection = "asc" | "desc";

const COLUMNS = [
  { key: "calling", label: "Calling" },
  { key: "date_initiated", label: "Date Initiated" },
  { key: "candidates", label: "Candidates" },
  { key: "status", label: "Status" },
  { key: "date_set_apart", label: "Date Set Apart" },
  { key: "notes", label: "Notes" },
  { key: "release_person", label: "Person Being Released" },
  { key: "release_status", label: "Release Status" },
] as const;
type ColumnKey = (typeof COLUMNS)[number]["key"];

/** Nulls/blanks sort and filter as empty, always last when sorting --
 *  same convention as AdminTableEditor's sortable headers. */
function compareText(a: string, b: string): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/**
 * The flat grid the user actually wants (2026-09-08): one row per
 * potential calling change, across every calling, matching their own
 * spreadsheet -- "our favorite grid format," the same
 * dirty-tracking/save-all pattern already built for Assignment
 * Rotations and Teaching Calendar. Delete is a plain button calling the
 * server action directly (via useTransition) rather than a nested
 * <form> -- HTML forbids a <form> inside another <form>, and the whole
 * table here is already wrapped in one for the Save All button.
 *
 * Sort/filter (2026-09-08, the user's own follow-up) are purely
 * client-side over the already-fetched `rows` prop, same principle as
 * AdminTableEditor's sortable headers -- they reorder/hide which rows
 * render, they never touch what gets saved. Both compare against each
 * column's *committed* (last-saved) value, not an in-progress edit
 * still sitting in an uncontrolled input -- editing a cell doesn't
 * live-resort the table out from under you mid-edit.
 */
export function CallingPlanningGridForm({
  rows,
  callingOptions,
  people,
  callingStatusOptions,
  releaseStatusOptions,
}: {
  rows: CallingPlanningRow[];
  callingOptions: CallingOption[];
  people: PersonOption[];
  callingStatusOptions: SelectOption[];
  releaseStatusOptions: SelectOption[];
}) {
  const [state, formAction, pending] = useActionState(saveCallingPlanningGrid, initialState);
  const [dirty, setDirty] = useState(false);
  const [deleting, startDeleteTransition] = useTransition();
  const [sort, setSort] = useState<{ key: ColumnKey; direction: SortDirection } | null>(null);
  const [filters, setFilters] = useState<Partial<Record<ColumnKey, string>>>({});

  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (state.success && dirty) setDirty(false);
  }

  const removeRow = (id: string) => {
    if (!window.confirm("Delete this calling change? This cannot be undone.")) return;
    startDeleteTransition(async () => {
      await deleteCallingPlanningEntry(id);
    });
  };

  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p.name])), [people]);
  const callingStatusLabels = useMemo(() => new Map(callingStatusOptions.map((s) => [s.value, s.label])), [callingStatusOptions]);
  const releaseStatusLabels = useMemo(() => new Map(releaseStatusOptions.map((s) => [s.value, s.label])), [releaseStatusOptions]);

  const cellText = (row: CallingPlanningRow, key: ColumnKey): string => {
    switch (key) {
      case "calling":
        return row.calling_name;
      case "date_initiated":
        return row.date_initiated ?? "";
      case "candidates":
        return row.candidate_person_ids
          .map((id) => peopleById.get(id))
          .filter((name): name is string => Boolean(name))
          .join(", ");
      case "status":
        return callingStatusLabels.get(row.calling_status) ?? row.calling_status;
      case "date_set_apart":
        return row.date_set_apart ?? "";
      case "notes":
        return row.notes ?? "";
      case "release_person":
        return row.release_person_id ? (peopleById.get(row.release_person_id) ?? "") : "";
      case "release_status":
        return releaseStatusLabels.get(row.release_status) ?? row.release_status;
    }
  };

  const toggleSort = (key: ColumnKey) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  };

  // Sorted, and every row still rendered regardless of the filter --
  // only visually hidden (`hidden` attribute, not removed from the
  // array/DOM) below. A row a filter hides is still mounted with its
  // fields intact, so an in-progress edit on it isn't silently dropped
  // from the next Save All Changes just because a filter typed after
  // that edit happens to hide it from view.
  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const result = [...rows].sort((a, b) => compareText(cellText(a, sort.key), cellText(b, sort.key)));
    if (sort.direction === "desc") result.reverse();
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cellText closes over people/status-label maps already in deps below
  }, [rows, sort, peopleById, callingStatusLabels, releaseStatusLabels]);

  const activeFilters = Object.entries(filters).filter(([, v]) => v && v.trim() !== "") as [ColumnKey, string][];
  const matchesFilters = (row: CallingPlanningRow) =>
    activeFilters.every(([key, needle]) => cellText(row, key).toLowerCase().includes(needle.trim().toLowerCase()));
  const visibleCount = activeFilters.length === 0 ? sortedRows.length : sortedRows.filter(matchesFilters).length;

  return (
    <form action={formAction} onChange={() => setDirty(true)}>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} className="px-2 py-2 text-left font-mono text-[10px] uppercase tracking-widest text-ink-muted/70">
                  <button
                    type="button"
                    onClick={() => toggleSort(c.key)}
                    className="flex items-center gap-1 hover:text-ink"
                    title="Sort by this column"
                  >
                    {c.label}
                    <span className="w-2.5 text-[9px]">
                      {sort?.key === c.key ? (sort.direction === "asc" ? "▲" : "▼") : ""}
                    </span>
                  </button>
                  <input
                    type="text"
                    value={filters[c.key] ?? ""}
                    onChange={(e) => setFilters((prev) => ({ ...prev, [c.key]: e.target.value }))}
                    placeholder="Filter…"
                    className="mt-1 w-full rounded border border-rule/60 bg-paper px-1.5 py-0.5 text-[10px] normal-case tracking-normal text-ink"
                  />
                </th>
              ))}
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr key={row.id} hidden={!matchesFilters(row)} className="border-t border-rule/60 align-top">
                <td className="px-2 py-1.5">
                  <select name={`${row.id}::calling_id`} defaultValue={row.calling_id} className={INPUT_CLASS}>
                    {callingOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="date"
                    name={`${row.id}::date_initiated`}
                    defaultValue={row.date_initiated ?? ""}
                    className={INPUT_CLASS}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <MultiPersonSelect
                    name={`${row.id}::candidate_person_ids`}
                    people={people}
                    value={row.candidate_person_ids}
                    onDirty={() => setDirty(true)}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <select name={`${row.id}::calling_status`} defaultValue={row.calling_status} className={INPUT_CLASS}>
                    {callingStatusOptions.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="date"
                    name={`${row.id}::date_set_apart`}
                    defaultValue={row.date_set_apart ?? ""}
                    className={INPUT_CLASS}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <textarea name={`${row.id}::notes`} defaultValue={row.notes ?? ""} rows={2} className={INPUT_CLASS} />
                </td>
                <td className="px-2 py-1.5">
                  <select name={`${row.id}::release_person_id`} defaultValue={row.release_person_id ?? ""} className={INPUT_CLASS}>
                    <option value="">&mdash; None / Previously Vacant &mdash;</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <select name={`${row.id}::release_status`} defaultValue={row.release_status} className={INPUT_CLASS}>
                    {releaseStatusOptions.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => removeRow(row.id)}
                    className="text-xs text-ink-muted hover:text-ink disabled:opacity-30"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visibleCount === 0 && <p className="mt-3 text-sm text-ink-muted">No rows match the current filters.</p>}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={!dirty || pending}
          className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Saving..." : "Save All Changes"}
        </button>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {!pending && !dirty && state.success && !state.error && <p className="text-sm text-success">Saved.</p>}
      </div>
    </form>
  );
}
