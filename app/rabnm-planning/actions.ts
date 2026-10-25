"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { RABNM_PLANNING_TYPES } from "@/lib/data/sacrament-constants";

type ActionResult = { success: true } | { error: string };

const VALID_TYPES = new Set<string>(RABNM_PLANNING_TYPES.map((t) => t.value));

async function requireRabnmFeature(): Promise<ActionResult | null> {
  const { profile } = await getSessionUser();
  if (!hasFeature(profile, "sacrament_rabnm")) return { error: "Not authorized." };
  return null;
}

function revalidateAll() {
  revalidatePath("/rabnm-planning");
}

/**
 * Adds one row to the standing RABNM planning pool (migration 082) --
 * the simple add-a-row half of this page, matching Teaching Program's
 * own "add a row, nothing to save separately" simplicity rather than
 * the grid's dirty-tracking/Save-All-Changes pattern. `type` comes from
 * the category section the form was submitted from, not a dropdown on
 * the form itself -- each of the 5 sections on /rabnm-planning adds
 * directly into its own category.
 */
export async function addRabnmPlanningItem(formData: FormData): Promise<ActionResult> {
  const denied = await requireRabnmFeature();
  if (denied) return denied;

  const type = String(formData.get("type") ?? "");
  if (!VALID_TYPES.has(type)) return { error: "Unknown category." };

  const detail = String(formData.get("detail") ?? "").trim() || null;
  const eventDate = String(formData.get("event_date") ?? "").trim() || null;
  const personIds = formData.getAll("person_ids").map(String).filter(Boolean);

  const supabase = await createClient();
  const { data: row, error: insertError } = await supabase
    .from("sacrament_rabnm_planning")
    .insert({ type, detail, event_date: eventDate })
    .select("id")
    .single();
  if (insertError || !row) return { error: insertError?.message ?? "Could not add this item." };

  if (personIds.length > 0) {
    const { error: peopleError } = await supabase
      .from("sacrament_rabnm_planning_people")
      .insert(personIds.map((personId) => ({ rabnm_planning_id: row.id, person_id: personId })));
    if (peopleError) return { error: peopleError.message };
  }

  revalidateAll();
  return { success: true };
}

/**
 * Removes a not-yet-announced pool row outright -- `sacrament_rabnm_planning_people`
 * cleans up via its own `on delete cascade`. Only reachable for a row
 * this page is still showing (announced_meeting_id is null); a row
 * already pulled into a meeting is removed from Ward Business instead
 * (removeRabnmPlanningFromMeeting), which is what puts it back here.
 */
export async function removeRabnmPlanningItem(id: string): Promise<ActionResult> {
  const denied = await requireRabnmFeature();
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase.from("sacrament_rabnm_planning").delete().eq("id", id).is("announced_meeting_id", null);
  if (error) return { error: error.message };

  revalidateAll();
  return { success: true };
}
