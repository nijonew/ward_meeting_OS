"use client";

import { useMemo, useState, useTransition, useActionState } from "react";
import { saveCallingPlanningGrid, deleteCallingPlanningEntry } from "@/app/calling-planning/actions";
import { MultiPersonSelect } from "@/components/calling-planning/MultiPersonSelect";
import { ColumnFilterDropdown } from "@/components/ColumnFilterDropdown";
import type { CallingPlanningRow, CallingOption } from "@/lib/data/calling-planning";
import type { PersonOption } from "@/lib/data/people";
import type { SelectOption } from "@/lib/data/select-options";

const initialState: { error?: string; success?: boolean } = {};
const INPUT_CLASS = "w-full min-w-[9rem] rounded border border-rule bg-paper px-2 py-1.5 text-xs text-ink";
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
 * render, they never touch what gets saved.
 *
 * **Filter reacts live to in-progress edits, 2026-10-10** (the user's
 * own request: "if I have complete filtered out and not shown, and
 * then I move something to complete I would like for that row to
 * disappear"). Every field's own `name` attribute already doubles as
 * its row/column address (`"<rowId>::<column>"`), so the form's
 * existing single delegated `onChange` -- already there to flip the
 * dirty flag -- also now records that field's live raw value into
 * `liveValues`, keyed by that same name. `liveCellText` prefers a raw
 * live value over the row's committed one when present, resolving it
 * through the same label-lookup maps `cellText` itself uses (a
 * `<select>`'s DOM value is the option's *value*, e.g. "complete" or a
 * calling/person uuid -- not the label text filters actually compare
 * against) -- `matchesFilters` uses this, so unchecking a status in
 * that column's filter immediately hides a row the moment its own
 * dropdown is changed to that status, not only after a save completes.
 * **Sort still deliberately stays on committed values only**
 * (`cellText`, not `liveCellText`) -- the original reasoning holds
 * there: live-resorting the table out from under an in-progress edit
 * is a worse experience than a row simply disappearing when filtered
 * out, which is exactly the behavior being asked for here. Candidates
 * (`MultiPersonSelect`) isn't live-tracked -- it manages its own hidden
 * inputs outside the native change-event path (see that component's
 * own comment), so there's no single DOM value to capture here either;
 * filtering that column still reacts only once a save completes.
 *
 * **Row contrast, 2026-10-10** (the user's own report: "rows blend
 * together quite a bit"), applied identically across every "favorite
 * grid format" page -- this one, ActivitiesTable, AssignmentGridForm,
 * TeachingGridForm, and the Dashboard meeting list -- for a consistent
 * look: `even:bg-ink/5` zebra striping (same 5% opacity this app
 * already uses for a cancelled row's `bg-danger/5` tint, just neutral)
 * plus `hover:bg-ink/[0.08]` so the row under the pointer stands out
 * further while you're actively editing it. One known, accepted
 * cosmetic quirk here specifically: filtered-out rows stay in the DOM
 * (`hidden`, not removed -- see this file's own reasoning above), so
 * `even:` (a pure CSS `:nth-child` selector) counts hidden rows toward
 * its parity too -- after filtering, two consecutive *visible* rows can
 * occasionally land on the same shade instead of strictly alternating.
 * Still a real improvement over no striping at all, and not worth a
 * JS-computed visible-index to fix.
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
  // null (or unset) = every value showing, matching ColumnFilterDropdown's
  // own Excel-style semantics -- see that component's doc comment.
  const [filters, setFilters] = useState<Partial<Record<ColumnKey, Set<string> | null>>>({});
  // Raw, in-progress field values, keyed by that field's own `name`
  // attribute ("<rowId>::<column>") -- captured by the form's onChange
  // below, read back by liveCellText for live filtering. See this
  // component's own doc comment for the full reasoning.
  const [liveValues, setLiveValues] = useState<Record<string, string>>({});

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
  const callingNameById = useMemo(() => new Map(callingOptions.map((c) => [c.id, c.name])), [callingOptions]);
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

  // Which field name (if any) a column's live value would be captured
  // under -- "candidates" has none, see this component's own doc comment.
  const fieldNameFor = (rowId: string, key: ColumnKey): string | null => {
    switch (key) {
      case "calling":
        return `${rowId}::calling_id`;
      case "date_initiated":
        return `${rowId}::date_initiated`;
      case "candidates":
        return null;
      case "status":
        return `${rowId}::calling_status`;
      case "date_set_apart":
        return `${rowId}::date_set_apart`;
      case "notes":
        return `${rowId}::notes`;
      case "release_person":
        return `${rowId}::release_person_id`;
      case "release_status":
        return `${rowId}::release_status`;
    }
  };

  // A <select>'s raw DOM value is the option's value (a status key or
  // a calling/person uuid), not the label text filters compare
  // against -- resolve it through the same maps cellText itself uses.
  // date/notes fields' raw value already *is* display text.
  const resolveLiveRaw = (key: ColumnKey, raw: string): string => {
    switch (key) {
      case "calling":
        return callingNameById.get(raw) ?? raw;
      case "status":
        return callingStatusLabels.get(raw) ?? raw;
      case "release_person":
        return raw ? (peopleById.get(raw) ?? raw) : "";
      case "release_status":
        return releaseStatusLabels.get(raw) ?? raw;
      default:
        return raw;
    }
  };

  const liveCellText = (row: CallingPlanningRow, key: ColumnKey): string => {
    const fieldName = fieldNameFor(row.id, key);
    if (fieldName && fieldName in liveValues) {
      return resolveLiveRaw(key, liveValues[fieldName]);
    }
    return cellText(row, key);
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

  // Every distinct value per column, across the whole (unsorted,
  // unfiltered) dataset -- what each column's own filter dropdown
  // offers to pick from. Independent per column, matching Excel's own
  // AutoFilter (not re-narrowed by other columns' active filters).
  const columnValues = useMemo(() => {
    const result = {} as Record<ColumnKey, string[]>;
    for (const c of COLUMNS) {
      result[c.key] = [...new Set(rows.map((r) => cellText(r, c.key)))];
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cellText closes over people/status-label maps already in deps below
  }, [rows, peopleById, callingStatusLabels, releaseStatusLabels]);

  const matchesFilters = (row: CallingPlanningRow) =>
    COLUMNS.every((c) => {
      const selected = filters[c.key];
      return selected == null || selected.has(liveCellText(row, c.key));
    });
  const visibleCount = sortedRows.filter(matchesFilters).length;

  return (
    <form
      action={formAction}
      onChange={(e) => {
        setDirty(true);
        // React types a <form>'s own onChange target as the form itself
        // (incorrect at runtime -- it's whichever field inside actually
        // changed, via native bubbling), hence the cast through unknown.
        const target = e.target as unknown as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        if (target.name) {
          setLiveValues((prev) => ({ ...prev, [target.name]: target.value }));
        }
      }}
    >
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} className="px-2 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">
                  <div className="flex items-center">
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
                    <ColumnFilterDropdown
                      values={columnValues[c.key]}
                      selected={filters[c.key] ?? null}
                      onChange={(next) => setFilters((prev) => ({ ...prev, [c.key]: next }))}
                    />
                  </div>
                </th>
              ))}
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr
                key={row.id}
                hidden={!matchesFilters(row)}
                className="border-t border-rule/60 align-top even:bg-ink/5 hover:bg-ink/[0.08]"
              >
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
                    <option value="">None / Previously Vacant</option>
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
                    className="text-xs text-danger/70 hover:text-danger disabled:opacity-30"
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
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Saving..." : "Save All Changes"}
        </button>
        {state.error && <p className="text-sm text-danger">{state.error}</p>}
        {!pending && !dirty && state.success && !state.error && <p className="text-sm text-success">Saved.</p>}
      </div>
    </form>
  );
}
