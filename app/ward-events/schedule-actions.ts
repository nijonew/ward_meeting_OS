"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser, hasFeature, type Feature } from "@/lib/supabase/get-session-user";
import {
  addWardEventScheduleRule as addRule,
  updateWardEventScheduleRule as updateRule,
  deleteWardEventScheduleRule as deleteRule,
  toggleWardEventScheduleRuleActive as toggleRule,
  generateWardEventsFromRules,
} from "@/lib/data/ward-event-schedule";

type ActionResult = { success: true } | { error: string };

// Matches app/ward-events/page.tsx's MANAGE_FEATURES exactly -- whoever
// can add a one-off event can also set up its recurring cadence.
const MANAGE_FEATURES: Feature[] = ["bishopric", "communications_specialist"];

async function requireManageRole(): Promise<{ error: string } | null> {
  const { profile } = await getSessionUser();
  if (!MANAGE_FEATURES.some((f) => hasFeature(profile, f))) return { error: "Not authorized." };
  return null;
}

export async function addScheduleRule(formData: FormData): Promise<ActionResult> {
  const denied = await requireManageRole();
  if (denied) return denied;
  const result = await addRule(formData);
  if ("success" in result) revalidatePath("/ward-events");
  return result;
}

export async function updateScheduleRule(id: string, formData: FormData): Promise<ActionResult> {
  const denied = await requireManageRole();
  if (denied) return denied;
  const result = await updateRule(id, formData);
  if ("success" in result) revalidatePath("/ward-events");
  return result;
}

export async function deleteScheduleRule(id: string): Promise<ActionResult> {
  const denied = await requireManageRole();
  if (denied) return denied;
  const result = await deleteRule(id);
  if ("success" in result) revalidatePath("/ward-events");
  return result;
}

export async function toggleScheduleRuleActive(id: string, active: boolean): Promise<ActionResult> {
  const denied = await requireManageRole();
  if (denied) return denied;
  const result = await toggleRule(id, active);
  if ("success" in result) revalidatePath("/ward-events");
  return result;
}

export async function generateEvents(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string; created?: number; skippedExisting?: number }> {
  const denied = await requireManageRole();
  if (denied) return { error: denied.error };

  const throughDate = String(formData.get("through_date") ?? "");
  if (!throughDate) return { error: "Choose an end date." };

  const result = await generateWardEventsFromRules(throughDate);
  if ("error" in result) return { error: result.error };

  revalidatePath("/ward-events");
  revalidatePath("/events");
  return { created: result.created, skippedExisting: result.skippedExisting };
}
