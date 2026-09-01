"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { success: true } | { error: string };

/**
 * Saves a single person-role element (presiding, conducting, prayers,
 * chorister, organist, pianist, etc.) for one meeting. `table` decides
 * where it's written: sacrament meetings use sacrament_assignments
 * (which needs `confirmed` -- the public view filters on it); every other
 * meeting type reuses bishopric_assignments.
 */
export async function saveElementPersonRole(
  meetingId: string,
  elementKey: string,
  table: "sacrament_assignments" | "bishopric_assignments",
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();

  const assignedToId = String(formData.get("assigned_to_id") ?? "") || null;

  const { error: deleteError } = await supabase
    .from(table)
    .delete()
    .eq("meeting_id", meetingId)
    .eq("role", elementKey);
  if (deleteError) return { error: deleteError.message };

  if (assignedToId) {
    const row: Record<string, unknown> = {
      meeting_id: meetingId,
      role: elementKey,
      assigned_to_id: assignedToId,
    };
    if (table === "sacrament_assignments") {
      row.confirmed = formData.get("confirmed") === "on";
    }

    const { error: insertError } = await supabase.from(table).insert(row);
    if (insertError) return { error: insertError.message };
  }

  revalidatePath(`/meetings/${meetingId}/planning`);
  return { success: true };
}

/**
 * Saves a free_text or person_and_text element into the generic
 * meeting_element_notes table (migration 015).
 */
export async function saveElementNote(
  meetingId: string,
  elementKey: string,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();

  const personId = String(formData.get("person_id") ?? "") || null;
  const textValue = String(formData.get("text_value") ?? "").trim() || null;

  const { error } = await supabase.from("meeting_element_notes").upsert(
    {
      meeting_id: meetingId,
      element_key: elementKey,
      person_id: personId,
      text_value: textValue,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "meeting_id,element_key" }
  );

  if (error) return { error: error.message };

  revalidatePath(`/meetings/${meetingId}/planning`);
  return { success: true };
}