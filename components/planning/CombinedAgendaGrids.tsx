"use client";

import { useState, type ReactNode } from "react";
import { AgendaGridForm } from "@/components/planning/AgendaGridForm";
import type { AgendaRow } from "@/lib/data/agenda-rows";
import type { PersonOption } from "@/lib/data/people";

const OPENING_FORM_ID = "agenda-form-opening";
const CLOSING_FORM_ID = "agenda-form-closing";

type SaveState = { error?: string; success?: boolean };

/**
 * One combined "Save All Changes" button for Sacrament Meeting's two
 * agenda grid halves (2026-09-10, the user's own request: "remove the
 * save all changes button from the sacrament administration section")
 * -- the page still needs two separate `<form>`s (Teaching Program,
 * sitting between them, has its own real add/remove forms that can't
 * nest inside either -- see agenda-rows.ts's file comment), but one
 * button now drives both: clicking it calls the browser's native
 * `form.requestSubmit()` on each underlying `<form id="...">` in turn,
 * which invokes each form's own `useActionState` action exactly as a
 * real click on its own button would have. Combined dirty/pending/
 * result state is reported up from both `AgendaGridForm` instances
 * (`hideActions` suppresses each one's own button/feedback) via
 * `onDirtyChange`/`onStateChange`.
 */
export function CombinedAgendaGrids({
  meetingId,
  roleTable,
  openingRows,
  closingRows,
  people,
  children,
}: {
  meetingId: string;
  roleTable: "sacrament_assignments" | "bishopric_assignments";
  openingRows: AgendaRow[];
  closingRows: AgendaRow[];
  people: PersonOption[];
  /** Rendered between the two forms -- Teaching Program (SacramentProgramSection
   *  plus its own section heading), which can't live inside either `<form>`
   *  (its own add/remove/save controls are real forms of their own). */
  children?: ReactNode;
}) {
  const [dirtyA, setDirtyA] = useState(false);
  const [dirtyB, setDirtyB] = useState(false);
  const [pendingA, setPendingA] = useState(false);
  const [pendingB, setPendingB] = useState(false);
  const [stateA, setStateA] = useState<SaveState>({});
  const [stateB, setStateB] = useState<SaveState>({});

  const dirty = dirtyA || dirtyB;
  const pending = pendingA || pendingB;
  const error = stateA.error || stateB.error;
  const bothSaved = !error && stateA.success === true && stateB.success === true;

  const handleSaveAll = () => {
    (document.getElementById(OPENING_FORM_ID) as HTMLFormElement | null)?.requestSubmit();
    (document.getElementById(CLOSING_FORM_ID) as HTMLFormElement | null)?.requestSubmit();
  };

  return (
    <div className="flex flex-col gap-6">
      <AgendaGridForm
        meetingId={meetingId}
        roleTable={roleTable}
        rows={openingRows}
        people={people}
        formId={OPENING_FORM_ID}
        hideActions
        onDirtyChange={setDirtyA}
        onStateChange={(state, isPending) => {
          setStateA(state);
          setPendingA(isPending);
        }}
      />

      {children}

      {closingRows.length > 0 && (
        <AgendaGridForm
          meetingId={meetingId}
          roleTable={roleTable}
          rows={closingRows}
          people={people}
          formId={CLOSING_FORM_ID}
          hideActions
          onDirtyChange={setDirtyB}
          onStateChange={(state, isPending) => {
            setStateB(state);
            setPendingB(isPending);
          }}
        />
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSaveAll}
          disabled={!dirty || pending}
          className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Saving..." : "Save All Changes"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!pending && !dirty && bothSaved && <p className="text-sm text-success">Saved.</p>}
      </div>
    </div>
  );
}
