"use server";

import { revalidatePath } from "next/cache";
import {
  addYouthActivityCancellation,
  deleteYouthActivityCancellation,
} from "@/lib/data/youth-activity-cancellations";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";

type ActionResult = { success: true } | { error: string };

async function requireYouthActivityPlanningFeature(): Promise<ActionResult | null> {
  const { profile } = await getSessionUser();
  if (!hasFeature(profile, "youth_activity_planning")) return { error: "Not authorized." };
  return null;
}

export async function addYouthActivityCancellationAction(formData: FormData): Promise<ActionResult> {
  const denied = await requireYouthActivityPlanningFeature();
  if (denied) return denied;
  const result = await addYouthActivityCancellation(formData);
  if ("success" in result) {
    revalidatePath("/youth-activity-cancellations");
    revalidatePath("/youth-activities");
    revalidatePath("/events");
  }
  return result;
}

export async function deleteYouthActivityCancellationAction(id: string): Promise<ActionResult> {
  const denied = await requireYouthActivityPlanningFeature();
  if (denied) return denied;
  const result = await deleteYouthActivityCancellation(id);
  if ("success" in result) revalidatePath("/youth-activity-cancellations");
  return result;
}
