"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { getMeetingWithType, mergeFormatTemplateIntoMeeting } from "@/lib/data/meeting-elements";
import { mergeSacramentProgramTemplateIntoMeeting } from "@/lib/data/sacrament-program";

type ActionResult = { success: true } | { error: string };

/**
 * RABNM entries (recognitions/advancements/baptisms/new members) get
 * their own granular feature, `sacrament_rabnm` (2026-10-04), distinct
 * from general Sacrament Meeting planning per the user's own
 * breakdown. Re-checked here rather than only gating the UI, matching
 * the enforcement-boundary pattern used by every other feature-gated
 * action in this app (e.g. app/admin/[table]/actions.ts).
 */
async function requireRabnmFeature(): Promise<ActionResult | null> {
  const { profile } = await getSessionUser();
  if (!hasFeature(profile, "sacrament_rabnm")) return { error: "Not authorized." };
  return null;
}

/** `savePlanningInfo` below had no server-side check at all before
 *  this -- an incidental gap found while re-gating this file for the
 *  new feature system, fixed alongside it. */
async function requireSacramentPlanning(): Promise<ActionResult | null> {
  const { profile } = await getSessionUser();
  if (!hasFeature(profile, "sacrament_planning")) return { error: "Not authorized." };
  return null;
}

/**
 * Only writes the columns actually submitted. Ward Business, Stake
 * Business, and Recognitions moved to the agenda grid (2026-09-09) and
 * the "Meeting Info" section itself was deleted the same day (the
 * user's own request) -- Special Format is now the only thing this
 * still saves, from its own small control at the top of the planning
 * page. Kept accepting the other columns too rather than trimming the
 * allowlist down to just special_format -- harmless (a form that
 * doesn't render a field submits nothing for it, so they're never
 * actually touched from here), and one less place to update if Hidden
 * Notes or similar ever needs a home again.
 *
 * **Picking a Format now actually does something, 2026-10-27** -- the
 * user's own question, after realizing meetings mostly auto-generate
 * now rather than being created through the one place Format used to
 * matter: "If they don't change the format to Primary Program format
 * if selected... then what do they do?" Before this, saving a new
 * Format just upserted the label with no further effect on the
 * meeting at all. Now, whenever `special_format` is actually submitted
 * (this form's only field), it also safely merges that format's own
 * template -- both the core agenda elements and, for Sacrament
 * Meeting, the Speakers & Music list -- into this meeting, adding
 * whatever's missing without ever touching or removing anything
 * already there (confirmed directly with the user: additive, not
 * destructive). See `mergeFormatTemplateIntoMeeting`/
 * `mergeSacramentProgramTemplateIntoMeeting` for the full story.
 */
export async function savePlanningInfo(meetingId: string, formData: FormData): Promise<ActionResult> {
  const denied = await requireSacramentPlanning();
  if (denied) return denied;

  const supabase = await createClient();

  const payload: Record<string, unknown> = {
    meeting_id: meetingId,
    updated_at: new Date().toISOString(),
  };
  for (const column of ["special_format", "ward_business", "stake_business", "recognitions", "hidden_notes"]) {
    if (!formData.has(column)) continue;
    const value = String(formData.get(column) ?? "").trim();
    payload[column] = column === "special_format" ? value || "standard" : value || null;
  }

  const { error } = await supabase.from("sacrament_planning").upsert(payload, { onConflict: "meeting_id" });

  if (error) {
    return { error: error.message };
  }

  if (formData.has("special_format")) {
    const formatKey = String(payload.special_format ?? "standard");
    const meetingWithType = await getMeetingWithType(meetingId);
    if (meetingWithType) {
      await mergeFormatTemplateIntoMeeting(meetingId, meetingWithType.meetingTypeId, formatKey);
      await mergeSacramentProgramTemplateIntoMeeting(meetingId, formatKey);
    }
  }

  revalidatePath(`/meetings/${meetingId}/planning`);
  revalidatePath(`/meetings/${meetingId}/template`);
  return { success: true };
}

/**
 * Only ever reached today for a row predating the 2026-10-03 Ward
 * Business rework (see WardBusinessField.tsx's own top comment) --
 * everything added since comes through
 * app/meetings/[id]/ward-business-actions.ts's
 * pullCallingPlanningIntoMeeting/removeCallingPlanningFromMeeting
 * instead, which also reverses the originating Calling Planning row.
 * Kept so an old manually-added item (a baby blessing, a presidency
 * change entered the old way, etc.) stays removable from here rather
 * than needing Table Admin's raw grid for that one case.
 */
export async function deleteRabnmItem(rabnmId: string, meetingId: string): Promise<ActionResult> {
  const denied = await requireRabnmFeature();
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase.from("sacrament_rabnm").delete().eq("id", rabnmId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/meetings/${meetingId}/planning`);
  return { success: true };
}

