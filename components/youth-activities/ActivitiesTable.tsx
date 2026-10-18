"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { ColumnFilterDropdown } from "@/components/ColumnFilterDropdown";
import { PushToClassesButton } from "@/components/youth-activities/PushToClassesButton";
import { usePersistedSortFilter } from "@/lib/hooks/use-persisted-sort-filter";
import { classesForCombinedGroup } from "@/lib/data/class-activities-shared";
import { saveActivityGrid, deleteYouthActivity } from "@/app/youth-activities/actions";
import type { YouthActivityRow } from "@/lib/data/youth-activities";

/**
 * Delete, re-added 2026-10-16 (the user's own report: "I am not
 * seeing where I have the ability to delete a youth activity whether
 * it is combined or not") -- a plain `type="button"` + `useTransition`
 * call, same reasoning as `PushToClassesButton` right above it: this
 * sits inside `editable`/`deletable` mode's own table, and a real
 * submit button would trigger the grid's own Save All Changes (when
 * `editable` is also on) instead of deleting anything. `window.confirm`
 * first, matching `DeleteMeetingButton`'s own convention for an
 * irreversible action -- unlike Cancel (a separate, unrelated flag),
 * there's no "undo" once this runs.
 *
 * **`warnShared`, 2026-10-16** -- Upcoming Activities (see
 * `realActivityId`'s own comment below) shows a Combined activity
 * once per attending class, so deleting it from there removes it for
 * every one of those classes at once, not just the one row on screen.
 * The confirm text says so explicitly when `warnShared` is set, rather
 * than letting it look like an ordinary single-row delete.
 */
function DeleteActivityButton({
  activityId,
  label,
  warnShared = false,
}: {
  activityId: string;
  label: string;
  warnShared?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    const warning = warnShared
      ? `Permanently delete "${label}"? This is a Combined activity -- deleting it removes it for every class that attends it. This cannot be undone.`
      : `Permanently delete "${label}"? This cannot be undone.`;
    if (!window.confirm(warning)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteYouthActivity(activityId);
      if ("error" in result) setError(result.error);
    });
  };

  return (
    <div className="flex flex-col items-start gap-0.5">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="text-xs text-danger/70 hover:text-danger disabled:opacity-50"
      >
        {pending ? "Deleting..." : "Delete"}
      </button>
      {error && <span className="text-[10px] text-danger">{error}</span>}
    </div>
  );
}

const ALL_COLUMNS = [
  { key: "date", label: "Date" },
  { key: "time", label: "Time" },
  { key: "group", label: "Group" },
  { key: "description", label: "Description" },
  { key: "planning_group", label: "In Charge" },
  { key: "notes", label: "Notes" },
] as const;
type ColumnKey = (typeof ALL_COLUMNS)[number]["key"];

const INPUT_CLASS = "w-full min-w-[8rem] rounded border border-rule bg-paper px-2 py-1.5 text-xs text-ink";
const initialSaveState: { error?: string; success?: boolean } = {};

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

/**
 * `explodeActivitiesByClass` gives a Combined-sourced row a synthetic
 * id (`<sourceId>::<className>`) so up to 6 exploded rows can share one
 * real `youth_activities` row safely in a read-only view -- see that
 * function's own comment. Delete is a real, id-keyed action (unlike
 * plain display), so it must always target the real row, never the
 * synthetic one -- this strips the `::<className>` suffix back off
 * when present, and is a no-op for an ordinary, non-exploded row (the
 * three Combined-group pages' own rows, which are never synthetic).
 */
function realActivityId(id: string): string {
  const sep = id.indexOf("::");
  return sep === -1 ? id : id.slice(0, sep);
}

/** Same convention as CallingPlanningGridForm's sortable headers --
 *  nulls/blanks always sort last regardless of direction. */
