"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateMeetingId } from "@/lib/data/meetings";
import { nextAgendaItemSortOrder } from "@/lib/data/bishopric-meeting";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { getVisibleMeetingTypesForUser } from "@/lib/data/meeting-type-access";
import type { MeetingTypeSlug } from "@/lib/types";
import { parseAnnouncementFormData } from "@/lib/data/announcements";

const TIME_NEEDED_OPTIONS = ["1-2 Minutes", "3-5 Minutes", "6+ Minutes"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

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
 * fetch attempt): single-select organization + type (each with a
 * free-text "Other"), multi-select audience + where-announced, title +
 * description, and an optional date/time range/location/link -- file
 * attachment deliberately skipped. Published immediately -- included
 * by default, per the workflow -- rather than starting pending; an
 * admin can still exclude it from Table Admin or the Announcements
 * inbox.
 *
 * **Moved behind login and calling-gated 2026-09-09** (the user's own
 * follow-up right after Agenda Item submission got the same treatment:
 * "the same for submitting announcements... same location, same
 * gatekeeping") -- reverses the original "anyone, no login" design.
 * No more email field at all: the submitter is a known signed-in
 * account now, so name/email come from the session (profile.display_name/
 * profile.email) instead of self-reported text, same pattern as
 * submitAgendaItem. Re-checks "attends a meeting, or is Bishopric"
 * server-side too, not just via the page's own gate, for the same
 * defense-in-depth reason submitAgendaItem re-checks meeting-type
 * access. Also allows the `announcement_adding` feature outright
 * (2026-10-04, granular-features pass -- replaces the old scalar
 * "bishopric"/"communications_specialist" role check), matching the
 * page's own gate exactly.
 *
 * **Optional image upload, 2026-11-01** (migration 099) -- same shape
 * as submitFeedback's own screenshot handling (app/feedback-actions.ts):
 * validates it's a real image under 5MB, uploads it under a fresh
 * random filename (never the browser's own name, so two unrelated
 * people's "flyer.jpg" can't collide) into the `announcement-images`
 * Storage bucket, and includes the resulting public URL on the insert.
 * A failed upload fails the whole submission, same redirect-with-error
 * pattern every other validation in this function already uses.
 *
 * **Field parsing extracted into `parseAnnouncementFormData`,
 * 2026-11-14** (`lib/data/announcements.ts`) -- shared with the new
 * form-based editor's own `updateAnnouncement`
 * (`app/announcements/actions.ts`) so the two can't drift apart on how
 * a field gets read/validated.
 */
export async function submitAnnouncement(formData: FormData) {
  const supabase = await createClient();
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");

  if (!hasFeature(profile, "announcement_adding")) {
    const allowedTypes = await getVisibleMeetingTypesForUser(user.id, profile?.features);
    if (allowedTypes.length === 0) {
      redirect(
        `/submit/announcement?error=${encodeURIComponent(
          "Announcement submission is limited to those who attend a meeting by calling."
        )}`
      );
    }
  }

  const parsed = parseAnnouncementFormData(formData);
  if ("error" in parsed) {
    redirect(`/submit/announcement?error=${encodeURIComponent(parsed.error)}`);
  }

  let imageUrl: string | null = null;
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    if (!image.type.startsWith("image/")) {
      redirect(`/submit/announcement?error=${encodeURIComponent("The attachment must be an image.")}`);
    }
    if (image.size > MAX_IMAGE_BYTES) {
      redirect(`/submit/announcement?error=${encodeURIComponent("Image must be smaller than 5MB.")}`);
    }
    const ext = image.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("announcement-images")
      .upload(path, image, { contentType: image.type });
    if (uploadError) {
      redirect(`/submit/announcement?error=${encodeURIComponent(`Could not upload image: ${uploadError.message}`)}`);
    }
    imageUrl = supabase.storage.from("announcement-images").getPublicUrl(path).data.publicUrl;
  }

  const { error } = await supabase.from("announcements").insert({
    ...parsed,
    submitted_by_name: profile?.display_name || user.email || "(not given)",
    submitted_by_email: profile?.email || user.email || "",
    status: "published",
    image_url: imageUrl,
  });

  if (error) {
    redirect(`/submit/announcement?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/announcements");
  revalidatePath("/announcements/public");
  redirect("/submit/announcement?success=1");
}

/**
 * Matches the real public agenda-item form the ward already uses
 * (fetched and confirmed 2026-09-05), minus the email/name fields --
 * **moved behind login and calling-gated 2026-09-09** (the user's own
 * request: "make it available only to those who attend meetings"), so
 * the submitter is a known signed-in account now, not a self-reported
 * name/email. One description field (no separate title) and how much
 * time is needed, shared across every target below. Resolves each
 * target straight to a real meeting (creating one via
 * getOrCreateMeetingId if that date doesn't have one yet, same as
 * Table Admin's calendar picker) instead of leaving meeting_id null
 * for an admin to sort out afterward. Published immediately -- included
 * by default, per the workflow -- rather than starting pending; an
 * admin can still archive it from the meeting's own Agenda Items
 * section.
 *
 * **Multiple meeting/date targets, 2026-11-15** (the user's own
 * request: "a way to select multiple meeting dates for agenda items
 * as well as multiple meeting types on multiple dates"). `AgendaItemForm`
 * now renders one row of `meeting_type`/`meeting_date` per target, all
 * sharing the same field names -- `formData.getAll(...)` returns
 * same-named fields in document order, and every row renders its type
 * select immediately before its own date input, so zipping the two
 * arrays positionally reproduces exactly the rows the user built.
 * Blank rows (missing type or date -- shouldn't happen from the real
 * form, but a defensive check regardless) and exact duplicate
 * (type, date) pairs are dropped before anything else runs.
 *
 * **Authorization is checked for every target before anything is
 * written** -- a crafted POST naming one allowed type and one the
 * account has no access to is rejected outright, not partially
 * honored; this is a real access boundary (same reasoning the
 * original single-target version already had), and "insert what you
 * can, skip the rest" would be the wrong default for an authorization
 * failure specifically. Once every target is confirmed authorized, each
 * one resolves/creates its own meeting and gets its own `agenda_items`
 * row independently (`Promise.all` -- different (date, type) pairs
 * can never collide with each other under migration 107's own unique
 * constraint, so there's no shared-resource race to serialize against).
 * A failure at THIS stage (a meeting that couldn't be created, a
 * one-off insert error) is reported as a partial success instead of
 * discarding everything that did go through -- unlike the
 * authorization check above, a per-target write failure here is
 * independent of every other target's own result.
 *
 * Re-checks meeting-type access server-side (not just the page's own
 * filtered <select>) via the same getVisibleMeetingTypesForUser used
 * to decide which "My meetings" tiles show up -- this is a real access
 * boundary now that submission isn't open to anyone with the link, so
 * it can't rely on the UI alone to keep someone from POSTing a
 * meeting_type they have no calling-based or feature-granted access
 * to. No more separate "Bishopric bypasses this check" branch
 * (2026-10-04, granular-features pass) -- an account holding that
 * type's own planning feature is already included in this same list.
 */
export async function submitAgendaItem(formData: FormData) {
  const supabase = await createClient();
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");

  const typeInputs = formData.getAll("meeting_type").map((v) => String(v));
  const dateInputs = formData.getAll("meeting_date").map((v) => String(v));
  const description = String(formData.get("description") ?? "").trim();
  const timeNeeded = String(formData.get("time_needed") ?? "");

  if (!description) {
    redirect(`/submit/agenda-item?error=${encodeURIComponent("A description is required.")}`);
  }

  const seen = new Set<string>();
  const targets: { meetingTypeSlug: MeetingTypeSlug; dateIso: string }[] = [];
  const pairCount = Math.max(typeInputs.length, dateInputs.length);
  for (let i = 0; i < pairCount; i++) {
    const meetingTypeSlug = (typeInputs[i] ?? "").trim() as MeetingTypeSlug;
    const dateIso = (dateInputs[i] ?? "").trim();
    if (!meetingTypeSlug || !dateIso) continue;
    const key = `${meetingTypeSlug}::${dateIso}`;
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push({ meetingTypeSlug, dateIso });
  }

  if (targets.length === 0) {
    redirect(`/submit/agenda-item?error=${encodeURIComponent("At least one meeting and date is required.")}`);
  }

  const allowedTypes = await getVisibleMeetingTypesForUser(user.id, profile?.features);
  const disallowed = targets.find((t) => !allowedTypes.includes(t.meetingTypeSlug));
  if (disallowed) {
    redirect(
      `/submit/agenda-item?error=${encodeURIComponent(
        `You don't have access to submit an agenda item for ${disallowed.meetingTypeSlug.replace(/-/g, " ")}.`
      )}`
    );
  }

  const results = await Promise.all(
    targets.map(async (target) => {
      const meetingId = await getOrCreateMeetingId(target.dateIso, target.meetingTypeSlug);
      if (!meetingId) return { ok: false as const, target };

      const { error } = await supabase.from("agenda_items").insert({
        title: deriveTitle(description),
        body: description,
        submitted_by_name: profile?.display_name || user.email || "(not given)",
        submitted_by_email: profile?.email || user.email || "",
        status: "published",
        meeting_id: meetingId,
        time_needed: TIME_NEEDED_OPTIONS.includes(timeNeeded) ? timeNeeded : null,
        // Lands at the end of this meeting's own list, 2026-11-22 --
        // same reasoning as every other agenda item that gets a
        // meeting_id for the first time (see nextAgendaItemSortOrder's
        // own doc comment).
        sort_order: await nextAgendaItemSortOrder(meetingId),
      });

      return error ? { ok: false as const, target } : { ok: true as const, meetingId };
    })
  );

  const succeeded = results.filter((r) => r.ok) as { ok: true; meetingId: string }[];
  const failed = results.filter((r) => !r.ok) as { ok: false; target: { meetingTypeSlug: string; dateIso: string } }[];

  succeeded.forEach((r) => revalidatePath(`/meetings/${r.meetingId}/planning`));

  if (succeeded.length === 0) {
    redirect(`/submit/agenda-item?error=${encodeURIComponent("Could not find or create any of those meetings.")}`);
  }

  const params = new URLSearchParams({ success: String(succeeded.length) });
  if (failed.length > 0) {
    params.set(
      "warning",
      `Could not add it to: ${failed
        .map((r) => `${r.target.meetingTypeSlug.replace(/-/g, " ")} (${r.target.dateIso})`)
        .join(", ")}.`
    );
  }
  redirect(`/submit/agenda-item?${params.toString()}`);
}
