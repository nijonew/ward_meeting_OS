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
 * Pulls one announcement into one specific block of this meeting --
 * sets its existing `meeting_id` (migration 031), which
 * `getPublishedAnnouncements`/`getGeneralSubmissions`
 * (lib/data/general-submissions.ts) already treat as "spoken for,"
 * excluding it from the general public page and admin inbox the
 * moment this runs, plus `planned_element_id` (migration 074, since a
 * meeting can now have more than one Announcements block -- see that
 * migration's own header for the full writeup) saying which block.
 * Refuses to steal one already pulled into a different block (or
 * meeting) instead of silently overwriting -- `getPullableAnnouncements`
 * shouldn't offer one that's already taken, but this re-checks
 * server-side anyway, same defense-in-depth convention as every other
 * action in this app.
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
    .from("announcements")
    .update({ meeting_id: meetingId, planned_element_id: plannedElementId })
    .eq("id", announcementId)
    .is("meeting_id", null);

  if (error) return { error: error.message };

  revalidateBoth(meetingId);
  return { success: true };
}

/** Reverses pullAnnouncementIntoMeeting -- clears both `meeting_id`
 *  and `planned_element_id`, putting it back in the general pool
 *  (visible on the public page and admin inbox again) rather than
 *  deleting it. Scoped by meetingId alone, not which block -- removing
 *  by announcement id is unambiguous regardless of which of a
 *  meeting's blocks it came from. */
export async function removeAnnouncementFromMeeting(meetingId: string, announcementId: string): Promise<ActionResult> {
  const denied = await requireSacramentPlanningFeature();
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase
    .from("announcements")
    .update({ meeting_id: null, planned_element_id: null })
    .eq("id", announcementId)
    .eq("meeting_id", meetingId);

  if (error) return { error: error.message };

  revalidateBoth(meetingId);
  return { success: true };
}
