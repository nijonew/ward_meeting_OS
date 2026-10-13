"use client";

import { useMemo, useState, useTransition, useActionState } from "react";
import { saveCallingPlanningGrid, deleteCallingPlanningEntry } from "@/app/calling-planning/actions";
import { MultiPersonSelect } from "@/components/calling-planning/MultiPersonSelect";
import { ColumnFilterDropdown } from "@/components/ColumnFilterDropdown";
import { usePersistedSortFilter } from "@/lib/hooks/use-persisted-sort-filter";
import type { CallingPlanningRow, CallingOption } from "@/lib/data/calling-planning";
import type { PersonOption } from "@/lib/data/people";
import type { SelectOption } from "@/lib/data/select-options";

const initialState: { error?: string; success?: boolean } = {};
// Reduced from min-w-[9rem] and capped with a max-w (2026-10-12, the
// user's own report that this many-column grid's horizontal scrollbar
// is "clunky" and they'd "prefer to see the line wrapped") -- eight
// 9rem-wide columns forced a ~72rem-wide table regardless of actual
// content, triggering a scrollbar even when nothing was really
// overflowing. Notes (the one field long enough to actually need
// wrapping) is already a <textarea>, which wraps natively within this
// same class's max-w.
const INPUT_CLASS = "w-full min-w-[7rem] max-w-[16rem] rounded border border-rule bg-paper px-2 py-1.5 text-xs text-ink";
const STORAGE_KEY = "calling-planning-grid-sort-filter";

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
 * look. **Revised same day** -- neutral gray striping wasn't distinct
 * enough either ("I think the zebra stripe needs to be more distinct.
 * perhaps in the color scheme with the red but very light"): this
 * app's own `accent` color is actually a warm brick-red hue
 * (`oklch(38% 0.11 20)`, see design.md), with a dedicated
 * `accent-soft` token already defined for exactly this
 * ("current-item row highlight") but never actually used anywhere
 * until now. Zebra striping is `even:bg-accent-soft`; hover is
 * `hover:bg-accent/15`, a stronger step in the same warm hue so the
 * row under the pointer reads as clearly more emphasized than the
 * zebra tint alone, not just a different shade of gray.
 *
 * **Striping fixed to key off visible position, not DOM position,
 * 2026-10-11** (the user's own report: "when we sort and filter can we
 * then redo the zebra striping so we don't end up with several of the
 * same color stacked on top of each other?"). The original `even:`
 * (a pure CSS `:nth-child` selector) was flagged above as a known,
 * accepted quirk -- filtered-out rows stay mounted in the DOM (`hidden`,
 * not removed, so an in-progress edit on one isn't dropped from the
 * next Save All Changes), and `:nth-child` counts those hidden rows
 * toward its own parity, so two consecutive *visible* rows could land
 * on the same shade right after a filter changed which rows show.
 * "Accepted" turned out not to hold once it actually happened in
 * practice. `stripeByRowId` (below, computed fresh each render since it
 * has to track live in-progress filtering too) walks `sortedRows` in
 * order and assigns alternating stripes only to rows that pass
 * `matchesFilters`, skipping hidden ones entirely -- striping now
 * always strictly alternates across whatever's actually on screen,
 * regardless of how many hidden rows sit between them in the DOM.
 *
 * **Sort/filter persisted across page refreshes, 2026-10-10** (the
 * user's own request: "is there a way to remember the sorts and
 * filters so they don't reset every time the page is refreshed") --
 * `sort`/`filters` now come from `usePersistedSortFilter`
 * (`lib/hooks/use-persisted-sort-filter.ts`), a localStorage-backed
 * drop-in replacement for the plain `useState` these used to be. See
 * that hook's own comment for the full reasoning (including why it
 * doesn't risk a hydration mismatch).
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
  // Persisted to localStorage across page refreshes -- see
  // usePersistedSortFilter's own doc comment. null (or an unset column
  // key) means every value showing, matching ColumnFilterDropdown's own
  // Excel-style semantics -- see that component's doc comment.
  const { sort, setSort, filters, setFilters } = usePersistedSortFilter<ColumnKey>(STORAGE_KEY);
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

  // Which stripe (if any) each VISIBLE row gets, keyed by row id --
  // see this component's own doc comment for why this replaced plain
  // CSS `even:` striping. Recomputed every render (cheap, and has to
  // track live in-progress filtering via matchesFilters/liveCellText
  // anyway), not memoized.
  const stripeByRowId = new Map<string, boolean>();
  {
    let visibleIndex = 0;
    for (const row of sortedRows) {
      if (!matchesFilters(row)) continue;
      stripeByRowId.set(row.id, visibleIndex % 2 === 1);
      visibleIndex++;
    }
  }

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
                hidden={!stripeByRowId.has(row.id)}
                className={[
                  "border-t border-rule/60 align-top hover:bg-accent/15",
                  stripeByRowId.get(row.id) ? "bg-accent-soft" : "",
                ].join(" ")}
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
