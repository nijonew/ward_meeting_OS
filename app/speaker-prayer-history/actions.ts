"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";

type ActionResult = { success: true } | { error: string };

async function requireSpeakerPrayerHistoryFeature(): Promise<{ error: string } | null> {
  const { profile } = await getSessionUser();
  if (!hasFeature(profile, "speaker_prayer_history")) return { error: "Not authorized." };
  return null;
}

/**
 * The ongoing way to log a missed or pre-app speaker/prayer turn
 * directly on /speaker-prayer-history, without needing Table Admin --
 * writes to speaker_prayer_history_import (migration 079, 2026-10-21)
 * with source = 'manual', same table the one-time historical import
 * populated with source = 'historical_import'.
 */
export async function addSpeakerPrayerHistoryEntry(_prevState: unknown, formData: FormData): Promise<ActionResult> {
  const denied = await requireSpeakerPrayerHistoryFeature();
  if (denied) return denied;

  const personId = String(formData.get("person_id") ?? "");
  const role = String(formData.get("role") ?? "");
  const occurredOn = String(formData.get("occurred_on") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  if (!personId) return { error: "Choose a person." };
  if (role !== "speaker" && role !== "prayer") return { error: "Choose a role." };
  if (!occurredOn) return { error: "Choose a date." };

  const supabase = await createClient();
  const { error } = await supabase.from("speaker_prayer_history_import").insert({
    person_id: personId,
    role,
    occurred_on: occurredOn,
    notes: notes || null,
    source: "manual",
  });

  if (error) return { error: error.message };
  revalidatePath("/speaker-prayer-history");
  return { success: true };
}

/**
 * Removes one speaker_prayer_history_import row -- an archived-meeting-
 * sourced entry has no equivalent control, since it's owned by that
 * meeting, not this table.
 */
export async function deleteSpeakerPrayerHistoryEntry(entryId: string): Promise<ActionResult> {
  const denied = await requireSpeakerPrayerHistoryFeature();
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase.from("speaker_prayer_history_import").delete().eq("id", entryId);
  if (error) return { error: error.message };
  revalidatePath("/speaker-prayer-history");
  return { success: true };
}
