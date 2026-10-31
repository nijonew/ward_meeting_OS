"use client";

import { useState } from "react";
import { useActionState } from "react";
import { saveAssignmentGrid } from "@/app/rotations/actions";
import { DualScrollbar } from "@/components/DualScrollbar";
import type { GridColumn, GridRow } from "@/lib/data/rotations";
// UNLISTED_CALLING_VALUE comes from the pure, server-free sibling file,
// not from "@/lib/data/rotations" directly -- that module imports
// next/headers via createClient, and a real (non-type) import of
// anything from it would pull that into this client component's own
// bundle. See rotations-shared.ts's own comment for the full reasoning
// -- found the hard way 2026-10-31 (a production build failure, not a
// type error) when this constant first needed importing as a value
// here, not just as a type.
import { UNLISTED_CALLING_VALUE } from "@/lib/data/rotations-shared";
import type { MeetingTypeSlug } from "@/lib/types";

const initialState: { error?: string; success?: boolean; clearedVacant?: number } = {};

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Picks a CALLING, never a person (2026-10-31, the user's own request:
 * "I don't want rotations to ever say anyone's name") -- saving resolves
 * the chosen calling to its current holder server-side (saveAssignmentGrid).
 * The UNLISTED_CALLING_VALUE option only appears when this specific
 * cell's own current value IS that sentinel -- it means a real
 * assignment already exists here that doesn't map to any calling this
 * column tracks, and leaving it selected keeps that assignment intact
 * on save rather than silently clearing it.
 */
function CallingCell({ name, callings, value }: { name: string; callings: { id: string; name: string }[]; value: string }) {
  const options =
    value === UNLISTED_CALLING_VALUE
      ? [{ id: UNLISTED_CALLING_VALUE, name: "Currently assigned (not a tracked calling)" }, ...callings]
      : callings;
  return (
    <select
      name={name}
      defaultValue={value}
      className="w-full min-w-[9rem] rounded border border-rule bg-paper px-2 py-1.5 text-xs text-ink"
    >
      <option value="">Unassigned</option>
      {options.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

/**
 * The grid itself, as its own client component -- needed for two things
 * a plain server-action <form> can't do (the user's own feedback,
 * 2026-09-06): show that a save actually happened ("there does not seem
 * to be any response and thus there is no confidence that anything
 * happened"), and disable Save until something's actually been changed.
 *
 * formatDate is defined locally rather than passed in as a prop --
 * root-caused 2026-09-08 against a "page couldn't load" report: this
 * page's server component used to pass a plain JS function in as a
 * prop, which Next.js's Server Components model doesn't allow crossing
 * the server/client boundary (only a Server Action can cross as a
 * function) -- it throws at render time. This is the most likely
 * explanation for this exact never-reproduced bug report from
 * 2026-09-06/08.
 *
 * **Picks a calling, never a person, 2026-10-31** (the user's own
 * request: "I don't want rotations to ever say anyone's name") -- see
 * CallingCell above and getAssignmentGrid/saveAssignmentGrid's own doc
 * comments for the full redesign.
 *
 * **Row contrast, 2026-10-10** (the user's own report: "rows blend
 * together quite a bit") -- `even:bg-accent-soft` zebra striping plus
 * `hover:bg-accent/15`, applied identically across every "favorite
 * grid format" page in this app (also CallingPlanningGridForm,
 * ActivitiesTable, TeachingGridForm, and the Dashboard meeting list) --
 * see CallingPlanningGridForm's own comment for the full reasoning
 * (including why gray striping was revised to this warm accent tint).
 */
export function AssignmentGridForm({
  meetingTypeSlug,
  columns,
  rows,
}: {
  meetingTypeSlug: MeetingTypeSlug;
  columns: GridColumn[];
  rows: GridRow[];
}) {
  const boundSave = saveAssignmentGrid.bind(null, meetingTypeSlug);
  const [state, formAction, pending] = useActionState(boundSave, initialState);
  const [dirty, setDirty] = useState(false);

  // Reset "dirty" the moment a save completes, without an effect (React
  // recommends adjusting state during render over useEffect for this
  // exact "respond to a value that just changed" case -- see
  // https://react.dev/learn/you-might-not-need-an-effect). The next edit
  // sets dirty again, which also naturally hides the "Saved"
  // confirmation below until there's something new to save.
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
              <th className="px-2 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">
                Meeting
              </th>
              {columns.map((c) => (
                <th key={c.key} className="px-2 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">
                  {c.label}
                  {c.eligibleCallings.length === 0 && (
                    <span className="mt-0.5 block normal-case tracking-normal text-danger">
                      No callings configured for this role
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.meetingId} className="border-t border-rule-strong/40 even:bg-accent-soft hover:bg-accent/15">
                <td className="px-2 py-2 align-top text-xs text-ink">{formatDate(row.date)}</td>
                {columns.map((c) => {
                  const cell = row.cells[c.key];
                  return (
                    <td key={c.key} className="px-2 py-1.5 align-top">
                      <CallingCell name={`${row.meetingId}::${c.key}`} callings={c.eligibleCallings} value={cell?.callingId ?? ""} />
                    </td>
                  );
                })}
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
        {!pending && !dirty && state.success && !state.error && (
          <p className="text-sm text-success">
            Saved.
            {state.clearedVacant
              ? ` ${state.clearedVacant} cell${state.clearedVacant === 1 ? "" : "s"} left unassigned because the selected calling currently has no holder.`
              : ""}
          </p>
        )}
      </div>
    </form>
  );
}
