"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import {
  addYouthActivityScheduleRule as addRule,
  updateYouthActivityScheduleRule as updateRule,
  deleteYouthActivityScheduleRule as deleteRule,
  toggleYouthActivityScheduleRuleActive as toggleRule,
  generateYouthActivitiesFromRules,
} from "@/lib/data/youth-activity-cadence-rules";

type ActionResult = { success: true } | { error: string };

// Matches app/youth-activities/page.tsx's own gate exactly -- whoever
// can add a one-off activity can also set up its recurring cadence.
async function requireManageRole(): Promise<{ error: string } | null> {
  const { profile } = await getSessionUser();
  if (!hasFeature(profile, "youth_activity_planning")) return { error: "Not authorized." };
  return null;
}

export async function addScheduleRule(formData: FormData): Promise<ActionResult> {
  const denied = await requireManageRole();
  if (denied) return denied;
  const result = await addRule(formData);
  if ("success" in result) revalidatePath("/youth-activities");
  return result;
}

export async function updateScheduleRule(id: string, formData: FormData): Promise<ActionResult> {
  const denied = await requireManageRole();
  if (denied) return denied;
  const result = await updateRule(id, formData);
  if ("success" in result) revalidatePath("/youth-activities");
  return result;
}

export async function deleteScheduleRule(id: string): Promise<ActionResult> {
  const denied = await requireManageRole();
  if (denied) return denied;
  const result = await deleteRule(id);
  if ("success" in result) revalidatePath("/youth-activities");
  return result;
}

export async function toggleScheduleRuleActive(id: string, active: boolean): Promise<ActionResult> {
  const denied = await requireManageRole();
  if (denied) return denied;
  const result = await toggleRule(id, active);
  if ("success" in result) revalidatePath("/youth-activities");
  return result;
}

export async function generateActivities(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string; created?: number; skippedExisting?: number }> {
  const denied = await requireManageRole();
  if (denied) return { error: denied.error };

  const throughDate = String(formData.get("through_date") ?? "");
  if (!throughDate) return { error: "Choose an end date." };

  const result = await generateYouthActivitiesFromRules(throughDate);
  if ("error" in result) return { error: result.error };

  revalidatePath("/youth-activities");
  revalidatePath("/events");
  return { created: result.created, skippedExisting: result.skippedExisting };
}
