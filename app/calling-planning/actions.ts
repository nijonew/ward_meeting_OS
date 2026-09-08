"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { success: true } | { error: string };
type SaveGridActionResult = { error?: string; success?: boolean };

/**
 * Starts a new calling-change row -- the flat grid's equivalent of the
 * old per-calling "Start New Planning Process" button, except it can be
 * done for any calling right from this one page instead of requiring a
 * detour through that calling's own detail page first.
 */
export async function createCallingPlanningEntry(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const callingId = String(formData.get("calling_id") ?? "");
  if (!callingId) return { error: "Choose a calling." };

  const dateInitiated = String(formData.get("date_initiated") ?? "") || null;

  const { error } = await supabase
    .from("calling_planning")
    .insert({ calling_id: callingId, date_initiated: dateInitiated });

  if (error) return { error: error.message };
  revalidatePath("/calling-planning");
  return { success: true };
}

/** Grid field names are "<planningId>::<fieldKey>" so one <form> can
 *  carry every row's every field at once, same convention as the
 *  Assignment Rotations and Teaching Calendar grids. */
function parseFieldName(name: string): { planningId: string; field: string } | null {
  const idx = name.indexOf("::");
  if (idx === -1) return null;
  return { planningId: name.slice(0, idx), field: name.slice(idx + 2) };
}

const EDITABLE_FIELDS = [
  "calling_id",
  "date_initiated",
  "calling_status",
  "date_set_apart",
  "notes",
  "release_person_id",
  "release_status",
] as const;

type RowPatch = Record<string, string | null> & { candidate_person_ids?: string[] };

/**
 * Saves every row's every field in one submit -- the "our favorite grid
 * format" pattern (2026-09-08, the user's own words) already built for
 * Assignment Rotations and Teaching Calendar: one big <form>, one "Save
 * All Changes" button, one UPDATE per row here (not the
 * delete-then-insert-per-cell approach those two use, since a calling
 * planning row already has a real id to update rather than being a
 * sparse per-cell record).
 *
 * candidate_person_ids is handled separately from every other field: a
 * <select multiple> submits one form-data entry per selected option
 * under the same name, so it needs formData.getAll(name) instead of the
 * single-value get() every other field uses -- and, since a multi-select
 * with nothing selected submits no entry at all, the grid renders a
 * hidden fallback input of the same name so "deselect everyone" is
 * still detectable as an explicit empty array rather than "field not
 * submitted, leave whatever was there."
 */
export async function saveCallingPlanningGrid(_prevState: unknown, formData: FormData): Promise<SaveGridActionResult> {
  const supabase = await createClient();

  const byRow = new Map<string, RowPatch>();
  const seenNames = new Set<string>();

  for (const [name] of formData.entries()) {
    if (seenNames.has(name)) continue;
    seenNames.add(name);

    const parsed = parseFieldName(name);
    if (!parsed) continue;

    if (parsed.field === "candidate_person_ids") {
      const patch = byRow.get(parsed.planningId) ?? {};
      patch.candidate_person_ids = formData.getAll(name).map(String).filter(Boolean);
      byRow.set(parsed.planningId, patch);
      continue;
    }

    if (!EDITABLE_FIELDS.includes(parsed.field as (typeof EDITABLE_FIELDS)[number])) continue;
    const patch = byRow.get(parsed.planningId) ?? {};
    patch[parsed.field] = String(formData.get(name)).trim() || null;
    byRow.set(parsed.planningId, patch);
  }

  for (const [planningId, patch] of byRow) {
    // calling_status/release_status/calling_id are required columns --
    // never null them out even if a <select> somehow submitted blank.
    if (!patch.calling_status) patch.calling_status = "discussing";
    if (!patch.release_status) patch.release_status = "previously_vacant";
    if (!patch.calling_id) continue; // can't save a row with no calling

    const { error } = await supabase
      .from("calling_planning")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", planningId);
    if (error) return { error: error.message };
  }

  revalidatePath("/calling-planning");
  return { success: true };
}

export async function deleteCallingPlanningEntry(planningId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("calling_planning").delete().eq("id", planningId);

  if (error) return { error: error.message };
  revalidatePath("/calling-planning");
  return { success: true };
}

/**
 * The integration point with Sacrament Meeting: creates the matching
 * RABNM row(s) -- Release and/or New Calling -- on the chosen meeting,
 * which is the same table Planning and Conducting views already read
 * from. Records announced_meeting_id so this can't be double-pushed.
 * Adapted from the old app/callings/[id]/actions.ts version -- same
 * logic, just revalidating the new flat page instead of a per-calling one.
 */
export async function pushCallingToSacramentMeeting(
  planningId: string,
  callingId: string,
  _prevState: unknown,
  formData: FormData
): Promise<SaveGridActionResult> {
  const supabase = await createClient();

  const meetingId = String(formData.get("meeting_id") ?? "");
  if (!meetingId) return { error: "Choose a meeting." };

  const { data: planning, error: fetchError } = await supabase
    .from("calling_planning")
    .select("calling_status, candidate_person_ids, release_person_id, release_status")
    .eq("id", planningId)
    .single();

  if (fetchError || !planning) {
    return { error: fetchError?.message ?? "Could not load this planning record." };
  }

  const candidateIds = (planning.candidate_person_ids ?? []) as string[];
  if (planning.calling_status === "to_announce" && candidateIds.length > 1) {
    return { error: "Narrow Candidates down to exactly one person before announcing the new calling." };
  }

  const inserts: { type: string; person_id: string }[] = [];
  const statusUpdates: Record<string, string> = {};

  if (planning.calling_status === "to_announce" && candidateIds.length === 1) {
    inserts.push({ type: "new_calling", person_id: candidateIds[0] });
    statusUpdates.calling_status = "to_be_set_apart";
  }
  if (planning.release_status === "to_announce" && planning.release_person_id) {
    inserts.push({ type: "release", person_id: planning.release_person_id });
    statusUpdates.release_status = "to_record";
  }

  if (inserts.length === 0) {
    return { error: "Nothing is marked \"To Announce in Sacrament\" yet." };
  }

  for (const item of inserts) {
    const { data: rabnm, error: rabnmError } = await supabase
      .from("sacrament_rabnm")
      .insert({ meeting_id: meetingId, type: item.type, calling_id: callingId })
      .select("id")
      .single();

    if (rabnmError || !rabnm) {
      return { error: rabnmError?.message ?? "Could not create the announcement." };
    }

    const { error: peopleError } = await supabase
      .from("sacrament_rabnm_people")
      .insert({ rabnm_id: rabnm.id, person_id: item.person_id });

    if (peopleError) return { error: peopleError.message };
  }

  const { error: updateError } = await supabase
    .from("calling_planning")
    .update({ announced_meeting_id: meetingId, ...statusUpdates, updated_at: new Date().toISOString() })
    .eq("id", planningId);

  if (updateError) return { error: updateError.message };

  revalidatePath("/calling-planning");
  revalidatePath(`/meetings/${meetingId}/planning`);
  return { success: true };
}
