"use client";

import { useState, useTransition } from "react";

/**
 * Delete, distinct from Cancel (2026-10-03, the user's own distinction:
 * "The cancel button is for a meeting that would normally be held but
 * is not to be held... it is informational to those that see normal
 * meeting times. On the other hand I accidentally added a second
 * sacrament meeting for a date that was already planned. I want to be
 * able to delete that meeting") -- Cancel keeps the meeting on the
 * calendar, visibly marked as not happening; Delete removes the
 * meeting record and everything tied to it outright, for a genuine
 * mistake like an accidental duplicate.
 *
 * A plain `window.confirm` (same convention this app already uses for
 * every other destructive Remove button) rather than a reveal-a-field
 * pattern like CancelMeetingButton's -- there's no reason to collect,
 * since the action is unconditional once confirmed, just irreversible,
 * so the confirm text itself carries the weight: names the meeting,
 * says what's destroyed, and says explicitly that no other meeting is
 * affected (the question the user asked directly: "Does it impact the
 * agenda of the meeting I actually want on that date?" -- no, every
 * table this touches is scoped to this one meeting's own id).
 *
 * `deleteAction` is the inline "use server" closure MeetingRow defines
 * per row (wrapping deleteMeeting with this meeting's id) -- same
 * cross-boundary pattern as CancelMeetingButton's own cancelAction.
 *
 * **Bug found and fixed 2026-10-04** (the user's own report: "the
 * delete button is there but doesn't seem to actually remove the
 * meeting when pushed... I have browsed away from the page then back
 * and the meeting remains"): `deleteAction`'s result was never read at
 * all -- a failed delete (wrong feature, an RPC error, anything)
 * returned `{ error: "..." }` from `deleteMeeting` straight into the
 * void, with nothing on screen ever telling the admin it didn't work.
 * Now reads the result and shows the message inline if there is one.
 */
export function DeleteMeetingButton({
  meetingLabel,
  deleteAction,
}: {
  meetingLabel: string;
  deleteAction: () => Promise<{ success: true } | { error: string }>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    const confirmed = window.confirm(
      `Permanently delete ${meetingLabel}?\n\nThis removes its entire agenda -- assignments, music, speakers, everything entered for it -- and cannot be undone. It will not affect any other meeting, even one on the same date.`
    );
    if (!confirmed) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteAction();
      if ("error" in result) setError(result.error);
    });
  };

  return (
    <span className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="whitespace-nowrap rounded border border-danger/40 px-3 py-1.5 text-xs text-danger hover:bg-danger/5 disabled:opacity-50"
      >
        {pending ? "Deleting..." : "Delete"}
      </button>
      {error && <span className="text-[11px] text-danger">{error}</span>}
    </span>
  );
}
