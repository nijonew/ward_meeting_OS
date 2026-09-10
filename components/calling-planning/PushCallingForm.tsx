"use client";

import { useActionState } from "react";
import { pushCallingToSacramentMeeting } from "@/app/calling-planning/actions";
import type { Meeting } from "@/lib/types";

const initialState: { error?: string; success?: boolean } = {};

/**
 * One small standalone form per row that's ready to announce -- kept
 * separate from the main grid's big Save All form (a <form> can't nest
 * inside another <form>), same pattern as PushRotationForm sitting
 * outside the Assignment Rotations grid's own form.
 */
export function PushCallingForm({
  planningId,
  callingId,
  upcomingSacramentMeetings,
}: {
  planningId: string;
  callingId: string;
  upcomingSacramentMeetings: Meeting[];
}) {
  const boundPush = pushCallingToSacramentMeeting.bind(null, planningId, callingId);
  const [state, formAction, pending] = useActionState(boundPush, initialState);

  return (
    <div>
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <select
          name="meeting_id"
          required
          defaultValue=""
          className="rounded border border-rule bg-paper px-2 py-1.5 text-xs text-ink"
        >
          <option value="" disabled>
            Choose meeting&hellip;
          </option>
          {upcomingSacramentMeetings.map((m) => (
            <option key={m.id} value={m.id}>
              {new Date(`${m.date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-paper transition-colors hover:bg-accent/90 disabled:opacity-50"
        >
          {pending ? "Adding..." : "Add to Sacrament Meeting"}
        </button>
      </form>
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
      {!pending && state.success && !state.error && <p className="mt-1 text-xs text-success">Added.</p>}
    </div>
  );
}
