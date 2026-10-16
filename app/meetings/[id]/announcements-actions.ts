"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";

type ActionResult = { success: true } | { error: string };

// Gated on sacrament_planning (the same feature that already gates
// saveAgendaGrid for Sacrament Meeting) rather than a dedicated
// feature of its own -- this is one more piece of the same agenda,
// not a standalone tool.
async function requireSacramentPlanningFeature(): Promise<ActionResult | null> {
  const { profile } = await getSessionUser();
  if (!hasFeature(profile, "sacrament_planning")) return { error: "Not authorized." };
  return null;
}

function revalidateBoth(meetingId: string) {
  revalidatePath(`/meetings/${meetingId}/planning`);
  revalidatePath(`/meetings/${meetingId}/conducting`);
  revalidatePath("/announcements");
  revalidatePath("/announcements/public");
}

/**
 * Pulls one announcement into one specific block of one meeting --
 * inserts a row into `sacrament_announcement_pulls` (migration 077,
 * 2026-10-15) rather than setting a single `meeting_id` column
 * directly on `announcements` (the original design, migration 031/074)
 * -- see that migration's own header for why: the old single-column
 * link meant an announcement could only ever be pulled into one
 * meeting, period, which blocked genuinely recurring announcements
 * from ever being re-used once their first meeting passed. The same
 * announcement can now be pulled into any number of meetings at once.
 *
 * `getPullableAnnouncements` already excludes anything already pulled
 * into THIS meeting, so a unique-constraint violation here (the
 * `(announcement_id, meeting_id)` constraint on the new table) should
 * only ever mean a genuine race -- two admins adding the same
 * announcement to the same meeting at once -- surfaced as a real
 * error rather than silently ignored.
 */
export async function pullAnnouncementIntoMeeting(
  meetingId: string,
  announcementId: string,
  plannedElementId: string
): Promise<ActionResult> {
  const denied = await requireSacramentPlanningFeature();
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase
    .from("sacrament_announcement_pulls")
    .insert({ announcement_id: announcementId, meeting_id: meetingId, planned_element_id: plannedElementId });

  if (error) {
    if (error.code === "23505") return { error: "That announcement is already in this meeting." };
    return { error: error.message };
  }

  revalidateBoth(meetingId);
  return { success: true };
}

/** Reverses pullAnnouncementIntoMeeting -- removes only this meeting's
 *  own pull of this announcement; any other meeting it's also been
 *  pulled into (2026-10-15) is completely untouched. Scoped by
 *  meetingId + announcementId together, not which block -- removing by
 *  announcement id is unambiguous regardless of which of a meeting's
 *  blocks it came from (the `unique (announcement_id, meeting_id)`
 *  constraint on `sacrament_announcement_pulls` guarantees at most one
 *  matching row). */
export async function removeAnnouncementFromMeeting(meetingId: string, announcementId: string): Promise<ActionResult> {
  const denied = await requireSacramentPlanningFeature();
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase
    .from("sacrament_announcement_pulls")
    .delete()
    .eq("meeting_id", meetingId)
    .eq("announcement_id", announcementId);

  if (error) return { error: error.message };

  revalidateBoth(meetingId);
  return { success: true };
}
