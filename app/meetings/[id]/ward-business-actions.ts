"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";

type ActionResult = { success: true } | { error: string };

async function requireRabnmFeature(): Promise<ActionResult | null> {
  const { profile } = await getSessionUser();
  if (!hasFeature(profile, "sacrament_rabnm")) return { error: "Not authorized." };
  return null;
}

function revalidateBoth(meetingId: string) {
  revalidatePath(`/meetings/${meetingId}/planning`);
  revalidatePath("/calling-planning");
}

/**
 * Pulls one Calling Planning row into this meeting's Ward Business --
 * the meeting-side counterpart to Calling Planning's own
 * `pushCallingToSacramentMeeting` (app/calling-planning/actions.ts),
 * built 2026-10-03 so planning a meeting doesn't require leaving it to
 * announce a calling change. Same effect either way: creates the
 * `sacrament_rabnm` (+ `sacrament_rabnm_people`) row and marks the
 * Calling Planning row announced here. `kind` says which half to pull
 * -- a row can have both a ready calling *and* a ready release at once
 * (e.g. a presidency change), pulled independently, matching
 * `pushCallingToSacramentMeeting`'s own logic.
 *
 * Unlike that function, this isn't limited to rows already marked "To
 * Announce in Sacrament" -- the user's own request: "the ability to
 * call in other items from calling planning even if they aren't marked
 * as ready." Pulling a row in *is* the decision to announce it, so it
 * still advances calling_status/release_status to the next step
 * regardless of where it started.
 */
export async function pullCallingPlanningIntoMeeting(
  meetingId: string,
  planningId: string,
  kind: "calling" | "release"
): Promise<ActionResult> {
  const denied = await requireRabnmFeature();
  if (denied) return denied;

  const supabase = await createClient();
  const { data: planning, error: fetchError } = await supabase
    .from("calling_planning")
    .select("calling_id, candidate_person_ids, release_person_id, announced_meeting_id")
    .eq("id", planningId)
    .single();

  if (fetchError || !planning) {
    return { error: fetchError?.message ?? "Could not load this planning record." };
  }
  if (planning.announced_meeting_id) {
    return { error: "This has already been announced in a meeting." };
  }

  let personId: string;
  let type: string;
  let statusColumn: "calling_status" | "release_status";
  let nextStatus: string;

  if (kind === "calling") {
    const candidateIds = (planning.candidate_person_ids ?? []) as string[];
    if (candidateIds.length !== 1) {
      return { error: "Narrow Candidates down to exactly one person before announcing the new calling." };
    }
    personId = candidateIds[0];
    type = "new_calling";
    statusColumn = "calling_status";
    nextStatus = "to_be_set_apart";
  } else {
    if (!planning.release_person_id) {
      return { error: "No one is set to be released on this row." };
    }
    personId = planning.release_person_id;
    type = "release";
    statusColumn = "release_status";
    nextStatus = "to_record";
  }

  const { data: rabnm, error: rabnmError } = await supabase
    .from("sacrament_rabnm")
    .insert({ meeting_id: meetingId, type, calling_id: planning.calling_id, calling_planning_id: planningId })
    .select("id")
    .single();
  if (rabnmError || !rabnm) return { error: rabnmError?.message ?? "Could not create the announcement." };

  const { error: peopleError } = await supabase
    .from("sacrament_rabnm_people")
    .insert({ rabnm_id: rabnm.id, person_id: personId });
  if (peopleError) return { error: peopleError.message };

  const { error: updateError } = await supabase
    .from("calling_planning")
    .update({ announced_meeting_id: meetingId, [statusColumn]: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", planningId);
  if (updateError) return { error: updateError.message };

  revalidateBoth(meetingId);
  return { success: true };
}

/**
 * Reverses pullCallingPlanningIntoMeeting -- removes the
 * sacrament_rabnm row this meeting's Ward Business created (and its
 * sacrament_rabnm_people rows, explicitly, same reasoning as
 * delete_meeting_cascade: don't assume a cascade exists) and resets the
 * Calling Planning row back to "To Announce in Sacrament"
 * (announced_meeting_id cleared) so it can be pulled into a different
 * meeting, or this one again, without manual database cleanup. Only
 * ever touches a row this mechanism itself created
 * (sacrament_rabnm.calling_planning_id, migration 055) -- a
 * manually-added "Other" item has no such link and isn't reachable
 * through this action.
 */
export async function removeCallingPlanningFromMeeting(meetingId: string, planningId: string): Promise<ActionResult> {
  const denied = await requireRabnmFeature();
  if (denied) return denied;

  const supabase = await createClient();
  const { data: rabnmRow } = await supabase
    .from("sacrament_rabnm")
    .select("id, type")
    .eq("meeting_id", meetingId)
    .eq("calling_planning_id", planningId)
    .maybeSingle();

  if (rabnmRow) {
    const { error: peopleDeleteError } = await supabase
      .from("sacrament_rabnm_people")
      .delete()
      .eq("rabnm_id", rabnmRow.id);
    if (peopleDeleteError) return { error: peopleDeleteError.message };

    const { error: deleteError } = await supabase.from("sacrament_rabnm").delete().eq("id", rabnmRow.id);
    if (deleteError) return { error: deleteError.message };
  }

  const statusColumn = rabnmRow?.type === "release" ? "release_status" : "calling_status";
  const { error: updateError } = await supabase
    .from("calling_planning")
    .update({ announced_meeting_id: null, [statusColumn]: "to_announce", updated_at: new Date().toISOString() })
    .eq("id", planningId);
  if (updateError) return { error: updateError.message };

  revalidateBoth(meetingId);
  return { success: true };
}
