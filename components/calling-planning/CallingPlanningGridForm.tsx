"use client";

import { useState, useTransition, useActionState } from "react";
import { saveCallingPlanningGrid, deleteCallingPlanningEntry } from "@/app/calling-planning/actions";
import type { CallingPlanningRow, CallingOption } from "@/lib/data/calling-planning";
import type { PersonOption } from "@/lib/data/people";
import type { SelectOption } from "@/lib/data/select-options";

const initialState: { error?: string; success?: boolean } = {};
const INPUT_CLASS = "w-full min-w-[9rem] rounded-md border border-rule bg-paper px-2 py-1.5 text-xs text-ink";

/**
 * The flat grid the user actually wants (2026-09-08): one row per
 * potential calling change, across every calling, matching their own
 * spreadsheet -- "our favorite grid format," the same
 * dirty-tracking/save-all pattern already built for Assignment
 * Rotations and Teaching Calendar. Delete is a plain button calling the
 * server action directly (via useTransition) rather than a nested
 * <form> -- HTML forbids a <form> inside another <form>, and the whole
 * table here is already wrapped in one for the Save All button.
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

  return (
    <form action={formAction} onChange={() => setDirty(true)}>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {[
                "Calling",
                "Date Initiated",
                "Candidates",
                "Status",
                "Date Set Apart",
                "Notes",
                "Person Being Released",
                "Release Status",
                "",
              ].map((label) => (
                <th key={label} className="px-2 py-2 text-left font-mono text-[10px] uppercase tracking-widest text-slate/70">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-rule/60 align-top">
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
                  {/* Hidden fallback with the same name: a <select multiple>
                      submits nothing at all when every option is deselected,
                      so without this, "remove every candidate" would leave
                      the field missing from formData entirely and the save
                      action would skip it -- see saveCallingPlanningGrid. */}
                  <input type="hidden" name={`${row.id}::candidate_person_ids`} value="" />
                  <select
                    name={`${row.id}::candidate_person_ids`}
                    multiple
                    size={4}
                    defaultValue={row.candidate_person_ids}
                    className={INPUT_CLASS}
                  >
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
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
                    <option value="">&mdash; None / Previously Vacant &mdash;</option>
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
                    className="text-xs text-slate hover:text-ink disabled:opacity-30"
                  >
                    Delete
                  </button>
                </td>
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