function compareText(a: string, b: string): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/**
 * The read-only "favorite grid format" table for youth activities
 * (2026-10-10, the user's own request for Upcoming Activities and the
 * three Combined-group views: "table/matrix format similar to other
 * table pages... filterable for specific classes/quorums"). Reuses the
 * exact same click-to-sort interaction CallingPlanningGridForm already
 * established. Filtering is ColumnFilterDropdown -- an Excel/Sheets-
 * style checklist of a column's own distinct values -- rather than a
 * free-text box (2026-10-10, the user's own follow-up: "I want it
 * everywhere we have a filter"), which handles "filterable by specific
 * classes/quorums" directly: the Group column's dropdown just lists
 * every class/quorum/Combined-group actually present. No save/edit
 * affordances at all -- these pages are deliberately read-only, all
 * adding/editing/generating stays on the Youth Activities Management
 * page.
 *
 * `showGroupColumn` is false on the three Combined-group pages, which
 * already pre-filter to one group server-side -- showing a column
 * where every row has the same value would be redundant there.
 *
 * **Row contrast, 2026-10-10** (the user's own report: "rows blend
 * together quite a bit") -- zebra striping (skipped in favor of the
 * existing `bg-danger/5` tint on a cancelled row, so the two never
 * compete) plus `hover:bg-accent/15`, applied identically across every
 * "favorite grid format" page in this app -- see CallingPlanningGridForm's
 * own comment for the full reasoning (including why gray striping was
 * revised to this warm accent tint).
 *
 * **Striping keyed off visible position, not DOM position, 2026-10-11**
 * -- originally plain CSS `even:bg-accent-soft`, which (like
 * CallingPlanningGridForm, see that file's own comment for the full
 * writeup) counted hidden filtered-out rows toward its `:nth-child`
 * parity, so two consecutive visible rows could land on the same shade
 * after filtering. `stripeByRowId` below fixes that the same way.
 *
 * **Sort/filter persisted across page refreshes, 2026-10-10** (the
 * user's own request: "is there a way to remember the sorts and
 * filters so they don't reset every time the page is refreshed") --
 * via `usePersistedSortFilter` (`lib/hooks/use-persisted-sort-filter.ts`).
 * `storageKey` is required, not defaulted, specifically because this
 * one component renders on four different pages (Upcoming Activities,
 * Combined YM & YW, Combined YM, Combined YW) that each need their own
 * independent remembered state -- see that hook's own comment.
 *
 * **`showOverwriteColumn`, 2026-10-11** (the user's own request: "a
 * button to command that the combined activity overwrite the activity
 * on the same date of the appropriate groups") -- an extra column, on
 * only the three Combined-group pages, with a per-row
 * PushToClassesButton. Still false on Upcoming Activities (a mix of
 * every group, most rows not Combined at all) and computed per-row
 * via `classesForCombinedGroup`, not a blanket page-level flag, so a
 * non-Combined row occasionally mixed into one of those three pages
 * (shouldn't happen today, but nothing guarantees it never will)
 * simply renders no button rather than erroring.
 *
 * **No longer read-only everywhere, 2026-10-11** (the user's own
 * follow-up request: "I want to be able to modify combined activities.
 * I also want to see which group is in charge of the activity") --
 * this component's own doc comment above still describes the original
 * design, which this extends rather than replaces:
 * - **`showPlanningGroupColumn`**: a new "In Charge" column showing
 *   `planning_group` (which class is on the hook to plan a combined
 *   week -- see youth_activity_rotations' own architecture entry) --
 *   `false` by default (Upcoming Activities leaves it off, since most
 *   of its rows are individual-class activities with no
 *   `planning_group` at all), passed `true` on the three Combined-group
 *   pages.
 * - **`editable`**: Time/Description/In Charge/Notes become real
 *   inputs, same "favorite grid format" dirty-tracking/Save-All-Changes
 *   pattern as every other editable grid in this app
 *   (`useActionState` + `saveActivityGrid`,
 *   `app/youth-activities/actions.ts`) -- `false` by default (Upcoming
 *   Activities stays purely read-only, matching the original design),
 *   passed `true` on the three Combined-group pages gated the same way
 *   their existing Add Activity/Overwrite controls already are
 *   (`youth_activity_planning`). Date and Group stay read-only even
 *   when editable -- Date is the row's own key, and Group is fixed to
 *   whichever page it's rendered on; changing either would move the
 *   row off this page entirely, a bigger operation than "modify this
 *   activity" asked for.
 *
 * **Delete column, 2026-10-16** (the user's own report: "I am not
 * seeing where I have the ability to delete a youth activity whether
 * it is combined or not") -- originally tied to the same `editable`
 * flag as the save grid, so it showed exactly where Add/Edit/Overwrite
 * already did (the three Combined-group pages), never on read-only
 * Upcoming Activities.
 *
 * **Decoupled into its own `deletable` prop, 2026-10-16** (the hub
 * cleanup: "All tiles should allow authorized users to add, delete
 * activities in the upcoming activities, combined YM/YW, combined YW,
 * Combined YM tiles") -- Upcoming Activities now needed Delete too,
 * but NOT full inline `editable`: every row there can be one of up to
 * 6 *exploded* copies of the same real Combined activity, all sharing
 * one real id (see `explodeActivitiesByClass`), so turning on
 * `editable` there would render the same `"<id>::title"` input name up
 * to 6 times at once -- a real correctness bug (`saveActivityGrid`
 * would only ever see whichever one happened to submit last). Delete
 * has no such problem (`realActivityId` always resolves back to the
 * one real row regardless of how many exploded copies are on screen),
 * so it's independently gated: `deletable` renders just the Delete
 * column and button, with no inline-edit inputs and no wrapping
 * Save-All-Changes `<form>` unless `editable` is also on. The three
 * Combined-group pages pass both (unchanged); Upcoming Activities
 * passes `deletable` alone.
 *
 * **Delete pinned to the right edge, 2026-10-17** (the user's own
 * report, after confirming Delete was already there all along: "It
 * may have been there before and I didn't see it because it was
 * hidden by the scroll" -- then asked to pin it). `sticky right-0` on
 * both the header and each body cell keeps it visible at the right
 * edge of the table's own `overflow-x-auto` container regardless of
 * horizontal scroll position. A sticky cell needs its own opaque
 * background (the row's `<tr>` background doesn't automatically show
 * through a positioned cell the way it would an ordinary one) --
 * `rowBgClass` is computed once per row and reused for both the `<tr>`
 * and the pinned cell, so the pinned Delete button's background always
 * matches its own row (striped, cancelled-tinted, or plain) instead of
 * clashing with whatever scrolls underneath it.
 *
 * **Confirmed column, 2026-10-17** (the user's own report, same
 * message: "I have inconsistency about what is marked as tentative and
 * what isn't... I can't see where we make something tentative vs
 * confirmed"). Not a scroll problem this time -- there genuinely was no
 * control here at all. The Title cell's own "Tentative" badge (next to
 * "Cancelled") has always been read-only on every page this component
 * renders; the only existing way to flip it was `ClassActivityGridForm`'s
 * own Confirmed checkbox (a different grid, scoped to one class at a
 * time) or Table Admin's raw grid. Added the identical checkbox here,
 * same hidden-"false"-before-the-real-checkbox convention as that
 * component (and Stake Business before it) -- gated on `editable`
 * alone, not `deletable`, for the same duplicate-field-name reason
 * Time/Title/Notes already are: Upcoming Activities can show the same
 * real row exploded into up to 6 copies, and a same-named checkbox
 * repeated that many times has no well-defined submitted value. The
 * existing read-only "Tentative" badge is left in place everywhere
 * (including next to the new checkbox on an editable page) rather than
 * removed -- harmless redundancy, and still the only indicator at all
 * on Upcoming Activities, where there's no checkbox to look at instead.
 */
