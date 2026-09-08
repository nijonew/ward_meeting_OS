"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { success: true } | { error: string };

/**
 * "Cancel a meeting from the dashboard" (Known open items) -- same
 * shape as youth_activities.cancelled/cancellation_note (migration
 * 032): shown, not hidden, independent of the planning-progress
 * `stage` field.
 */
export async function cancelMeeting(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("cancellation_note") ?? "").trim() || null;
  if (!id) return { error: "Missing meeting id." };

  const { error } = await supabase
    .from("meetings")
    .update({ cancelled: true, cancellation_note: note })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { success: true };
}

export async function uncancelMeeting(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("meetings")
    .update({ cancelled: false, cancellation_note: null })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { success: true };
}
