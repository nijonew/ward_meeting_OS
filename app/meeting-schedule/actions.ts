"use server";

import { revalidatePath } from "next/cache";
import {
  addScheduleRule as addRule,
  deleteScheduleRule as deleteRule,
  toggleScheduleRuleActive as toggleRule,
  generateMeetingsFromRules,
} from "@/lib/data/meeting-schedule";

type ActionResult = { success: true } | { error: string };

export async function addScheduleRule(formData: FormData): Promise<ActionResult> {
  const result = await addRule(formData);
  if ("success" in result) revalidatePath("/meeting-schedule");
  return result;
}

export async function deleteScheduleRule(id: string): Promise<ActionResult> {
  const result = await deleteRule(id);
  if ("success" in result) revalidatePath("/meeting-schedule");
  return result;
}

export async function toggleScheduleRuleActive(id: string, active: boolean): Promise<ActionResult> {
  const result = await toggleRule(id, active);
  if ("success" in result) revalidatePath("/meeting-schedule");
  return result;
}

export async function generateMeetings(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string; created?: number; skippedExisting?: number }> {
  const throughDate = String(formData.get("through_date") ?? "");
  if (!throughDate) return { error: "Choose an end date." };

  const result = await generateMeetingsFromRules(throughDate);
  if ("error" in result) return { error: result.error };

  revalidatePath("/dashboard");
  revalidatePath("/meeting-schedule");
  return { created: result.created, skippedExisting: result.skippedExisting };
}