"use client";

import { useState, useActionState } from "react";
import { saveTeachingGrid } from "@/app/youth-teaching-planning/actions";
import { LedgerIndex } from "@/components/LedgerIndex";
import type { TeachingGridRow } from "@/lib/data/teaching-assignments";

const initialState: { error?: string; success?: boolean } = {};

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * The grid itself, as its own client component -- same reasoning as
 * AssignmentGridForm (components/rotations/AssignmentGridForm.tsx):
 * dirty-tracking and a pending/success indicator both need client
 * state, which a plain server-action <form> can't give on its own.
 *
 * formatDate is defined locally rather than passed in as a prop --
 * Next.js's Server Components model only allows a Server Action to
 * cross the server/client boundary as a function; a plain function prop
 * (this page's own server component used to pass one in) throws at
 * render time. Root-caused 2026-09-08 against a "page couldn't load"
 * report -- see the identical fix in AssignmentGridForm.tsx.
 *
 * `classes` is usually a single-item array now (2026-09-09, moved from
 * /teaching-calendar to /youth-teaching-planning's per-class pages) --
 * left as an array rather than a single `class` prop since nothing else
 * about this component needs to change to support that narrowing.
 */
export function TeachingGridForm({
  classes,
  rows,
}: {
  classes: string[];
  rows: TeachingGridRow[];
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
              <th className="w-8 px-2 py-2" aria-hidden="true" />
              <th className="px-2 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">
                Sunday
              </th>
              {classes.map((c) => (
                <th key={c} className="px-2 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.classDate} className="border-t border-rule-strong/40">
                <td className="px-2 py-2 align-top">
                  <LedgerIndex position={i + 1} current={i === 0} />
                </td>
                <td className="px-2 py-2 align-top text-xs text-ink">{formatDate(row.classDate)}</td>
                {classes.map((c) => (
                  <td key={c} className="px-2 py-1.5 align-top">
                    <input
                      type="text"
                      name={`${row.classDate}::${c}`}
                      defaultValue={row.cells[c] ?? ""}
                      className="w-full min-w-[9rem] rounded border border-rule bg-paper px-2 py-1.5 text-xs text-ink"
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
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Saving..." : "Save All Changes"}
        </button>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {!pending && !dirty && state.success && !state.error && <p className="text-sm text-success">Saved.</p>}
      </div>
    </form>
  );
}
