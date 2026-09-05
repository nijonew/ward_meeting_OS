"use client";

import { useActionState, useState } from "react";
import { createMeeting, type CreateMeetingState } from "@/app/meetings/new/actions";
import type { MeetingTypeOption } from "@/lib/data/meeting-types";
import { SPECIAL_FORMATS } from "@/lib/data/sacrament-constants";

const initialState: CreateMeetingState = {};

export function CreateMeetingForm({ meetingTypes }: { meetingTypes: MeetingTypeOption[] }) {
  const [state, formAction, pending] = useActionState(createMeeting, initialState);
  const [meetingTypeId, setMeetingTypeId] = useState("");

  const isSacrament = meetingTypes.find((mt) => mt.id === meetingTypeId)?.slug === "sacrament-meeting";

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-3">
      <label className="text-sm text-slate">
        Meeting Type
        <select
          name="meeting_type_id"
          required
          value={meetingTypeId}
          onChange={(e) => setMeetingTypeId(e.target.value)}
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

      {isSacrament && (
        <label className="text-sm text-slate">
          Special Format
          <select
            name="special_format"
            defaultValue="standard"
            className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
          >
            {SPECIAL_FORMATS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-slate/70">
            Picks this meeting&rsquo;s starting agenda elements. Changing it later (in Meeting Info)
            won&rsquo;t re-populate the agenda &mdash; add/remove elements yourself if you change your mind.
          </span>
        </label>
      )}

      <label className="text-sm text-slate">
        Date
        <input
          type="date"
          name="date"
          required
          className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm text-slate">
          Time (optional)
          <input
            type="time"
            name="time_of_day"
            className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="text-sm text-slate">
          Duration, minutes (optional)
          <input
            type="number"
            name="duration_minutes"
            min={5}
            step={5}
            className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
          />
        </label>
      </div>

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
