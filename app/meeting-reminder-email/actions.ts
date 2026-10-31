"use server";

import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { getEmailableAttendees } from "@/lib/data/meeting-reminder-email";
import { sendEmail } from "@/lib/email/send-email";

type SendReminderResult = { error?: string; success?: boolean; sentCount?: number };

async function requireReminderFeature(): Promise<{ error: string } | null> {
  const { profile } = await getSessionUser();
  if (!hasFeature(profile, "meeting_reminder_email")) return { error: "Not authorized." };
  return null;
}

/**
 * Sends the reminder -- re-derives every recipient's real email from
 * the submitted PERSON ids, never from a raw email string the client
 * might have sent (so a tampered form field can't redirect the email
 * anywhere this app doesn't already know about). meetingTypeId is
 * bound server-side by the caller (the page's own form action), not
 * read from the submission either, for the same reason.
 */
export async function sendReminderEmail(meetingTypeId: string, _prevState: unknown, formData: FormData): Promise<SendReminderResult> {
  const denied = await requireReminderFeature();
  if (denied) return denied;

  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const selectedIds = new Set(formData.getAll("recipient_id").map(String));

  if (!subject) return { error: "Enter a subject." };
  if (!body) return { error: "Enter a message." };
  if (selectedIds.size === 0) return { error: "Select at least one recipient." };

  const attendees = await getEmailableAttendees(meetingTypeId);
  const recipients = attendees.filter((a) => selectedIds.has(a.id));
  if (recipients.length === 0) {
    return { error: "None of the selected recipients currently have a linked login with an email -- refresh and try again." };
  }

  try {
    await sendEmail({ bcc: recipients.map((r) => r.email), subject, text: body });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not send the email." };
  }

  return { success: true, sentCount: recipients.length };
}