export function ActivitiesTable({
  activities,
  showGroupColumn = true,
  showPlanningGroupColumn = false,
  showOverwriteColumn = false,
  editable = false,
  deletable = false,
  storageKey,
}: {
  activities: YouthActivityRow[];
  showGroupColumn?: boolean;
  showPlanningGroupColumn?: boolean;
  showOverwriteColumn?: boolean;
  editable?: boolean;
  deletable?: boolean;
  storageKey: string;
}) {
  const { sort, setSort, filters, setFilters } = usePersistedSortFilter<ColumnKey>(storageKey);
  const [state, formAction, pending] = useActionState(saveActivityGrid, initialSaveState);
  const [dirty, setDirty] = useState(false);
  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (state.success && dirty) setDirty(false);
  }

  const columns = ALL_COLUMNS.filter(
    (c) => (c.key !== "group" || showGroupColumn) && (c.key !== "planning_group" || showPlanningGroupColumn)
  );

  const cellText = (row: YouthActivityRow, key: ColumnKey): string => {
    switch (key) {
      case "date":
        return row.activity_date;
      case "time":
        return row.activity_time ?? "";
      case "group":
        return row.group_name;
      case "description":
        return row.title;
      case "planning_group":
        return row.planning_group ?? "";
      case "notes":
        return row.notes ?? "";
    }
  };

  const toggleSort = (key: ColumnKey) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  };

  const sortedRows = useMemo(() => {
    if (!sort) return activities;
    const result = [...activities].sort((a, b) => compareText(cellText(a, sort.key), cellText(b, sort.key)));
    if (sort.direction === "desc") result.reverse();
    return result;
  }, [activities, sort]);

  const columnValues = useMemo(() => {
    const result = {} as Record<ColumnKey, string[]>;
    for (const c of columns) {
      result[c.key] = [...new Set(activities.map((r) => cellText(r, c.key)))];
    }
    return result;
  }, [activities, columns]);

  const matchesFilters = (row: YouthActivityRow) =>
    columns.every((c) => {
      const excluded = filters[c.key];
      return excluded == null || !excluded.has(cellText(row, c.key));
    });
  const visibleCount = sortedRows.filter(matchesFilters).length;

  // Which stripe (if any) each VISIBLE row gets, keyed by row id --
  // see this component's own doc comment. Recomputed every render.
  const stripeByRowId = new Map<string, boolean>();
  {
    let visibleIndex = 0;
    for (const row of sortedRows) {
      if (!matchesFilters(row)) continue;
      stripeByRowId.set(row.id, visibleIndex % 2 === 1);
      visibleIndex++;
    }
  }

  if (activities.length === 0) {
    return <p className="text-sm text-ink-muted">Nothing scheduled yet.</p>;
  }

  const table = (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {columns.map((c) => (
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
                    excluded={filters[c.key] ?? null}
                    onChange={(next) => setFilters((prev) => ({ ...prev, [c.key]: next }))}
                  />
                </div>
              </th>
            ))}
            {editable && (
              <th className="px-2 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">
                Confirmed
              </th>
            )}
            {showOverwriteColumn && (
              <th className="px-2 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">
                Overwrite
              </th>
            )}
            {(editable || deletable) && (
              <th className="sticky right-0 z-10 border-l border-rule/60 bg-surface px-2 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">
                Delete
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => {
            // Shared between the row itself and the pinned Delete cell
            // below -- a sticky cell needs its OWN opaque background
            // (not just inherited from the <tr>), or whatever's
            // scrolled underneath it would show through as it's pinned
            // in place. Keeping both in sync off one value means the
            // pinned cell can never visually mismatch its own row.
            const rowBgClass = row.cancelled ? "bg-danger/5" : stripeByRowId.get(row.id) ? "bg-accent-soft" : "bg-surface";
            return (
              <tr
                key={row.id}
                hidden={!stripeByRowId.has(row.id)}
                className={["border-t border-rule/60 align-top hover:bg-accent/15", rowBgClass].join(" ")}
              >
                <td className="px-2 py-1.5 text-xs text-ink">{formatDate(row.activity_date)}</td>
                <td className="px-2 py-1.5 text-xs text-ink">
                  {editable ? (
                    <input type="time" name={`${row.id}::activity_time`} defaultValue={row.activity_time ?? ""} className={INPUT_CLASS} />
                  ) : row.activity_time ? (
                    formatTime(row.activity_time)
                  ) : (
                    "—"
                  )}
                </td>
                {showGroupColumn && <td className="px-2 py-1.5 text-xs text-ink">{row.group_name}</td>}
                <td className="px-2 py-1.5 text-xs text-ink">
                  {editable ? (
                    <input type="text" name={`${row.id}::title`} defaultValue={row.title} className={INPUT_CLASS} />
                  ) : (
                    row.title
                  )}
                  {row.cancelled && (
                    <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-danger">Cancelled</span>
                  )}
                  {!row.cancelled && !row.confirmed && (
                    <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-accent">Tentative</span>
                  )}
                </td>
                {showPlanningGroupColumn && (
                  <td className="px-2 py-1.5 text-xs text-ink">
                    {editable ? (
                      <input
                        type="text"
                        name={`${row.id}::planning_group`}
                        defaultValue={row.planning_group ?? ""}
                        placeholder="Which class is planning this"
                        className={INPUT_CLASS}
                      />
                    ) : (
                      row.planning_group ?? "—"
                    )}
                  </td>
                )}
                <td className="px-2 py-1.5 text-xs text-ink-muted">
                  {editable ? (
                    <textarea name={`${row.id}::notes`} defaultValue={row.notes ?? ""} rows={2} className={INPUT_CLASS} />
                  ) : (
                    row.notes
                  )}
                  {row.cancelled && row.cancellation_note && (
                    <div className="mt-1 text-danger">Cancelled: {row.cancellation_note}</div>
                  )}
                </td>
                {editable && (
                  <td className="px-2 py-1.5 text-center">
                    <input type="hidden" name={`${row.id}::confirmed`} value="false" />
                    <input type="checkbox" name={`${row.id}::confirmed`} value="true" defaultChecked={row.confirmed} />
                  </td>
                )}
                {showOverwriteColumn &&
                  (() => {
                    const targets = classesForCombinedGroup(row.group_name);
                    return (
                      <td className="px-2 py-1.5">
                        {targets && <PushToClassesButton activityId={row.id} label={targets.join(", ")} />}
                      </td>
                    );
                  })()}
                {(editable || deletable) && (
                  <td className={["sticky right-0 z-10 border-l border-rule/60 px-2 py-1.5", rowBgClass].join(" ")}>
                    <DeleteActivityButton
                      activityId={realActivityId(row.id)}
                      label={row.title}
                      warnShared={realActivityId(row.id) !== row.id}
                    />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {visibleCount === 0 && <p className="mt-3 text-sm text-ink-muted">No activities match the current filters.</p>}
    </div>
  );

  if (!editable) return table;

  return (
    <form action={formAction} onChange={() => setDirty(true)}>
      {table}
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
