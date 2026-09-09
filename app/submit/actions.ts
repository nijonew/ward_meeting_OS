"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateMeetingId } from "@/lib/data/meetings";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { getVisibleMeetingTypesForUser } from "@/lib/data/meeting-type-access";
import type { MeetingTypeSlug } from "@/lib/types";
import { OTHER_VALUE } from "@/lib/data/announcement-constants";

const TIME_NEEDED_OPTIONS = ["1-2 Minutes", "3-5 Minutes", "6+ Minutes"];

/** For the form's two "Other" radio questions (organization, type): the
 *  free-text box submitted alongside the radio replaces the literal
 *  "Other" value, so admins see the real answer instead of a dead-end
 *  label. Falls back to "Other" only if the box was left blank. */
function resolveOtherRadio(rawValue: string, otherText: string): string {
  return rawValue === OTHER_VALUE ? otherText.trim() || OTHER_VALUE : rawValue;
}

/** No separate title field on the real form this matches -- derive a
 *  short one from the description so agenda_items.title (NOT NULL)
 *  still has something reasonable to show in lists. */
function deriveTitle(description: string): string {
  const oneLine = description.trim().replace(/\s+/g, " ");
  return oneLine.length > 80 ? `${oneLine.slice(0, 77)}...` : oneLine || "Agenda Item";
}

/**
 * Matches the real announcement form the ward already uses (pasted by
 * the user 2026-09-05 -- the linked Google Form itself 401'd on every
 * fetch attempt): email required, no name field at all, single-select
 * organization + type (each with a free-text "Other"), multi-select
 * audience + where-announced, title + description, and an optional
 * date/time range/location/link -- file attachment deliberately
 * skipped. Published immediately -- included by default, per the
 * workflow -- rather than starting pending; an admin can still exclude
 * it from Table Admin or the Announcements inbox.
 */
export async function submitAnnouncement(formData: FormData) {
  const supabase = await createClient();

  const email = String(formData.get("submitted_by_email") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const organization = resolveOtherRadio(
    String(formData.get("organization") ?? "").trim(),
    String(formData.get("organization_other") ?? "")
  );
  const announcementType = resolveOtherRadio(
    String(formData.get("announcement_type") ?? "").trim(),
    String(formData.get("announcement_type_other") ?? "")
  );
  const audience = formData.getAll("audience").map(String).filter(Boolean).join(", ");
  const whereAnnounced = formData.getAll("where_announced").map(String).filter(Boolean).join(", ");
  const startDate = String(formData.get("start_date") ?? "").trim() || null;
  const startTime = String(formData.get("start_time") ?? "").trim() || null;
  const endDate = String(formData.get("end_date") ?? "").trim() || null;
  const endTime = String(formData.get("end_time") ?? "").trim() || null;
  const location = String(formData.get("location") ?? "").trim() || null;
  const linkUrl = String(formData.get("link_url") ?? "").trim() || null;

  if (!email || !title || !body || !organization || !announcementType || !audience || !whereAnnounced) {
    redirect(
      `/submit?error=${encodeURIComponent(
        "Email, organization, audience, where to announce, type, title, and description are required."
      )}`
    );
  }

  const { error } = await supabase.from("announcements").insert({
    title,
    body,
    submitted_by_name: "(not given)",
    submitted_by_email: email,
    status: "published",
    organization,
    announcement_type: announcementType,
    audience,
    where_announced: whereAnnounced,
    start_date: startDate,
    start_time: startTime,
    end_date: endDate,
    end_time: endTime,
    location,
    link_url: linkUrl,
  });

  if (error) {
    redirect(`/submit?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/announcements");
  revalidatePath("/announcements/public");
  redirect("/submit?success=1");
}

/**
 * Matches the real public agenda-item form the ward already uses
 * (fetched and confirmed 2026-09-05), minus the email/name fields --
 * **moved behind login and calling-gated 2026-09-09** (the user's own
 * request: "make it available only to those who attend meetings"), so
 * the submitter is a known signed-in account now, not a self-reported
 * name/email. A specific meeting type + date instead of picking "some
 * meeting" later, one description field (no separate title), and how
 * much time is needed. Resolves straight to a real meeting (creating
 * it via getOrCreateMeetingId if that date doesn't have one yet, same
 * as Table Admin's calendar picker) instead of leaving meeting_id null
 * for an admin to sort out afterward. Published immediately -- included
 * by default, per the workflow -- rather than starting pending; an
 * admin can still archive it from the meeting's own Agenda Items
 * section.
 *
 * Re-checks meeting-type access server-side (not just the page's own
 * filtered <select>) via the same getVisibleMeetingTypesForUser used
 * to decide which "My meetings" tiles show up -- this is a real access
 * boundary now that submission isn't open to anyone with the link, so
 * it can't rely on the UI alone to keep someone from POSTing a
 * meeting_type they have no calling-based access to.
 */
export async function submitAgendaItem(formData: FormData) {
  const supabase = await createClient();
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");

  const meetingTypeSlug = String(formData.get("meeting_type") ?? "") as MeetingTypeSlug;
  const dateIso = String(formData.get("meeting_date") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const timeNeeded = String(formData.get("time_needed") ?? "");

  if (!meetingTypeSlug || !dateIso || !description) {
    redirect(`/submit/agenda-item?error=${encodeURIComponent("Meeting, date, and description are required.")}`);
  }

  if (profile?.role !== "bishopric") {
    const allowedTypes = await getVisibleMeetingTypesForUser(user.id);
    if (!allowedTypes.includes(meetingTypeSlug)) {
      redirect(
        `/submit/agenda-item?error=${encodeURIComponent(
          "You don't have access to submit an agenda item for that meeting."
        )}`
      );
    }
  }

  const meetingId = await getOrCreateMeetingId(dateIso, meetingTypeSlug);
  if (!meetingId) {
    redirect(`/submit/agenda-item?error=${encodeURIComponent("Could not find or create that meeting.")}`);
  }

  const { error } = await supabase.from("agenda_items").insert({
    title: deriveTitle(description),
    body: description,
    submitted_by_name: profile?.display_name || user.email || "(not given)",
    submitted_by_email: profile?.email || user.email || "",
    status: "published",
    meeting_id: meetingId,
    time_needed: TIME_NEEDED_OPTIONS.includes(timeNeeded) ? timeNeeded : null,
  });

  if (error) {
    redirect(`/submit/agenda-item?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/meetings/${meetingId}/planning`);
  redirect("/submit/agenda-item?success=1");
}
