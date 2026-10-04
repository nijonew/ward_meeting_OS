"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";

type ActionResult = { success: true } | { error: string };

/**
 * RABNM entries (recognitions/advancements/baptisms/new members) are
 * restricted to the Bishopric role -- ward clerk and executive secretary
 * are folded into that shared role today (see PROJECT_CONTEXT.md), so
 * this is the closest available scoping. Re-checked here rather than
 * only gating the UI, matching the enforcement-boundary pattern used by
 * every other role-gated action in this app (e.g.
 * app/admin/[table]/actions.ts). Nothing else in this file is
 * role-gated -- this restriction is specific to RABNM per the user's
 * decision, not a change to who can edit the rest of Sacrament Meeting
 * planning.
 */
async function requireBishopric(): Promise<ActionResult | null> {
  const { profile } = await getSessionUser();
  if (!hasFeature(profile, "bishopric")) return { error: "Not authorized." };
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
 */
export async function savePlanningInfo(meetingId: string, formData: FormData): Promise<ActionResult> {
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

  revalidatePath(`/meetings/${meetingId}/planning`);
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
  const denied = await requireBishopric();
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase.from("sacrament_rabnm").delete().eq("id", rabnmId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/meetings/${meetingId}/planning`);
  return { success: true };
}

