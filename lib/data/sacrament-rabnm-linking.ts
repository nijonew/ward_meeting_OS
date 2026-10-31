import { createClient } from "@/lib/supabase/server";

/**
 * Shared "realize a pool item as a real sacrament_rabnm row, or undo
 * it" mechanics -- extracted 2026-10-25 from `pullCallingPlanningIntoMeeting`/
 * `removeCallingPlanningFromMeeting`/`pullRabnmPlanningIntoMeeting`/
 * `removeRabnmPlanningFromMeeting` (all in
 * app/meetings/[id]/ward-business-actions.ts), which had each
 * independently duplicated the same insert-into-sacrament_rabnm-and-
 * sacrament_rabnm_people / find-and-delete-them-back-out logic for
 * their own pool (Calling Planning, RABNM Planning). Pure logic
 * consolidation -- no schema change, no behavior change; each caller
 * keeps its own validation, status-update decisions, and exclusion
 * handling, only the actual read/write against these two tables moved
 * here.
 */
export interface RabnmLinkSpec {
  meetingId: string;
  type: string;
  callingId?: string | null;
  detail?: string | null;
  eventDate?: string | null;
  /** Migration 093 -- Baby Blessing only, carried straight through
   *  from the planning pool's own `baby_name` (migration 085) so
   *  Conducting can still derive a family name after the pull. */
  babyName?: string | null;
  personIds: string[];
  /** Which pool this row came from -- `calling_planning_id` (Calling
   *  Planning) or `rabnm_planning_id` (RABNM Planning). */
  linkColumn: "calling_planning_id" | "rabnm_planning_id";
  linkId: string;
}

/** Creates the real per-meeting sacrament_rabnm row (plus one
 *  sacrament_rabnm_people row per person) for a pool item being pulled
 *  into a meeting. `personIds` may be empty (some RABNM Planning
 *  categories have no one attached) or hold more than one (e.g. two
 *  parents for a Baby Blessing) -- Calling Planning's own two sides
 *  only ever pass exactly one. */
export async function insertSacramentRabnmLink(spec: RabnmLinkSpec): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();

  // New rows always land at the end of their own (meeting, type) list
  // -- Callings and Releases each get their own independent order,
  // matching WardBusinessField.tsx's existing split by type. Reordering
  // from there is what the Move Up/Down controls are for.
  const { data: maxRow } = await supabase
    .from("sacrament_rabnm")
    .select("sort_order")
    .eq("meeting_id", spec.meetingId)
    .eq("type", spec.type)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = (maxRow?.sort_order ?? 0) + 10;

  const { data: rabnm, error: rabnmError } = await supabase
    .from("sacrament_rabnm")
    .insert({
      meeting_id: spec.meetingId,
      type: spec.type,
      calling_id: spec.callingId ?? null,
      detail: spec.detail ?? null,
      event_date: spec.eventDate ?? null,
      baby_name: spec.babyName ?? null,
      sort_order: sortOrder,
      [spec.linkColumn]: spec.linkId,
    })
    .select("id")
    .single();
  if (rabnmError || !rabnm) return { error: rabnmError?.message ?? "Could not create the announcement." };

  if (spec.personIds.length > 0) {
    const { error: peopleError } = await supabase
      .from("sacrament_rabnm_people")
      .insert(spec.personIds.map((personId) => ({ rabnm_id: rabnm.id, person_id: personId })));
    if (peopleError) return { error: peopleError.message };
  }

  return { id: rabnm.id };
}

/** Reverses `insertSacramentRabnmLink` -- finds the one sacrament_rabnm
 *  row this meeting+pool-item pair created (via the same link column),
 *  deletes its sacrament_rabnm_people rows (explicitly, same
 *  don't-assume-a-cascade reasoning as `delete_meeting_cascade`), then
 *  deletes it. `removedType` is the row's own `type` (so a caller like
 *  Calling Planning's release side can decide its own extra status
 *  reset), or `null` if nothing was found -- not an error, just
 *  nothing to undo (e.g. a row the auto-sweep was never eligible to
 *  create in the first place). */
export async function removeSacramentRabnmLink(
  meetingId: string,
  linkColumn: "calling_planning_id" | "rabnm_planning_id",
  linkId: string
): Promise<{ removedType: string | null } | { error: string }> {
  const supabase = await createClient();

  const { data: rabnmRow } = await supabase
    .from("sacrament_rabnm")
    .select("id, type")
    .eq("meeting_id", meetingId)
    .eq(linkColumn, linkId)
    .maybeSingle();

  if (!rabnmRow) return { removedType: null };

  const { error: peopleDeleteError } = await supabase.from("sacrament_rabnm_people").delete().eq("rabnm_id", rabnmRow.id);
  if (peopleDeleteError) return { error: peopleDeleteError.message };

  const { error: deleteError } = await supabase.from("sacrament_rabnm").delete().eq("id", rabnmRow.id);
  if (deleteError) return { error: deleteError.message };

  return { removedType: rabnmRow.type as string };
}
