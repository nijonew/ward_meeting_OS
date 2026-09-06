"use client";

import { useActionState } from "react";
import { generateYouthActivities } from "@/app/youth-activities/actions";

const initialState: { error?: string; created?: number; skippedExisting?: number } = {};

export function GenerateYouthActivitiesForm() {
  const [state, formAction, pending] = useActionState(generateYouthActivities, initialState);

  return (
    <div className="rounded-lg border border-rule bg-card p-6">
      <h2 className="font-display text-xl">Generate Combined Activities</h2>
      <p className="mt-1 text-sm text-slate">
        Creates placeholder Combined YM (1st Wednesday), Combined YW (2nd &amp; 4th), and Combined
        YM/YW (3rd) activities through the chosen date, rotating the planning group automatically.
        Each is created tentative (unconfirmed, draft) with a &ldquo;(TBD)&rdquo; title &mdash; edit
        the real activity in below once it&rsquo;s decided. Safe to run again later; existing dates
        are never duplicated.
      </p>

      <form action={formAction} className="mt-4 flex flex-wrap items-center gap-3">
        <label className="text-xs text-slate">
          Through
          <input
            type="date"
            name="through_date"
            required
            className="ml-2 rounded-md border border-rule bg-paper px-2 py-1.5 text-xs text-ink"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-ink px-4 py-2 text-xs font-medium text-paper transition-colors hover:bg-ink/90 disabled:opacity-50"
        >
          {pending ? "Generating..." : "Generate"}
        </button>
      </form>

      {state.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}
      {state.created !== undefined && (
        <p className="mt-3 text-sm text-ink">
          Created {state.created} activit{state.created === 1 ? "y" : "ies"}
          {state.skippedExisting ? ` (${state.skippedExisting} already had a scheduled activity and were skipped)` : ""}.
        </p>
      )}
    </div>
  );
}
