"use client";

import { useState, useActionState } from "react";
import { saveTeachingGrid } from "@/app/youth-teaching-planning/actions";
import { DualScrollbar } from "@/components/DualScrollbar";
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
 * **Reworked 2026-11-05**: one class per instance, with real Teacher
 * and Topic columns (previously a single, class-named column holding
 * one combined free-text field) -- the user's own request. `teachingClass`
 * is carried as a hidden field so saveTeachingGrid knows which
 * class_name every row in this one submit belongs to; every other field
 * name is just "<date>::teacher"/"<date>::topic". Reused as-is by both
 * Youth Teaching Planning's per-class page and the new
 * /adult-teaching-planning page (Elders Quorum and Relief Society,
 * rendered as two separate instances of this same component side by
 * side) -- the mechanism is identical, only the class differs.
 *
 * Row contrast (2026-10-10, `even:bg-accent-soft`/`hover:bg-accent/15`)
 * is unchanged -- see CallingPlanningGridForm's own comment for the
 * full reasoning.
 */
export function TeachingGridForm({
  teachingClass,
  rows,
}: {
  teachingClass: string;
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
      <input type="hidden" name="class_name" value={teachingClass} />
      <div className="mt-4">
        <DualScrollbar>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="px-2 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">
                  Sunday
                </th>
                <th className="px-2 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">
                  Teacher
                </th>
                <th className="px-2 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">
                  Topic
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.classDate} className="border-t border-rule-strong/40 even:bg-accent-soft hover:bg-accent/15">
                  <td className="whitespace-nowrap px-2 py-2 align-top text-xs text-ink">{formatDate(row.classDate)}</td>
                  <td className="px-2 py-1.5 align-top">
                    <input
                      type="text"
                      name={`${row.classDate}::teacher`}
                      defaultValue={row.teacher}
                      className="w-full min-w-[9rem] rounded border border-rule bg-paper px-2 py-1.5 text-xs text-ink"
                    />
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <input
                      type="text"
                      name={`${row.classDate}::topic`}
                      defaultValue={row.topic}
                      className="w-full min-w-[9rem] rounded border border-rule bg-paper px-2 py-1.5 text-xs text-ink"
                    />
                  </td>
                </tr>
              ))}
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
