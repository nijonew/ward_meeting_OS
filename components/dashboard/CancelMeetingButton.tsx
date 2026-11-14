"use client";

import { useState } from "react";
import { FormSubmitButton } from "@/components/FormSubmitButton";

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

  const BUTTON_CLASS =
    "whitespace-nowrap rounded border border-danger/40 px-3 py-1.5 text-xs text-danger hover:bg-danger/5";

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
      <FormSubmitButton pendingLabel="Cancelling..." className={BUTTON_CLASS}>
        Cancel
      </FormSubmitButton>
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

/**
 * Un-cancel's own counterpart (2026-11-14) -- was plain inline JSX in
 * app/dashboard/page.tsx (a bare `<form action={uncancel}>` with a
 * bare submit button, no pending feedback at all), but a Server
 * Component page can't call useFormStatus directly, so it's pulled
 * out into this file alongside its paired Cancel button above.
 */
export function UncancelMeetingButton({ uncancelAction }: { uncancelAction: () => Promise<void> }) {
  return (
    <form action={uncancelAction}>
      <FormSubmitButton
        pendingLabel="Un-cancelling..."
        className="whitespace-nowrap rounded border border-rule px-3 py-1.5 text-xs text-ink hover:bg-ink/5"
      >
        Un-cancel
      </FormSubmitButton>
    </form>
  );
}
