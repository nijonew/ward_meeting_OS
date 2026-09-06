"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateCombinedYouthActivities } from "@/lib/data/youth-activity-schedule";

export type ActionResult = { success: true } | { error: string };

export async function addYouthActivity(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const activity_date = formData.get("activity_date") as string;
  const activity_time = (formData.get("activity_time") as string) || null;
  const title = formData.get("title") as string;
  const group_name = formData.get("group_name") as string;
  const location = (formData.get("location") as string) || null;
  const development_category = (formData.get("development_category") as string) || null;
  const youth_lead = (formData.get("youth_lead") as string) || null;
  const advisor_lead = (formData.get("advisor_lead") as string) || null;
  const notes = (formData.get("notes") as string) || null;

  if (!activity_date || !title || !group_name) {
    return { error: "Date, title, and group are required." };
  }

  const { error } = await supabase.from("youth_activities").insert({
    activity_date,
    activity_time,
    title,
    group_name,
    location,
    development_category,
    youth_lead,
    advisor_lead,
    notes,
    status: "published",
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/youth-activities");
  return { success: true };
}

export async function setYouthActivityStatus(
  id: string,
  status: "draft" | "published"
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("youth_activities").update({ status }).eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/youth-activities");
  return { success: true };
}

export async function deleteYouthActivity(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("youth_activities").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/youth-activities");
  return { success: true };
}

/** Tentative -> confirmed, or back. Independent of `status`
 *  (draft/published visibility) -- see PROJECT_CONTEXT.md. */
export async function toggleYouthActivityConfirmed(id: string, confirmed: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("youth_activities").update({ confirmed }).eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/youth-activities");
  revalidatePath("/events");
  return { success: true };
}

/** Marks a week cancelled (with an optional note) or un-cancels it.
 *  Cancelled weeks stay visible everywhere -- shown with the note
 *  instead of disappearing, per the workflow's "much like other
 *  meetings, show a cancelled week with a note" requirement. */
export async function setYouthActivityCancellation(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("cancellation_note") ?? "").trim() || null;
  if (!id) return { error: "Missing activity id." };

  const { error } = await supabase
    .from("youth_activities")
    .update({ cancelled: true, cancellation_note: note })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/youth-activities");
  revalidatePath("/events");
  return { success: true };
}

export async function uncancelYouthActivity(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("youth_activities")
    .update({ cancelled: false, cancellation_note: null })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/youth-activities");
  revalidatePath("/events");
  return { success: true };
}

export async function generateYouthActivities(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string; created?: number; skippedExisting?: number }> {
  const throughDate = String(formData.get("through_date") ?? "");
  if (!throughDate) return { error: "Choose an end date." };

  const result = await generateCombinedYouthActivities(throughDate);
  if ("error" in result) return { error: result.error };

  revalidatePath("/youth-activities");
  revalidatePath("/events");
  return { created: result.created, skippedExisting: result.skippedExisting };
}