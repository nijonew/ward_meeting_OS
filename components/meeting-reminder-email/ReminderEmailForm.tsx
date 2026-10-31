"use client";

import { useActionState } from "react";
import { sendReminderEmail } from "@/app/meeting-reminder-email/actions";
import type { EmailableAttendee } from "@/lib/data/meeting-reminder-email";

const initialState: { error?: string; success?: boolean; sentCount?: number } = {};

/**
 * The actual compose form -- a pre-filled Subject/Body (editable, never
 * sent verbatim without a human looking at it first) plus a checklist
 * of everyone eligible to receive it (attends this meeting type by
 * calling, and has a linked login with a real email -- see
 * getEmailableAttendees). `defaultCheckedIds` pre-checks whoever is
 * actually assigned a role this meeting, so the common case ("remind
 * the people who have something to do") needs no extra clicking; the
 * secretary can still add or remove anyone else from the same list.
 */
export function ReminderEmailForm({
  meetingTypeId,
  defaultSubject,
  defaultBody,
  attendees,
  defaultCheckedIds,
}: {
  meetingTypeId: string;
  defaultSubject: string;
  defaultBody: string;
  attendees: EmailableAttendee[];
  defaultCheckedIds: string[];
}) {
  const boundSend = sendReminderEmail.bind(null, meetingTypeId);
  const [state, formAction, pending] = useActionState(boundSend, initialState);
  const checkedSet = new Set(defaultCheckedIds);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        Subject
        <input
          type="text"
          name="subject"
          defaultValue={defaultSubject}
          required
          className="rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-ink-muted">
        Message
        <textarea
          name="body"
          defaultValue={defaultBody}
          required
          rows={12}
          className="rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
        />
      </label>

      <div>
        <p className="text-xs text-ink-muted">
          Send to -- only people with a linked login that includes an email can be selected.
        </p>
        {attendees.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">
            Nobody who attends this meeting has a linked login with an email yet -- link accounts via Verify Logins first.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {attendees.map((a) => (
              <li key={a.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="recipient_id" value={a.id} defaultChecked={checkedSet.has(a.id)} id={`recipient-${a.id}`} />
                <label htmlFor={`recipient-${a.id}`} className="text-ink">
                  {a.name} <span className="text-ink-muted">({a.email})</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || attendees.length === 0}
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Sending..." : "Send"}
        </button>
        {state.error && <p className="text-sm text-danger">{state.error}</p>}
        {!pending && state.success && !state.error && (
          <p className="text-sm text-success">
            Sent to {state.sentCount} recipient{state.sentCount === 1 ? "" : "s"}.
          </p>
        )}
      </div>
    </form>
  );
}
