"use client";

import { useState } from "react";

/**
 * Cancel, as a real button rather than plain text (2026-09-09, the
 * user's own request: "turn the 'cancel' option into a button and have
 * the reason field appear after the cancel button is pressed and at
 * the end of the meeting line instead of in front of the cancel
 * button"). Needs client state purely to toggle the reason field's
 * visibility -- a plain server-action `<form>` can't reveal a field on
 * click on its own -- so this is its own small client component rather
 * than inline JSX in MeetingRow.
 *
 * `cancelAction` is the inline "use server" closure MeetingRow already
 * defines per row (wrapping cancelMeeting with this meeting's id) --
 * an inline server action, same as the `assign`/`addEntry` closures
 * used elsewhere in this app, is allowed to cross the server/client
 * boundary as a function (only a *plain* JS function can't -- see the
 * formatDate-prop bug written up elsewhere in this app's history).
 */
export function CancelMeetingButton({
  meetingId,
  cancelAction,
}: {
  meetingId: string;
  cancelAction: (formData: FormData) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);

  const BUTTON_CLASS = "whitespace-nowrap rounded border border-rule px-3 py-1.5 text-xs text-ink hover:bg-ink/5";

  if (!expanded) {
    return (
      <button type="button" onClick={() => setExpanded(true)} className={BUTTON_CLASS}>
        Cancel
      </button>
    );
  }

  return (
    <form action={cancelAction} className="flex items-center gap-2">
      <input type="hidden" name="id" value={meetingId} />
      <button type="submit" className={BUTTON_CLASS}>
        Cancel
      </button>
      <input
        type="text"
        name="cancellation_note"
        placeholder="Reason (optional)"
        autoFocus
        className="w-40 rounded border border-rule bg-paper px-1.5 py-1 text-[11px] text-ink"
      />
    </form>
  );
}
