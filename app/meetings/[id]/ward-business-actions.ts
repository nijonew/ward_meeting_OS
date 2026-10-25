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
 * as ready." Pulling a row in records where it was announced
 * (`announced_meeting_id`) regardless of where its status started.
 *
 * **Calling status no longer auto-advances to "To Record," 2026-10-13**
 * (the user's own request: "I don't want the status of those that are
 * 'To be Announced' to change to 'To Record' automatically. I want it
 * to be a manual change for that status change."). Pulling a calling
 * in now leaves `calling_status` exactly as it was -- the admin moves
 * it to "To Record" (or wherever) themselves, on their own timing,
 * via the grid's own Status column. **Release's own auto-advance (to
 * "Complete") is unchanged** -- the request above was specific to the
 * calling side's "To Record" transition; release never used "To
 * Record" as a target in the first place (it jumps straight to
 * "Complete"), and nothing was said about changing that one.
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
  const statusUpdate: Record<string, string> = {};

  if (kind === "calling") {
    const candidateIds = (planning.candidate_person_ids ?? []) as string[];
    if (candidateIds.length !== 1) {
      return { error: "Narrow Candidates down to exactly one person before announcing the new calling." };
    }
    personId = candidateIds[0];
    type = "new_calling";
    // No calling_status change -- see this function's own doc comment.
  } else {
    if (!planning.release_person_id) {
      return { error: "No one is set to be released on this row." };
    }
    personId = planning.release_person_id;
    type = "release";
    statusUpdate.release_status = "complete";
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
    .update({ announced_meeting_id: meetingId, ...statusUpdate, updated_at: new Date().toISOString() })
    .eq("id", planningId);
  if (updateError) return { error: updateError.message };

  revalidateBoth(meetingId);
  return { success: true };
}

/**
 * Reverses pullCallingPlanningIntoMeeting -- removes the
 * sacrament_rabnm row this meeting's Ward Business created (and its
 * sacrament_rabnm_people rows, explicitly, same reasoning as
 * delete_meeting_cascade: don't assume a cascade exists) and clears
 * `announced_meeting_id` so it can be pulled into a different meeting,
 * or this one again, without manual database cleanup. Only ever
 * touches a row this mechanism itself created
 * (sacrament_rabnm.calling_planning_id, migration 055) -- a
 * manually-added "Other" item has no such link and isn't reachable
 * through this action.
 *
 * **Only resets `release_status` back to "To be Announced," not
 * `calling_status`, 2026-10-13** -- matching
 * `pullCallingPlanningIntoMeeting`'s own change the same day: pulling
 * a calling in no longer auto-advances `calling_status` at all, so
 * there's nothing of this flow's own doing left to undo on that
 * column. Forcing it back to "to_announce" here regardless would risk
 * clobbering a real manual status change the admin made in the
 * meantime (exactly the kind of automatic status change they asked to
 * stop happening).
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

  const statusUpdate: Record<string, string> = rabnmRow?.type === "release" ? { release_status: "to_announce" } : {};
  const { error: updateError } = await supabase
    .from("calling_planning")
    .update({ announced_meeting_id: null, ...statusUpdate, updated_at: new Date().toISOString() })
    .eq("id", planningId);
  if (updateError) return { error: updateError.message };

  revalidateBoth(meetingId);
  return { success: true };
}

function revalidateRabnmPlanning(meetingId: string) {
  revalidatePath(`/meetings/${meetingId}/planning`);
  revalidatePath("/rabnm-planning");
}

/**
 * Pulls one standing RABNM-planning-pool row (migration 082 --
 * Recognitions/Advancements/Baptisms/New Members/Baby Blessings) into
 * this meeting's Ward Business -- the direct counterpart to
 * pullCallingPlanningIntoMeeting above, for the pool built the same
 * way Calling Planning already works: a standing not-yet-announced
 * list, pulled into a specific meeting on demand. Unlike Calling
 * Planning's two-sided (calling/release) split, a RABNM-planning row
 * always carries its own single `type`, so there's no `kind` argument
 * here.
 */
export async function pullRabnmPlanningIntoMeeting(meetingId: string, planningId: string): Promise<ActionResult> {
  const denied = await requireRabnmFeature();
  if (denied) return denied;

  const supabase = await createClient();
  const { data: planning, error: fetchError } = await supabase
    .from("sacrament_rabnm_planning")
    .select("type, detail, event_date, announced_meeting_id, sacrament_rabnm_planning_people(person_id)")
    .eq("id", planningId)
    .single();

  if (fetchError || !planning) {
    return { error: fetchError?.message ?? "Could not load this planning record." };
  }
  if (planning.announced_meeting_id) {
    return { error: "This has already been announced in a meeting." };
  }

  const { data: rabnm, error: rabnmError } = await supabase
    .from("sacrament_rabnm")
    .insert({
      meeting_id: meetingId,
      type: planning.type,
      detail: planning.detail,
      event_date: planning.event_date,
      rabnm_planning_id: planningId,
    })
    .select("id")
    .single();
  if (rabnmError || !rabnm) return { error: rabnmError?.message ?? "Could not create the announcement." };

  const personRows = (planning.sacrament_rabnm_planning_people ?? []) as { person_id: string }[];
  if (personRows.length > 0) {
    const { error: peopleError } = await supabase
      .from("sacrament_rabnm_people")
      .insert(personRows.map((p) => ({ rabnm_id: rabnm.id, person_id: p.person_id })));
    if (peopleError) return { error: peopleError.message };
  }

  const { error: updateError } = await supabase
    .from("sacrament_rabnm_planning")
    .update({ announced_meeting_id: meetingId, updated_at: new Date().toISOString() })
    .eq("id", planningId);
  if (updateError) return { error: updateError.message };

  revalidateRabnmPlanning(meetingId);
  return { success: true };
}

/**
 * Reverses pullRabnmPlanningIntoMeeting -- removes the sacrament_rabnm
 * row this meeting's Ward Business created (and its
 * sacrament_rabnm_people rows) and clears announced_meeting_id so the
 * pool row goes back into circulation, same reasoning as
 * removeCallingPlanningFromMeeting above.
 */
export async function removeRabnmPlanningFromMeeting(meetingId: string, planningId: string): Promise<ActionResult> {
  const denied = await requireRabnmFeature();
  if (denied) return denied;

  const supabase = await createClient();
  const { data: rabnmRow } = await supabase
    .from("sacrament_rabnm")
    .select("id")
    .eq("meeting_id", meetingId)
    .eq("rabnm_planning_id", planningId)
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

  const { error: updateError } = await supabase
    .from("sacrament_rabnm_planning")
    .update({ announced_meeting_id: null, updated_at: new Date().toISOString() })
    .eq("id", planningId);
  if (updateError) return { error: updateError.message };

  revalidateRabnmPlanning(meetingId);
  return { success: true };
}
