"use client";

import { useMemo, useState } from "react";
import type { YouthActivityRow } from "@/lib/data/youth-activities";

type SortDirection = "asc" | "desc";

const ALL_COLUMNS = [
  { key: "date", label: "Date" },
  { key: "time", label: "Time" },
  { key: "group", label: "Group" },
  { key: "description", label: "Description" },
  { key: "notes", label: "Notes" },
] as const;
type ColumnKey = (typeof ALL_COLUMNS)[number]["key"];

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
 * exact same click-to-sort + per-column text-filter interaction
 * CallingPlanningGridForm already established, rather than inventing a
 * separate checkbox-based group picker -- typing into the Group
 * column's own filter box (e.g. "Combined" or a specific class name)
 * already satisfies "filterable by specific classes/quorums" with no
 * new UI pattern to learn. No save/edit affordances at all -- these
 * pages are deliberately read-only, all adding/editing/generating
 * stays on the Youth Activities Management page.
 *
 * `showGroupColumn` is false on the three Combined-group pages, which
 * already pre-filter to one group server-side -- showing a column
 * where every row has the same value would be redundant there.
 */
export function ActivitiesTable({
  activities,
  showGroupColumn = true,
}: {
  activities: YouthActivityRow[];
  showGroupColumn?: boolean;
}) {
  const [sort, setSort] = useState<{ key: ColumnKey; direction: SortDirection } | null>(null);
  const [filters, setFilters] = useState<Partial<Record<ColumnKey, string>>>({});

  const columns = showGroupColumn ? ALL_COLUMNS : ALL_COLUMNS.filter((c) => c.key !== "group");

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

  const activeFilters = Object.entries(filters).filter(([, v]) => v && v.trim() !== "") as [ColumnKey, string][];
  const matchesFilters = (row: YouthActivityRow) =>
    activeFilters.every(([key, needle]) => cellText(row, key).toLowerCase().includes(needle.trim().toLowerCase()));
  const visibleCount = activeFilters.length === 0 ? sortedRows.length : sortedRows.filter(matchesFilters).length;

  if (activities.length === 0) {
    return <p className="text-sm text-ink-muted">Nothing scheduled yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="px-2 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">
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
                  placeholder={c.key === "group" ? "Filter by class/quorum…" : "Filter…"}
                  className="mt-1 w-full rounded border border-rule/60 bg-paper px-1.5 py-0.5 text-[10px] normal-case tracking-normal text-ink"
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr
              key={row.id}
              hidden={!matchesFilters(row)}
              className={["border-t border-rule/60 align-top", row.cancelled ? "bg-danger/5" : ""].join(" ")}
            >
              <td className="px-2 py-1.5 text-xs text-ink">{formatDate(row.activity_date)}</td>
              <td className="px-2 py-1.5 text-xs text-ink">{row.activity_time ? formatTime(row.activity_time) : "—"}</td>
              {showGroupColumn && <td className="px-2 py-1.5 text-xs text-ink">{row.group_name}</td>}
              <td className="px-2 py-1.5 text-xs text-ink">
                {row.title}
                {row.cancelled && (
                  <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-danger">Cancelled</span>
                )}
                {!row.cancelled && !row.confirmed && (
                  <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-accent">Tentative</span>
                )}
              </td>
              <td className="px-2 py-1.5 text-xs text-ink-muted">
                {row.notes}
                {row.cancelled && row.cancellation_note && (
                  <div className="mt-1 text-danger">Cancelled: {row.cancellation_note}</div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {visibleCount === 0 && <p className="mt-3 text-sm text-ink-muted">No activities match the current filters.</p>}
    </div>
  );
}
