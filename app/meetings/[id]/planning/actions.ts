"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/get-session-user";

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
  if (profile?.role !== "bishopric") return { error: "Not authorized." };
  return null;
}

/**
 * Only writes the columns actually submitted. Ward Business, Stake
 * Business, and Recognitions moved to the agenda grid (2026-09-09) and
 * are no longer on the Meeting Info form -- writing them unconditionally
 * from here would blank out whatever the grid just saved, since a form
 * that doesn't render a field submits nothing for it.
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

export async function addRabnmItem(meetingId: string, formData: FormData): Promise<ActionResult> {
  const denied = await requireBishopric();
  if (denied) return denied;

  const supabase = await createClient();

  const type = String(formData.get("type") ?? "");
  const callingId = String(formData.get("calling_id") ?? "");
  const detail = String(formData.get("detail") ?? "").trim();
  const eventDate = String(formData.get("event_date") ?? "");
  const personIds = formData
    .getAll("person_ids")
    .map(String)
    .filter(Boolean);

  if (!type) {
    return { error: "Choose a type." };
  }

  const { data: rabnm, error } = await supabase
    .from("sacrament_rabnm")
    .insert({
      meeting_id: meetingId,
      type,
      calling_id: callingId || null,
      detail: detail || null,
      event_date: eventDate || null,
    })
    .select("id")
    .single();

  if (error || !rabnm) {
    return { error: error?.message ?? "Could not save." };
  }

  if (personIds.length > 0) {
    const { error: peopleError } = await supabase
      .from("sacrament_rabnm_people")
      .insert(personIds.map((personId) => ({ rabnm_id: rabnm.id, person_id: personId })));

    if (peopleError) {
      return { error: peopleError.message };
    }
  }

  revalidatePath(`/meetings/${meetingId}/planning`);
  return { success: true };
}

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

