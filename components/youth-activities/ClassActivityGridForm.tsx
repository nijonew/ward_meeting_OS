"use client";

import { useState, useActionState, useTransition } from "react";
import { saveClassActivityGrid, deleteClassActivity } from "@/app/youth-activities/manage/classes/actions";
import { YOUTH_DEVELOPMENT_CATEGORIES } from "@/lib/data/youth-activity-constants";
import { DualScrollbar } from "@/components/DualScrollbar";
import type { ClassActivityRow } from "@/lib/data/class-activities";

const initialState: { error?: string; success?: boolean } = {};

/**
 * Delete this class's own individual activity row, 2026-10-16 (the
 * user's own report: "I am not seeing where I have the ability to
 * delete a youth activity whether it is combined or not"). Only ever
 * rendered for a row this class actually owns (`!row.isCombined` --
 * see `deleteClassActivity`'s own comment for why a Combined-sourced
 * line can't be deleted from here). A plain `type="button"` +
 * `useTransition` call, same reasoning as every other per-row action
 * button in this app's grids -- this sits inside the grid's own
 * wrapping `<form>`, and a real submit button would trigger Save All
 * Changes instead.
 */
function DeleteClassActivityButton({ activityId, label }: { activityId: string; label: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    if (!window.confirm(`Permanently delete "${label}"? This cannot be undone.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteClassActivity(activityId);
      if (result.error) setError(result.error);
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
 *
 * **Confirmed checkbox, 2026-10-11** (the user's own question, right
 * after the old inline toggle was removed along with "All
 * Activities": "how do we change when an activity is tentative vs
 * non-tentative?") -- same hidden-"false"-before-the-real-checkbox
 * trick already used for Stake Business, since an unchecked box
 * submits nothing on its own.
 *
 * **Delete column, 2026-10-16** -- only shown for a row this class
 * actually owns (`!row.isCombined`), never a shared Combined row
 * (there's no real row here to point at for one of those -- a blank
 * fallback line has no `activityId` at all, and a Combined-sourced
 * line's real row belongs to the Combined page it's drawn from).
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
      <div className="mt-4">
        <DualScrollbar>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {["Date", "Title", "Location", "Category", "Planning Group", "Confirmed", "Delete"].map((h) => (
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
                  <td className="px-2 py-1.5 align-top text-center">
                    <input type="hidden" name={`${prefix}::confirmed`} value="false" />
                    <input type="checkbox" name={`${prefix}::confirmed`} value="true" defaultChecked={row.confirmed} />
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    {!row.isCombined && row.activityId && (
                      <DeleteClassActivityButton activityId={row.activityId} label={row.title || "this activity"} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </DualScrollbar>
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
