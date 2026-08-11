"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { success: true } | { error: string };

export async function updateCallingPlanning(
  planningId: string,
  callingId: string,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("calling_planning")
    .update({
      calling_status: String(formData.get("calling_status") ?? "discussing"),
      selected_person_id: String(formData.get("selected_person_id") ?? "") || null,
      date_set_apart: String(formData.get("date_set_apart") ?? "") || null,
      release_person_id: String(formData.get("release_person_id") ?? "") || null,
      release_status: String(formData.get("release_status") ?? "previously_vacant"),
      notes: String(formData.get("notes") ?? "").trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", planningId);

  if (error) return { error: error.message };
  revalidatePath(`/callings/${callingId}`);
  return { success: true };
}

export async function addSuggestion(
  planningId: string,
  callingId: string,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();

  const personId = String(formData.get("person_id") ?? "");
  if (!personId) return { error: "Choose a person." };

  const { error } = await supabase.from("calling_planning_suggestions").insert({
    calling_planning_id: planningId,
    person_id: personId,
    note: String(formData.get("note") ?? "").trim() || null,
  });

  if (error) return { error: error.message };
  revalidatePath(`/callings/${callingId}`);
  return { success: true };
}

export async function removeSuggestion(suggestionId: string, callingId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("calling_planning_suggestions").delete().eq("id", suggestionId);

  if (error) return { error: error.message };
  revalidatePath(`/callings/${callingId}`);
  return { success: true };
}

/**
 * The integration point with Sacrament Meeting: creates the matching
 * RABNM row(s) -- Release and/or New Calling -- on the chosen meeting,
 * which is the same table Planning and Conducting views already read
 * from. Records announced_meeting_id so this can't be double-pushed.
 */
export async function pushToSacramentMeeting(
  planningId: string,
  callingId: string,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();

  const meetingId = String(formData.get("meeting_id") ?? "");
  if (!meetingId) return { error: "Choose a meeting." };

  const { data: planning, error: fetchError } = await supabase
    .from("calling_planning")
    .select("calling_status, selected_person_id, release_person_id, release_status")
    .eq("id", planningId)
    .single();

  if (fetchError || !planning) {
    return { error: fetchError?.message ?? "Could not load this planning record." };
  }

  const inserts: { type: string; person_id: string }[] = [];
  const statusUpdates: Record<string, string> = {};

  if (planning.calling_status === "to_announce" && planning.selected_person_id) {
    inserts.push({ type: "new_calling", person_id: planning.selected_person_id });
    statusUpdates.calling_status = "to_be_set_apart";
  }
  if (planning.release_status === "to_announce" && planning.release_person_id) {
    inserts.push({ type: "release", person_id: planning.release_person_id });
    statusUpdates.release_status = "to_record";
  }

  if (inserts.length === 0) {
    return { error: "Nothing is marked \"To Announce in Sacrament\" yet." };
  }

  for (const item of inserts) {
    const { data: rabnm, error: rabnmError } = await supabase
      .from("sacrament_rabnm")
      .insert({ meeting_id: meetingId, type: item.type, calling_id: callingId })
      .select("id")
      .single();

    if (rabnmError || !rabnm) {
      return { error: rabnmError?.message ?? "Could not create the announcement." };
    }

    const { error: peopleError } = await supabase
      .from("sacrament_rabnm_people")
      .insert({ rabnm_id: rabnm.id, person_id: item.person_id });

    if (peopleError) return { error: peopleError.message };
  }

  const { error: updateError } = await supabase
    .from("calling_planning")
    .update({ announced_meeting_id: meetingId, ...statusUpdates, updated_at: new Date().toISOString() })
    .eq("id", planningId);

  if (updateError) return { error: updateError.message };

  revalidatePath(`/callings/${callingId}`);
  revalidatePath(`/meetings/${meetingId}/planning`);
  return { success: true };
}
