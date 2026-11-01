"use client";

import { useActionState, useEffect, useState } from "react";
import { saveCouncilNotes } from "@/app/meetings/[id]/council-actions";
import type { CouncilNotes } from "@/lib/data/council-notes";

type SaveState = { error?: string; success?: boolean };
const initialState: SaveState = {};

/**
 * **Rebuilt as a Client Component, 2026-11-01** (the user's own
 * report: "the meetings have too many instances of the save all
 * changes button") -- same shape as `BishopricMinutesForm`'s own
 * identical rework, gaining optional `formId`/`hideActions`/
 * `onDirtyChange`/`onStateChange` props so `CollaborativeMeetingBody`
 * can fold this form's own save into one combined button. Still works
 * on its own when none of those are passed in.
 */
export function CouncilNotesForm({
  meetingId,
  notes,
  formId,
  hideActions,
  onDirtyChange,
  onStateChange,
}: {
  meetingId: string;
  notes: CouncilNotes | null;
  formId?: string;
  hideActions?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onStateChange?: (state: SaveState, pending: boolean) => void;
}) {
  const boundSave = saveCouncilNotes.bind(null, meetingId);
  const [state, formAction, pending] = useActionState(boundSave, initialState);
  const [dirty, setDirty] = useState(false);

  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (state.success && dirty) setDirty(false);
  }

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  useEffect(() => onStateChange?.(state, pending), [state, pending, onStateChange]);

  return (
    <form id={formId} action={formAction} onChange={() => setDirty(true)} className="rounded border border-rule bg-surface p-6">
      <h2 className="font-display text-xl">Notes</h2>

      <label className="mt-4 block text-sm text-ink-muted">
        Meeting Notes
        <textarea
          name="notes"
          defaultValue={notes?.notes ?? ""}
          rows={6}
          className="mt-1 block w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
        />
      </label>

      <label className="mt-4 block text-sm text-ink-muted">
        Next Meeting Date
        <input
          type="date"
          name="next_meeting_date"
          defaultValue={notes?.next_meeting_date ?? ""}
          className="mt-1 block w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
        />
      </label>

      {!hideActions && (
        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={!dirty || pending}
            className="rounded bg-accent px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? "Saving..." : "Save"}
          </button>
          {state.error && <p className="text-sm text-danger">{state.error}</p>}
          {!pending && !dirty && state.success && !state.error && <p className="text-sm text-success">Saved.</p>}
        </div>
      )}
    </form>
  );
}
