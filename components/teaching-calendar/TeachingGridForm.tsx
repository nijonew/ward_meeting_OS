"use client";

import { useState, useActionState } from "react";
import { saveTeachingGrid } from "@/app/teaching-calendar/actions";
import type { TeachingGridRow } from "@/lib/data/teaching-assignments";

const initialState: { error?: string; success?: boolean } = {};

/**
 * The grid itself, as its own client component -- same reasoning as
 * AssignmentGridForm (components/rotations/AssignmentGridForm.tsx):
 * dirty-tracking and a pending/success indicator both need client
 * state, which a plain server-action <form> can't give on its own.
 */
export function TeachingGridForm({
  classes,
  rows,
  formatDate,
}: {
  classes: string[];
  rows: TeachingGridRow[];
  formatDate: (iso: string) => string;
}) {
  const [state, formAction, pending] = useActionState(saveTeachingGrid, initialState);
  const [dirty, setDirty] = useState(false);

  // Reset "dirty" the moment a save completes -- adjusting state during
  // render rather than an effect, matching AssignmentGridForm.
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
              <th className="px-2 py-2 text-left font-mono text-[10px] uppercase tracking-widest text-slate/70">
                Sunday
              </th>
              {classes.map((c) => (
                <th key={c} className="px-2 py-2 text-left font-mono text-[10px] uppercase tracking-widest text-slate/70">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.classDate} className="border-t border-rule/60">
                <td className="px-2 py-2 align-top text-xs text-ink">{formatDate(row.classDate)}</td>
                {classes.map((c) => (
                  <td key={c} className="px-2 py-1.5 align-top">
                    <input
                      type="text"
                      name={`${row.classDate}::${c}`}
                      defaultValue={row.cells[c] ?? ""}
                      className="w-full min-w-[9rem] rounded-md border border-rule bg-paper px-2 py-1.5 text-xs text-ink"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
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
        {!pending && !dirty && state.success && !state.error && <p className="text-sm text-sage">Saved.</p>}
      </div>
    </form>
  );
}
