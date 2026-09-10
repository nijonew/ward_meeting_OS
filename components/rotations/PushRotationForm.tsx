"use client";

import { useActionState } from "react";
import { pushRotation } from "@/app/rotations/actions";

const initialState: { error?: string; filled?: number; skippedExisting?: number } = {};

/** "Push rotations starting <date>" -- fills the applied-assignment
 *  grid from this rotation's own order for every upcoming meeting from
 *  the chosen date forward, skipping any that already have someone
 *  assigned. See lib/data/rotations.ts's pushRotationToUpcomingMeetings. */
export function PushRotationForm({ rotationId }: { rotationId: string }) {
  const boundPush = pushRotation.bind(null, rotationId);
  const [state, formAction, pending] = useActionState(boundPush, initialState);

  return (
    <div className="mt-3 border-t border-rule/60 pt-3">
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <label className="text-[11px] text-ink-muted">
          Push to upcoming meetings starting
          <input
            type="date"
            name="from_date"
            required
            className="ml-2 rounded border border-rule bg-paper px-2 py-1 text-[11px] text-ink"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded border border-rule px-2.5 py-1 text-[11px] text-ink hover:bg-ink/5 disabled:opacity-50"
        >
          {pending ? "Pushing..." : "Push"}
        </button>
      </form>
      {state.error && <p className="mt-1 text-[11px] text-red-600">{state.error}</p>}
      {state.filled !== undefined && (
        <p className="mt-1 text-[11px] text-ink-muted">
          Filled {state.filled} meeting{state.filled === 1 ? "" : "s"}
          {state.skippedExisting ? ` (${state.skippedExisting} already had someone assigned and were left alone)` : ""}.
        </p>
      )}
    </div>
  );
}
