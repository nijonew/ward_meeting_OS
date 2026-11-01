"use client";

import { useActionState, useEffect, useState } from "react";
import { saveBishopricMinutes } from "@/app/meetings/[id]/bishopric-actions";
import type { BishopricMinutes } from "@/lib/data/bishopric-meeting";

type SaveState = { error?: string; success?: boolean };
const initialState: SaveState = {};

/**
 * Trimmed to just General Minutes + Next Meeting Date, 2026-10-19 (the
 * user's own confirmation, "Yes, consolidate now") -- this form used to
 * also carry Spiritual Thought/Handbook Training/Calendar Review/
 * Callings Discussion/Sacrament Planning Discussion/Young Men
 * Coordination/Impressions as fixed columns here, duplicating the same
 * content the dynamic per-element agenda rows in the Discussion section
 * already capture. Those seven `bishopric_minutes` columns are left in
 * the schema, untouched and unused -- the same "harmless but real"
 * treatment this app already gives `callings.title_prefix`.
 *
 * **Rebuilt as a Client Component, 2026-11-01** (the user's own report:
 * "the meetings have too many instances of the save all changes
 * button") -- gained the same optional `formId`/`hideActions`/
 * `onDirtyChange`/`onStateChange` props `AgendaGridForm` already
 * supports, so `CollaborativeMeetingBody` can fold this form's own save
 * into one combined button alongside the agenda grid(s). Still works
 * on its own (its own visible button/feedback) when none of those are
 * passed in.
 */
export function BishopricMinutesForm({
  meetingId,
  minutes,
  formId,
  hideActions,
  onDirtyChange,
  onStateChange,
}: {
  meetingId: string;
  minutes: BishopricMinutes | null;
  formId?: string;
  hideActions?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onStateChange?: (state: SaveState, pending: boolean) => void;
}) {
  const boundSave = saveBishopricMinutes.bind(null, meetingId);
  const [state, formAction, pending] = useActionState(boundSave, initialState);
  const [dirty, setDirty] = useState(false);

  // Reset "dirty" the moment a save completes -- adjusting state during
  // render rather than in an effect, matching AgendaGridForm's own
  // pattern.
  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (state.success && dirty) setDirty(false);
  }

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  useEffect(() => onStateChange?.(state, pending), [state, pending, onStateChange]);

  return (
    <form id={formId} action={formAction} onChange={() => setDirty(true)} className="rounded border border-rule bg-surface p-6">
      <h2 className="font-display text-xl">Minutes</h2>

      <label className="mt-4 block text-sm text-ink-muted">
        General Minutes
        <textarea
          name="minutes_body"
          defaultValue={minutes?.minutes_body ?? ""}
          rows={5}
          className="mt-1 block w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
        />
      </label>

      <label className="mt-4 block text-sm text-ink-muted">
        Next Meeting Date
        <input
          type="date"
          name="next_meeting_date"
          defaultValue={minutes?.next_meeting_date ?? ""}
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
