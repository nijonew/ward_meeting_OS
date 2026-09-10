"use client";

import { useState } from "react";
import { useActionState } from "react";
import { saveAssignmentGrid } from "@/app/rotations/actions";
import { LedgerIndex } from "@/components/LedgerIndex";
import type { GridColumn, GridRow } from "@/lib/data/rotations";
import type { PersonOption } from "@/lib/data/people";
import type { MeetingTypeSlug } from "@/lib/types";

const initialState: { error?: string; success?: boolean } = {};

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function PersonCell({ name, people, value }: { name: string; people: PersonOption[]; value: string | null }) {
  return (
    <select
      name={name}
      defaultValue={value ?? ""}
      className="w-full min-w-[9rem] rounded border border-rule bg-paper px-2 py-1.5 text-xs text-ink"
    >
      <option value="">Unassigned</option>
      {people.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
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
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-8 px-2 py-2" aria-hidden="true" />
              <th className="px-2 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">
                Meeting
              </th>
              {columns.map((c) => (
                <th key={c.key} className="px-2 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">
                  {c.label}
                  {c.eligiblePeople.length === 0 && (
                    <span className="mt-0.5 block normal-case tracking-normal text-danger">
                      No one eligible, check callings
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.meetingId} className="border-t border-rule-strong/40">
                <td className="px-2 py-2 align-top">
                  <LedgerIndex position={i + 1} current={i === 0} />
                </td>
                <td className="px-2 py-2 align-top text-xs text-ink">{formatDate(row.date)}</td>
                {columns.map((c) => {
                  const cell = row.cells[c.key];
                  // Always keep the currently-assigned person selectable
                  // even if they no longer show up as eligible (a
                  // calling changed since) -- restricting the list to
                  // "who could be assigned" shouldn't silently blank
                  // out who actually IS assigned.
                  const options =
                    cell?.assignedToId && !c.eligiblePeople.some((p) => p.id === cell.assignedToId)
                      ? [...c.eligiblePeople, { id: cell.assignedToId, name: `${cell.assignedToName ?? "Unknown"} (no longer eligible)` }]
                      : c.eligiblePeople;
                  return (
                    <td key={c.key} className="px-2 py-1.5 align-top">
                      <PersonCell name={`${row.meetingId}::${c.key}`} people={options} value={cell?.assignedToId ?? null} />
                    </td>
                  );
                })}
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
        {state.error && <p className="text-sm text-danger">{state.error}</p>}
        {!pending && !dirty && state.success && !state.error && <p className="text-sm text-success">Saved.</p>}
      </div>
    </form>
  );
}
