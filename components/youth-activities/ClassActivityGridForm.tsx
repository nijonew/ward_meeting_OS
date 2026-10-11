"use client";

import { useState, useActionState } from "react";
import { saveClassActivityGrid } from "@/app/youth-activities/manage/classes/actions";
import { YOUTH_DEVELOPMENT_CATEGORIES } from "@/lib/data/youth-activity-constants";
import type { ClassActivityRow } from "@/lib/data/class-activities";

const initialState: { error?: string; success?: boolean } = {};

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * One row per upcoming Wednesday for a single class -- see
 * getClassActivityGrid's own comment for how each row's starting value
 * is resolved (this class's own activity, or whichever shared Combined
 * row it attends that week). Every field stays a plain editable input
 * regardless of source, same dirty-tracking/Save-All-Changes pattern as
 * every other "favorite grid format" page in this app -- editing a
 * Combined-sourced row writes back to that same shared row (see the
 * server action's own comment), not a class-specific fork of it.
 */
export function ClassActivityGridForm({ rows }: { rows: ClassActivityRow[] }) {
  const [state, formAction, pending] = useActionState(saveClassActivityGrid, initialState);
  const [dirty, setDirty] = useState(false);

  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (state.success && dirty) setDirty(false);
  }

  return (
    <form action={formAction} onChange={() => setDirty(true)}>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {["Date", "Title", "Location", "Category", "Planning Group"].map((h) => (
                <th key={h} className="px-2 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const prefix = `${row.activityDate}::${row.sourceGroupName}`;
              return (
                <tr key={row.activityDate} className="border-t border-rule-strong/40 even:bg-accent-soft hover:bg-accent/15">
                  <td className="px-2 py-2 align-top text-xs text-ink">
                    {formatDate(row.activityDate)}
                    {row.isCombined && (
                      <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-wider text-accent">
                        {row.sourceGroupName}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <input
                      type="text"
                      name={`${prefix}::title`}
                      defaultValue={row.title}
                      placeholder="Not yet planned"
                      className="w-full min-w-[12rem] rounded border border-rule bg-paper px-2 py-1.5 text-xs text-ink"
                    />
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <input
                      type="text"
                      name={`${prefix}::location`}
                      defaultValue={row.location}
                      className="w-full min-w-[9rem] rounded border border-rule bg-paper px-2 py-1.5 text-xs text-ink"
                    />
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <select
                      name={`${prefix}::development_category`}
                      defaultValue={row.developmentCategory}
                      className="w-full min-w-[8rem] rounded border border-rule bg-paper px-2 py-1.5 text-xs text-ink"
                    >
                      <option value="">None</option>
                      {YOUTH_DEVELOPMENT_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <input
                      type="text"
                      name={`${prefix}::planning_group`}
                      defaultValue={row.planningGroup}
                      placeholder={row.isCombined ? "Which class is planning this" : ""}
                      className="w-full min-w-[9rem] rounded border border-rule bg-paper px-2 py-1.5 text-xs text-ink"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
