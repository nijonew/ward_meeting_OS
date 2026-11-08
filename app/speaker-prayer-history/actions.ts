"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import type { DueCategory } from "@/lib/data/speaker-prayer-history";

type ActionResult = { success: true } | { error: string };

async function requireSpeakerPrayerHistoryFeature(): Promise<{ error: string } | null> {
  const { profile } = await getSessionUser();
  if (!hasFeature(profile, "speaker_prayer_history")) return { error: "Not authorized." };
  return null;
}

/**
 * Split across four real routes now (the hub + one page per category,
 * 2026-11-08) -- a plain single `revalidatePath("/speaker-prayer-history")`
 * no longer reaches the three sub-pages where every write below
 * actually shows up, since they're separate route segments, not the
 * same page under a shared layout. Revalidating all four explicitly is
 * simpler and more certain than relying on Next's own `"layout"` option
 * correctly cascading across sibling routes with no shared layout file
 * to anchor it.
 */
function revalidateSpeakerPrayerHistoryPaths() {
  revalidatePath("/speaker-prayer-history");
  revalidatePath("/speaker-prayer-history/adults");
  revalidatePath("/speaker-prayer-history/youth");
  revalidatePath("/speaker-prayer-history/prayers");
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
  revalidateSpeakerPrayerHistoryPaths();
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
  revalidateSpeakerPrayerHistoryPaths();
  return { success: true };
}

/**
 * Toggles one person's "Due" checkbox for one category (migration 097,
 * 2026-11-01) -- checking adds a row, unchecking removes it. `upsert`
 * with `ignoreDuplicates` rather than a plain insert, since clicking
 * the same checkbox in two places (their row in the main history list,
 * and the "Due" box itself) in quick succession shouldn't be able to
 * violate the table's own `unique (person_id, category)` constraint.
 */
export async function toggleDueFlag(personId: string, category: DueCategory, due: boolean): Promise<ActionResult> {
  const denied = await requireSpeakerPrayerHistoryFeature();
  if (denied) return denied;
  if (!personId) return { error: "Missing person." };

  const supabase = await createClient();
  if (due) {
    const { error } = await supabase
      .from("speaker_prayer_due_list")
      .upsert({ person_id: personId, category }, { onConflict: "person_id,category", ignoreDuplicates: true });
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("speaker_prayer_due_list")
      .delete()
      .eq("person_id", personId)
      .eq("category", category);
    if (error) return { error: error.message };
  }

  revalidateSpeakerPrayerHistoryPaths();
  return { success: true };
}
