"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateMeetingId } from "@/lib/data/meetings";
import type { MeetingTypeSlug } from "@/lib/types";

const TIME_NEEDED_OPTIONS = ["1-2 Minutes", "3-5 Minutes", "6+ Minutes"];

/** No separate title field on the real form this matches -- derive a
 *  short one from the description so agenda_items.title (NOT NULL)
 *  still has something reasonable to show in lists. */
function deriveTitle(description: string): string {
  const oneLine = description.trim().replace(/\s+/g, " ");
  return oneLine.length > 80 ? `${oneLine.slice(0, 77)}...` : oneLine || "Agenda Item";
}

export async function submitAnnouncement(formData: FormData) {
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const name = String(formData.get("submitted_by_name") ?? "").trim();
  const email = String(formData.get("submitted_by_email") ?? "").trim();

  if (!title || !name || !email) {
    redirect(`/submit?error=${encodeURIComponent("Name, email, and title are required.")}`);
  }

  const { error } = await supabase.from("announcements").insert({
    title,
    body,
    submitted_by_name: name,
    submitted_by_email: email,
    status: "pending",
  });

  if (error) {
    redirect(`/submit?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/announcements");
  redirect("/submit?success=1");
}

/**
 * Matches the real public agenda-item form the ward already uses
 * (fetched and confirmed 2026-09-05): email required, name optional,
 * a specific meeting type + date instead of picking "some meeting"
 * later, one description field (no separate title), and how much time
 * is needed. Resolves straight to a real meeting (creating it via
 * getOrCreateMeetingId if that date doesn't have one yet, same as
 * Table Admin's calendar picker) instead of leaving meeting_id null for
 * an admin to sort out afterward. Published immediately -- included by
 * default, per the workflow -- rather than starting pending; an admin
 * can still archive it from the meeting's own Agenda Items section.
 */
export async function submitAgendaItem(formData: FormData) {
  const supabase = await createClient();

  const email = String(formData.get("submitted_by_email") ?? "").trim();
  const name = String(formData.get("submitted_by_name") ?? "").trim() || "(not given)";
  const meetingTypeSlug = String(formData.get("meeting_type") ?? "") as MeetingTypeSlug;
  const dateIso = String(formData.get("meeting_date") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const timeNeeded = String(formData.get("time_needed") ?? "");

  if (!email || !meetingTypeSlug || !dateIso || !description) {
    redirect(`/submit?error=${encodeURIComponent("Email, meeting, date, and description are required.")}`);
  }

  const meetingId = await getOrCreateMeetingId(dateIso, meetingTypeSlug);
  if (!meetingId) {
    redirect(`/submit?error=${encodeURIComponent("Could not find or create that meeting.")}`);
  }

  const { error } = await supabase.from("agenda_items").insert({
    title: deriveTitle(description),
    body: description,
    submitted_by_name: name,
    submitted_by_email: email,
    status: "published",
    meeting_id: meetingId,
    time_needed: TIME_NEEDED_OPTIONS.includes(timeNeeded) ? timeNeeded : null,
  });

  if (error) {
    redirect(`/submit?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/meetings/${meetingId}/planning`);
  redirect("/submit?success=1");
}
