"use server";

// The four pull/remove functions below each used to carry their own
// copy of the "insert into sacrament_rabnm + sacrament_rabnm_people" /
// "find and delete them back out" logic -- extracted 2026-10-25 into
// `lib/data/sacrament-rabnm-linking.ts` (shared by Calling Planning and
// RABNM Planning, the two pools that both realize a pull this way) and
// the exclusion-clearing helper into `lib/data/pool-sweep.ts` (shared
// with the Announcements pull, which has the identical "a manual
// re-add clears a prior Remove" need). Pure refactor -- no behavior
// change, see PROJECT_CONTEXT.md's Known open items for the full
// writeup.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { insertSacramentRabnmLink, removeSacramentRabnmLink } from "@/lib/data/sacrament-rabnm-linking";
import { clearPoolExclusion } from "@/lib/data/pool-sweep";

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
 *
 * **Clears any standing exclusion for this pair, 2026-10-25** (migration
 * 084) -- a manual pull here is a deliberate "yes, announce this at
 * this meeting after all," so it overrides a prior Remove click (see
 * `removeCallingPlanningFromMeeting`'s own comment) the same way
 * `pullAnnouncementIntoMeeting` already does for the equivalent
 * Announcements exclusion.
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

  const inserted = await insertSacramentRabnmLink({
    meetingId,
    type,
    callingId: planning.calling_id,
    personIds: [personId],
    linkColumn: "calling_planning_id",
    linkId: planningId,
  });
  if ("error" in inserted) return inserted;

  const { error: updateError } = await supabase
    .from("calling_planning")
    .update({ announced_meeting_id: meetingId, ...statusUpdate, updated_at: new Date().toISOString() })
    .eq("id", planningId);
  if (updateError) return { error: updateError.message };

  await clearPoolExclusion("calling_planning_meeting_exclusions", "calling_planning_id", planningId, meetingId, [type]);

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
 *
 * **Also records a standing exclusion, 2026-10-25** (migration 084,
 * the user's own report: "I am not able to remove released
 * individuals from sacrament meeting planning"). Without this,
 * `autoAnnounceReadyCallingPlanningItems` re-runs on every Sacrament
 * Meeting Planning page load and only checks "is this still
 * `to_announce` and not yet linked to the nearest-upcoming meeting" --
 * for the single most common case (removing something from the
 * meeting that currently IS the nearest-upcoming one), clearing
 * `announced_meeting_id` just above made the row immediately eligible
 * again, so the very next page load silently re-created the exact
 * same row, making Remove look like it did nothing at all. A no-op
 * for a row this mechanism never auto-swept in the first place
 * (nothing ever reads the exclusion for one that wasn't eligible to
 * begin with) -- always recording it is simpler than first checking
 * whether it was needed.
 */
export async function removeCallingPlanningFromMeeting(meetingId: string, planningId: string): Promise<ActionResult> {
  const denied = await requireRabnmFeature();
  if (denied) return denied;

  const supabase = await createClient();
  const removed = await removeSacramentRabnmLink(meetingId, "calling_planning_id", planningId);
  if ("error" in removed) return removed;

  const statusUpdate: Record<string, string> = removed.removedType === "release" ? { release_status: "to_announce" } : {};
  const { error: updateError } = await supabase
    .from("calling_planning")
    .update({ announced_meeting_id: null, ...statusUpdate, updated_at: new Date().toISOString() })
    .eq("id", planningId);
  if (updateError) return { error: updateError.message };

  if (removed.removedType) {
    await supabase
      .from("calling_planning_meeting_exclusions")
      .upsert(
        { calling_planning_id: planningId, meeting_id: meetingId, side: removed.removedType },
        { onConflict: "calling_planning_id,meeting_id,side", ignoreDuplicates: true }
      );
  }

  revalidateBoth(meetingId);
  return { success: true };
}

/**
 * Moves one Ward Business line (a Calling Planning-sourced Calling or
 * Release) up or down within its own list -- the user's own request,
 * 2026-10-30: "I would like to be able to re-order individual lines in
 * callings/releases in sacrament meeting to the order I would like to
 * have them announced." Scoped by `type` ("release" | "new_calling")
 * so Callings and Releases reorder independently, matching
 * WardBusinessField.tsx's own existing split of the two lists.
 *
 * Same swap-adjacent-sort_order shape as every other Move Up/Down
 * action in this app (moveTemplateElement, moveRotationMember,
 * moveProgramItem) -- fetch this meeting's own rows of this type in
 * order, find the target, swap its sort_order with its neighbor's, or
 * silently no-op at a boundary.
 */
export async function moveWardBusinessItem(
  meetingId: string,
  itemId: string,
  type: "release" | "new_calling",
  direction: "up" | "down"
): Promise<ActionResult> {
  const denied = await requireRabnmFeature();
  if (denied) return denied;

  const supabase = await createClient();

  const { data: rows, error: fetchError } = await supabase
    .from("sacrament_rabnm")
    .select("id, sort_order")
    .eq("meeting_id", meetingId)
    .eq("type", type)
    .order("sort_order", { ascending: true });

  if (fetchError || !rows) {
    return { error: fetchError?.message ?? "Could not load Ward Business items." };
  }

  const index = rows.findIndex((r) => r.id === itemId);
  if (index === -1) {
    return { error: "Item not found on this meeting." };
  }

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= rows.length) {
    return { success: true };
  }

  const current = rows[index];
  const swap = rows[swapIndex];

  const { error: error1 } = await supabase
    .from("sacrament_rabnm")
    .update({ sort_order: swap.sort_order })
    .eq("id", current.id);
  if (error1) return { error: error1.message };

  const { error: error2 } = await supabase
    .from("sacrament_rabnm")
    .update({ sort_order: current.sort_order })
    .eq("id", swap.id);
  if (error2) return { error: error2.message };

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

  const personRows = (planning.sacrament_rabnm_planning_people ?? []) as { person_id: string }[];
  const inserted = await insertSacramentRabnmLink({
    meetingId,
    type: planning.type,
    detail: planning.detail,
    eventDate: planning.event_date,
    personIds: personRows.map((p) => p.person_id),
    linkColumn: "rabnm_planning_id",
    linkId: planningId,
  });
  if ("error" in inserted) return inserted;

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
  const removed = await removeSacramentRabnmLink(meetingId, "rabnm_planning_id", planningId);
  if ("error" in removed) return removed;

  const { error: updateError } = await supabase
    .from("sacrament_rabnm_planning")
    .update({ announced_meeting_id: null, updated_at: new Date().toISOString() })
    .eq("id", planningId);
  if (updateError) return { error: updateError.message };

  revalidateRabnmPlanning(meetingId);
  return { success: true };
}
