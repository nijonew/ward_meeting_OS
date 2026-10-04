"use server";

import { revalidatePath } from "next/cache";
import {
  addScheduleRule as addRule,
  updateScheduleRule as updateRule,
  deleteScheduleRule as deleteRule,
  toggleScheduleRuleActive as toggleRule,
  generateMeetingsFromRules,
} from "@/lib/data/meeting-schedule";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";

type ActionResult = { success: true } | { error: string };

// None of these had a server-side check at all before this (2026-10-04,
// found while converting the page's own gate to the granular-features
// model) -- only the page's own gate kept the controls out of a
// non-admin's view.
async function requireMeetingScheduleFeature(): Promise<{ error: string } | null> {
  const { profile } = await getSessionUser();
  if (!hasFeature(profile, "meeting_schedule")) return { error: "Not authorized." };
  return null;
}

export async function addScheduleRule(formData: FormData): Promise<ActionResult> {
  const denied = await requireMeetingScheduleFeature();
  if (denied) return denied;
  const result = await addRule(formData);
  if ("success" in result) revalidatePath("/meeting-schedule");
  return result;
}

export async function updateScheduleRule(id: string, formData: FormData): Promise<ActionResult> {
  const denied = await requireMeetingScheduleFeature();
  if (denied) return denied;
  const result = await updateRule(id, formData);
  if ("success" in result) revalidatePath("/meeting-schedule");
  return result;
}

export async function deleteScheduleRule(id: string): Promise<ActionResult> {
  const denied = await requireMeetingScheduleFeature();
  if (denied) return denied;
  const result = await deleteRule(id);
  if ("success" in result) revalidatePath("/meeting-schedule");
  return result;
}

export async function toggleScheduleRuleActive(id: string, active: boolean): Promise<ActionResult> {
  const denied = await requireMeetingScheduleFeature();
  if (denied) return denied;
  const result = await toggleRule(id, active);
  if ("success" in result) revalidatePath("/meeting-schedule");
  return result;
}

export async function generateMeetings(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string; created?: number; skippedExisting?: number }> {
  const denied = await requireMeetingScheduleFeature();
  if (denied) return denied;

  const throughDate = String(formData.get("through_date") ?? "");
  if (!throughDate) return { error: "Choose an end date." };

  const result = await generateMeetingsFromRules(throughDate);
  if ("error" in result) return { error: result.error };

  revalidatePath("/dashboard");
  revalidatePath("/meeting-schedule");
  return { created: result.created, skippedExisting: result.skippedExisting };
}
