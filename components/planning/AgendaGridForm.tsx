"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { saveAgendaGrid } from "@/app/meetings/[id]/agenda-actions";
import { FIELD_SEPARATOR, type AgendaRow } from "@/lib/data/agenda-rows";
import type { PersonOption } from "@/lib/data/people";
import type { HymnalIndexEntry } from "@/lib/data/hymnal-shared";
import { useHymnTitleLiveFill } from "@/lib/hooks/use-hymn-title-live-fill";
import { SpeakerPersonOrGuestField } from "@/components/planning/SpeakerPersonOrGuestField";
import { WardBusinessField } from "@/components/planning/WardBusinessField";

const initialState: { error?: string; success?: boolean } = {};
const INPUT = "w-full rounded border border-rule bg-paper px-2 py-1.5 text-sm text-ink";

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
      <option value="">Unassigned</option>
      {people.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

/** Stake Business's yes/no toggle + conditional announcer field
 *  (2026-09-09) -- its own tiny stateful piece since the announcer
 *  input's visibility has to react to the checkbox client-side; nothing
 *  else on this grid needs that. The hidden fallback (same name, before
 *  the checkbox in the DOM) is what lets saveAgendaGrid tell "explicitly
 *  unchecked" apart from "field never submitted" -- an unchecked
 *  checkbox submits nothing on its own. */
function StakeBusinessCell({
  row,
}: {
  row: Extract<AgendaRow, { kind: "stake_business" }>;
}) {
  const [hasStakeBusiness, setHasStakeBusiness] = useState(row.hasStakeBusiness);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1.5 text-sm text-ink">
        <input type="hidden" name={row.toggleField} value="" />
        <input
          type="checkbox"
          name={row.toggleField}
          defaultChecked={row.hasStakeBusiness}
          onChange={(e) => setHasStakeBusiness(e.target.checked)}
        />
        Stake Business this week
      </label>
      {hasStakeBusiness && (
        <input
          type="text"
          name={row.announcerField}
          defaultValue={row.announcerValue}
          placeholder="Who's announcing"
          className={`${INPUT} sm:w-56`}
        />
      )}
    </div>
  );
}

/**
 * Hymn number + title, wired so typing a number live-fills the title
 * from Music Reference (2026-10-03, the user's own request: "If I put
 * in a hymn number please then pre-fill the name next to it with the
 * associated hymn"). Both inputs stay uncontrolled -- see
 * useHymnTitleLiveFill (lib/hooks/use-hymn-title-live-fill.ts) for how
 * the title's live DOM value is kept in sync without ever overwriting a
 * title someone typed in themselves. A "C" prefix means Children's
 * Songbook (resolveHymnTitle, lib/data/hymnal-shared.ts) -- anything
 * else matches across the 1985 Hymnal and Hymns for Home and Church,
 * which never overlap each other by number. */
function MusicCell({
  row,
  hymnalIndex,
}: {
  row: Extract<AgendaRow, { kind: "music" }>;
  hymnalIndex: HymnalIndexEntry[];
}) {
  const { titleRef, onNumberChange } = useHymnTitleLiveFill(hymnalIndex);

  return (
    <div className="flex flex-col gap-1.5 sm:flex-row">
      <input
        type="text"
        name={row.numberField}
        defaultValue={row.numberValue}
        placeholder="# or C#"
        className={`${INPUT} sm:w-16`}
        onChange={(e) => onNumberChange(e.target.value)}
      />
      <input
        ref={titleRef}
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
  );
}

/**
 * Visiting Authorities: a dynamic number of person-or-guest rows, a "+"
 * to add another (2026-10-03, the user's own request: "much like the
 * other dropdowns on the page, but with a + button underneath the
 * dropdown to add a second row for another visiting authority
 * continuously" -- reversing this element's first pass as its own
 * separate management page). The row count lives entirely in this
 * component's own React state -- adding/removing a row never touches
 * the server; everything saves together with the rest of the grid on
 * the next "Save All Changes," same as every other field here. Field
 * names are indexed by position (`<fieldPrefix>::<n>::person_id` /
 * `::guest_name`, see SpeakerPersonOrGuestField's own field-name props)
 * -- saveAgendaGrid collects every row under the prefix, drops
 * genuinely blank ones, and replaces the meeting's whole
 * sacrament_visiting_authorities list with what's left, rather than
 * diffing row by row.
 *
 * "Remove" only ever drops the trailing row, not an arbitrary one in
 * the middle -- these are uncontrolled inputs (defaultValue-based, like
 * every other field in this grid), so reordering/reindexing an
 * arbitrary removal correctly would need controlled state this
 * component otherwise has no reason to carry. To drop a row that isn't
 * last, just clear its own selection -- a blank row is dropped at save
 * time the same as if it had never been added.
 *
 * `onDirty` is called directly on add/remove, since neither is a
 * native form-control change the surrounding `<form>`'s own `onChange`
 * would otherwise catch.
 */
