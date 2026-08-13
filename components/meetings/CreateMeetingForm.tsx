"use client";

import { useActionState } from "react";
import { createMeeting, type CreateMeetingState } from "@/app/meetings/new/actions";
import type { MeetingTypeOption } from "@/lib/data/meeting-types";

const initialState: CreateMeetingState = {};

export function CreateMeetingForm({ meetingTypes }: { meetingTypes: MeetingTypeOption[] }) {
  const [state, formAction, pending] = useActionState(createMeeting, initialState);

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-3">
      <label className="text-sm text-slate">
        Meeting Type
        <select
          name="meeting_type_id"
          required
          defaultValue=""
          className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
        >
          <option value="" disabled>
            Choose a meeting type
          </option>
          {meetingTypes.map((mt) => (
            <option key={mt.id} value={mt.id}>
              {mt.name}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm text-slate">
        Date
        <input
          type="date"
          name="date"
          required
          className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink/90 disabled:opacity-50"
      >
        {pending ? "Creating..." : "Create Meeting"}
      </button>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}