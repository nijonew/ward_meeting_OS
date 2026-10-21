"use client";

import { useActionState } from "react";
import { pushFixedSacramentRoles } from "@/app/rotations/actions";

const initialState: { error?: string; filled?: number; skippedExisting?: number; skippedVacant?: number } = {};

/**
 * "Fill Presiding/Conducting starting <date>" -- the fixed-by-calling
 * counterpart to PushRotationForm (2026-10-21), for the one case that
 * tool can't reach: Presiding/Conducting have no rotation_members list
 * to push from at all. Fills whichever of the two is currently blank
 * for every upcoming Sacrament Meeting from the chosen date forward,
 * reading each calling's current holder fresh. See
 * pushFixedSacramentRolesToUpcomingMeetings (lib/data/rotations.ts).
 */
export function PushFixedRolesForm() {
  const [state, formAction, pending] = useActionState(pushFixedSacramentRoles, initialState);

  return (
    <div className="mt-3 border-t border-rule/60 pt-3">
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <label className="text-[11px] text-ink-muted">
          Fill Presiding/Conducting for upcoming meetings starting
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
          {pending ? "Filling..." : "Fill"}
        </button>
      </form>
      {state.error && <p className="mt-1 text-[11px] text-danger">{state.error}</p>}
      {state.filled !== undefined && (
        <p className="mt-1 text-[11px] text-ink-muted">
          Filled {state.filled} role{state.filled === 1 ? "" : "s"}
          {state.skippedExisting ? ` (${state.skippedExisting} already had someone assigned)` : ""}
          {state.skippedVacant
            ? ` (${state.skippedVacant} skipped -- that calling currently has no holder set)`
            : ""}
          .
        </p>
      )}
    </div>
  );
}
