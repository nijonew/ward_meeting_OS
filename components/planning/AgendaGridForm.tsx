"use client";

import { useActionState, useState } from "react";
import { saveAgendaGrid } from "@/app/meetings/[id]/agenda-actions";
import type { AgendaRow } from "@/lib/data/agenda-rows";
import type { PersonOption } from "@/lib/data/people";

const initialState: { error?: string; success?: boolean } = {};
const INPUT = "w-full rounded-md border border-rule bg-paper px-2 py-1.5 text-sm text-ink";

function PersonSelect({
  name,
  people,
  defaultValue,
}: {
  name: string;
  people: PersonOption[];
  defaultValue: string;
}) {
  return (
    <select name={name} defaultValue={defaultValue} className={INPUT}>
      <option value="">&mdash; Unassigned &mdash;</option>
      {people.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

/**
 * The agenda itself, as an editable grid -- built 2026-09-09 from the
 * user's own spreadsheet agenda: "I want them to also be more
 * agenda-like. single line for each element with a field that can be
 * edited after being pre-filled." Label on the left, that element's
 * pre-filled value on the right, in the meeting's own agenda order,
 * with one "Save All Changes" button for the whole page -- the same
 * dirty-tracking/save-feedback pattern as the Assignment Rotations,
 * Teaching Calendar, and Calling Planning grids.
 *
 * Every row's field names come from buildAgendaRows
 * (lib/data/agenda-rows.ts) and are parsed back apart by saveAgendaGrid,
 * so this component never needs to know which table anything lives in
 * -- it just renders inputs for whatever rows it's handed.
 */
export function AgendaGridForm({
  meetingId,
  roleTable,
  rows,
  people,
}: {
  meetingId: string;
  roleTable: "sacrament_assignments" | "bishopric_assignments";
  rows: AgendaRow[];
  people: PersonOption[];
}) {
  const boundSave = saveAgendaGrid.bind(null, meetingId, roleTable);
  const [state, formAction, pending] = useActionState(boundSave, initialState);
  const [dirty, setDirty] = useState(false);

  // Reset "dirty" the moment a save completes -- adjusting state during
  // render rather than in an effect, matching every other grid here.
  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (state.success && dirty) setDirty(false);
  }

  return (
    <form action={formAction} onChange={() => setDirty(true)}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <tbody>
            {rows.map((row) => {
              if (row.kind === "banner") {
                return (
                  <tr key={row.id} className="border-t border-rule/60">
                    <td colSpan={2} className="px-2 py-2 text-center">
                      <span className="font-display text-sm italic text-ink">{row.label}</span>
                      {row.note && <span className="ml-2 text-xs text-slate/60">{row.note}</span>}
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={row.id} className="border-t border-rule/60 align-top">
                  <th
                    scope="row"
                    className="w-40 px-2 py-2 text-left align-middle font-display text-sm font-normal text-ink sm:w-48"
                  >
                    {row.label}
                  </th>
                  <td className="px-2 py-1.5">
                    {row.kind === "person" && (
                      <PersonSelect name={row.field} people={people} defaultValue={row.value} />
                    )}

                    {row.kind === "text" && (
                      <input
                        type="text"
                        name={row.field}
                        defaultValue={row.value}
                        placeholder={row.placeholder}
                        className={INPUT}
                      />
                    )}

                    {row.kind === "person_text" && (
                      <div className="flex flex-col gap-1.5 sm:flex-row">
                        <div className="sm:w-1/2">
                          <PersonSelect
                            name={row.personField}
                            people={people}
                            defaultValue={row.personValue}
                          />
                        </div>
                        <input
                          type="text"
                          name={row.textField}
                          defaultValue={row.textValue}
                          placeholder="Notes"
                          className={`${INPUT} sm:w-1/2`}
                        />
                      </div>
                    )}

                    {row.kind === "music" && (
                      <div className="flex flex-col gap-1.5 sm:flex-row">
                        <input
                          type="text"
                          inputMode="numeric"
                          name={row.numberField}
                          defaultValue={row.numberValue}
                          placeholder="#"
                          className={`${INPUT} sm:w-16`}
                        />
                        <input
                          type="text"
                          name={row.titleField}
                          defaultValue={row.titleValue}
                          placeholder="Hymn or piece title"
                          className={INPUT}
                        />
                        {row.showPerformer && (
                          <input
                            type="text"
                            name={row.performerField}
                            defaultValue={row.performerValue}
                            placeholder="Performer"
                            className={`${INPUT} sm:w-40`}
                          />
                        )}
                      </div>
                    )}

                    {row.kind === "speaker" && (
                      <div className="flex flex-col gap-1.5 sm:flex-row">
                        <div className="sm:w-1/2">
                          <PersonSelect
                            name={row.personField}
                            people={people}
                            defaultValue={row.personValue}
                          />
                        </div>
                        <input
                          type="text"
                          name={row.guestField}
                          defaultValue={row.guestValue}
                          placeholder="Guest name"
                          className={`${INPUT} sm:w-40`}
                        />
                        <input
                          type="text"
                          name={row.topicField}
                          defaultValue={row.topicValue}
                          placeholder="Topic"
                          className={INPUT}
                        />
                      </div>
                    )}
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
