"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateCombinedYouthActivities } from "@/lib/data/youth-activity-schedule";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";

export type ActionResult = { success: true } | { error: string };

/** Every page that actually lists activities -- revalidated together
 *  since both actions below can add a row of any group. Moved here
 *  (2026-10-11) once Add Activity/Generate relocated to their own
 *  Manage page, which shows none of this data itself. */
function revalidateActivityListings() {
  revalidatePath("/youth-activities/upcoming");
  revalidatePath("/youth-activities/combined-ym");
  revalidatePath("/youth-activities/combined-ym-yw");
  revalidatePath("/youth-activities/combined-yw");
  revalidatePath("/events");
}

// None of these had a server-side check at all before this (2026-10-04,
// found while converting the page's own gate to the granular-features
// model) -- only the page's own gate kept the controls out of a
// non-admin's view.
async function requireYouthActivityPlanningFeature(): Promise<{ error: string } | null> {
  const { profile } = await getSessionUser();
  if (!hasFeature(profile, "youth_activity_planning")) return { error: "Not authorized." };
  return null;
}

export async function addYouthActivity(formData: FormData): Promise<ActionResult> {
  const denied = await requireYouthActivityPlanningFeature();
  if (denied) return denied;

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

  revalidateActivityListings();
  return { success: true };
}

export async function generateYouthActivities(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string; created?: number; skippedExisting?: number }> {
  const denied = await requireYouthActivityPlanningFeature();
  if (denied) return denied;

  const throughDate = String(formData.get("through_date") ?? "");
  if (!throughDate) return { error: "Choose an end date." };

  const result = await generateCombinedYouthActivities(throughDate);
  if ("error" in result) return { error: result.error };

  revalidateActivityListings();
  return { created: result.created, skippedExisting: result.skippedExisting };
}