function VisitingAuthoritiesField({
  row,
  onDirty,
}: {
  row: Extract<AgendaRow, { kind: "visiting_authorities" }>;
  onDirty: () => void;
}) {
  const [rowCount, setRowCount] = useState(Math.max(row.rows.length, 1));

  const addRow = () => {
    setRowCount((n) => n + 1);
    onDirty();
  };
  const removeLastRow = () => {
    setRowCount((n) => Math.max(n - 1, 1));
    onDirty();
  };

  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rowCount }, (_, i) => {
        const existing = row.rows[i];
        return (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <SpeakerPersonOrGuestField
              people={row.eligiblePeople}
              defaultPersonId={existing?.personId ?? ""}
              defaultGuestName={existing?.guestName ?? ""}
              personFieldName={`${row.fieldPrefix}${FIELD_SEPARATOR}${i}${FIELD_SEPARATOR}person_id`}
              guestFieldName={`${row.fieldPrefix}${FIELD_SEPARATOR}${i}${FIELD_SEPARATOR}guest_name`}
              personPlaceholder="Choose a visiting authority"
              guestToggleLabel="Write in a name instead"
              personToggleLabel="Choose from the list instead"
            />
            {rowCount > 1 && i === rowCount - 1 && (
              <button type="button" onClick={removeLastRow} className="text-xs text-danger/70 hover:text-danger">
                Remove
              </button>
            )}
          </div>
        );
      })}
      <button type="button" onClick={addRow} className="w-fit text-xs text-ink-muted underline hover:text-ink">
        + Add another
      </button>
    </div>
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
 * -- it just renders inputs for whatever rows it's handed. `people` is
 * the fallback list for kinds with no calling-based restriction of
 * their own (speaker/text/person_and_text rows); `person` and
 * `recognize_music` rows carry their own already-restricted
 * `eligiblePeople` list instead (2026-09-09: "all dropdowns should
 * follow the rules for the field by calling").
 *
 * `formId`/`hideActions`/`onDirtyChange`/`onStateChange` (2026-09-10)
 * exist for exactly one caller: Sacrament Meeting's planning page
 * renders two of these (split around Teaching Program, which can't
 * share a `<form>` with either -- see agenda-rows.ts's file comment)
 * but the user wants one combined "Save All Changes" button for both
 * rather than two separate ones. When `hideActions` is set, this
 * component still owns a real `<form>` and its own `useActionState`
 * submission (native `form.requestSubmit()`, called externally via
 * `formId`, still triggers it exactly like a real click would) -- it
 * just doesn't render its own button/feedback, reporting dirty/pending/
 * result up through the two callbacks instead so a parent wrapping
 * *two* of these can combine them into one button and one status line.
 * Every other caller (non-Sacrament meeting types, which only ever
 * render one of these) is unaffected -- these props are all optional
 * and default to the original all-in-one-component behavior.
 */
export function AgendaGridForm({
  meetingId,
  roleTable,
  rows,
  people,
  hymnalIndex,
  formId,
  hideActions,
  onDirtyChange,
  onStateChange,
}: {
  meetingId: string;
  roleTable: "sacrament_assignments" | "bishopric_assignments";
  rows: AgendaRow[];
  people: PersonOption[];
  hymnalIndex: HymnalIndexEntry[];
  formId?: string;
  hideActions?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onStateChange?: (state: { error?: string; success?: boolean }, pending: boolean) => void;
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

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  useEffect(() => onStateChange?.(state, pending), [state, pending, onStateChange]);

  return (
    <form id={formId} action={formAction} onChange={() => setDirty(true)}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <tbody>
            {rows.map((row) => {
              if (row.kind === "banner") {
                return (
                  <tr key={row.id} className="border-t border-rule/60">
                    <td colSpan={2} className="px-2 py-2 text-center">
                      <span className="font-display text-sm italic text-ink">{row.label}</span>
                      {row.note && <span className="ml-2 text-xs text-ink-muted/60">{row.note}</span>}
                      {row.href && (
                        <Link href={row.href} className="ml-2 text-xs text-ink-muted underline hover:text-ink">
                          Manage &rarr;
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              }

              if (row.kind === "section") {
                return (
                  <tr key={row.id} className="border-t-2 border-rule">
                    <td colSpan={2} className="px-2 pb-1 pt-4">
                      <span className="font-mono text-[11px] uppercase tracking-wider text-ink-muted/70">
                        {row.label}
                      </span>
                    </td>
                  </tr>
                );
              }

              if (row.kind === "ward_business") {
                return (
                  <tr key={row.id} className="border-t border-rule/60 align-top">
                    <th scope="row" className="w-40 px-2 py-2 text-left align-top font-display text-sm font-normal text-ink sm:w-48">
                      {row.label}
                    </th>
                    <td className="px-2 py-1.5">
                      <WardBusinessField
                        meetingId={meetingId}
                        items={row.items}
                        callableCallings={row.callableCallings}
                        callableReleases={row.callableReleases}
                      />
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
                      <PersonSelect name={row.field} people={row.eligiblePeople} defaultValue={row.value} />
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

                    {row.kind === "music" && <MusicCell row={row} hymnalIndex={hymnalIndex} />}

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

                    {row.kind === "recognize_music" && (
                      <div className="flex flex-col gap-1.5 sm:flex-row">
                        <div className="sm:w-1/2">
                          <label className="block text-[10px] uppercase tracking-wider text-ink-muted/60">
                            Chorister
                          </label>
                          <PersonSelect
                            name={row.choristerField}
                            people={row.choristerEligible}
                            defaultValue={row.choristerValue}
                          />
                        </div>
                        <div className="sm:w-1/2">
                          <label className="block text-[10px] uppercase tracking-wider text-ink-muted/60">
                            Organist
                          </label>
                          <PersonSelect
                            name={row.organistField}
                            people={row.organistEligible}
                            defaultValue={row.organistValue}
                          />
                        </div>
                      </div>
                    )}

                    {row.kind === "stake_business" && <StakeBusinessCell row={row} />}

                    {row.kind === "visiting_authorities" && (
                      <VisitingAuthoritiesField row={row} onDirty={() => setDirty(true)} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!hideActions && (
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
      )}
    </form>
  );
}
