"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  syncRotationMembership,
  gridColumnsFor,
  gridTableFor,
  pushRotationToUpcomingMeetings,
  pushFixedSacramentRolesToUpcomingMeetings,
  PERSON_AND_TEXT_ROTATION_KEYS,
} from "@/lib/data/rotations";
import type { MeetingTypeSlug } from "@/lib/types";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";

type ActionResult = { success: true } | { error: string };
type PushActionResult = { error?: string; filled?: number; skippedExisting?: number };
type PushFixedRolesActionResult = { error?: string; filled?: number; skippedExisting?: number; skippedVacant?: number };
type SaveGridActionResult = { error?: string; success?: boolean };

// None of these actions had a server-side check at all before this
// (2026-10-04, found while converting the page's own gate to the
// granular-features model) -- only the page's own gate kept the grid
// and its controls out of a non-admin's view.
async function requireRotationsFeature(): Promise<{ error: string } | null> {
  const { profile } = await getSessionUser();
  if (!hasFeature(profile, "rotations")) return { error: "Not authorized." };
  return null;
}

/** Grid field names are "<meetingId>::<roleKey>" so one <form> can carry
 *  every row's selects at once (see app/rotations/page.tsx) -- this
 *  splits them back apart. ":" never appears in a UUID or a role key,
 *  so this can't collide/misparse. */
function parseGridFieldName(name: string): { meetingId: string; roleKey: string } | null {
  const idx = name.indexOf("::");
  if (idx === -1) return null;
  return { meetingId: name.slice(0, idx), roleKey: name.slice(idx + 2) };
}

/**
 * Saves every cell on the grid (every meeting × every role currently
 * shown) in one submit, per the user's own request (2026-09-06: "one
 * single button on the page to save all changes"). Same
 * delete-then-insert-if-set approach as saveElementPersonRole
 * (app/meetings/[id]/dynamic-planning-actions.ts) -- just applied to
 * every row at once instead of one meeting's roles at a time. Purely a
 * direct edit of the applied assignment -- never touches any rotation's
 * member order or next_index pointer, so saving here doesn't skip
 * anyone in future meetings.
 *
 * **Bug found and fixed 2026-10-21**: Spiritual Thought/Handbook
 * Training (`PERSON_AND_TEXT_ROTATION_KEYS`) are `person_and_text`
 * catalog elements -- their person has only ever lived in
 * `meeting_element_notes.person_id`, never in this role table. Routed
 * there now, matching `pushRotationToUpcomingMeetings`/
 * `applyRotationsToNewMeeting` -- see getAssignmentGrid's own doc
 * comment (lib/data/rotations.ts) for the full bug writeup. Writes via
 * upsert/update rather than delete-then-insert specifically so this
 * never clobbers a free-text note already saved on the same element
 * from the meeting's own Planning page -- only `person_id` is ever
 * touched here.
 */
export async function saveAssignmentGrid(
  meetingTypeSlug: MeetingTypeSlug,
  _prevState: unknown,
  formData: FormData
): Promise<SaveGridActionResult> {
  const denied = await requireRotationsFeature();
  if (denied) return denied;

  const supabase = await createClient();
  const table = gridTableFor(meetingTypeSlug);
  const columnKeys = new Set(gridColumnsFor(meetingTypeSlug).map((c) => c.key));

  const byMeeting = new Map<string, Record<string, string>>();
  for (const [name, value] of formData.entries()) {
    const parsed = parseGridFieldName(name);
    if (!parsed || !columnKeys.has(parsed.roleKey)) continue;
    const values = byMeeting.get(parsed.meetingId) ?? {};
    values[parsed.roleKey] = String(value);
    byMeeting.set(parsed.meetingId, values);
  }

  for (const [meetingId, values] of byMeeting) {
    for (const roleKey of columnKeys) {
      const assignedToId = values[roleKey] || null;

      if (PERSON_AND_TEXT_ROTATION_KEYS.has(roleKey)) {
        if (assignedToId) {
          const { error } = await supabase
            .from("meeting_element_notes")
            .upsert({ meeting_id: meetingId, element_key: roleKey, person_id: assignedToId }, { onConflict: "meeting_id,element_key" });
          if (error) return { error: error.message };
        } else {
          const { error } = await supabase
            .from("meeting_element_notes")
            .update({ person_id: null })
            .eq("meeting_id", meetingId)
            .eq("element_key", roleKey);
          if (error) return { error: error.message };
        }
        continue;
      }

      const { error: deleteError } = await supabase
        .from(table)
        .delete()
        .eq("meeting_id", meetingId)
        .eq("role", roleKey);
      if (deleteError) return { error: deleteError.message };

      if (assignedToId) {
        const row: Record<string, unknown> = { meeting_id: meetingId, role: roleKey, assigned_to_id: assignedToId };
        const { error: insertError } = await supabase.from(table).insert(row);
        if (insertError) return { error: insertError.message };
      }
    }
  }

  revalidatePath("/rotations");
  return { success: true };
}

export async function pushRotation(
  rotationId: string,
  _prevState: unknown,
  formData: FormData
): Promise<PushActionResult> {
  const denied = await requireRotationsFeature();
  if (denied) return denied;

  const fromDate = String(formData.get("from_date") ?? "");
  if (!fromDate) return { error: "Choose a start date." };

  const result = await pushRotationToUpcomingMeetings(rotationId, fromDate);
  if ("error" in result) return result;

  revalidatePath("/rotations");
  return result;
}

export async function pushFixedSacramentRoles(
  _prevState: unknown,
  formData: FormData
): Promise<PushFixedRolesActionResult> {
  const denied = await requireRotationsFeature();
  if (denied) return denied;

  const fromDate = String(formData.get("from_date") ?? "");
  if (!fromDate) return { error: "Choose a start date." };

  const result = await pushFixedSacramentRolesToUpcomingMeetings(fromDate);
  if ("error" in result) return result;

  revalidatePath("/rotations");
  return result;
}

export async function syncRotation(rotationId: string): Promise<ActionResult> {
  const denied = await requireRotationsFeature();
  if (denied) return denied;

  const result = await syncRotationMembership(rotationId);
  if (result.error) return { error: result.error };
  revalidatePath("/rotations");
  return { success: true };
}

/**
 * Adds a rotation member, either a plain person (unchanged behavior) or
 * a calling (migration 080, 2026-10-21) -- whichever the submitted form
 * data actually carries. "Add a calling..." on /rotations submits
 * calling_id instead of person_id; both end up in the same table, with
 * the generic resolve-fresh-at-assignment-time logic in
 * lib/data/rotations.ts handling the rest.
 */
export async function addRotationMember(rotationId: string, formData: FormData): Promise<ActionResult> {
  const denied = await requireRotationsFeature();
  if (denied) return denied;

  const supabase = await createClient();
  const personId = String(formData.get("person_id") ?? "");
  const callingId = String(formData.get("calling_id") ?? "");
  if (!personId && !callingId) return { error: "Choose a person or a calling." };

  const { data: existing } = await supabase
    .from("rotation_members")
    .select("sort_order")
    .eq("rotation_id", rotationId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

  const row: { rotation_id: string; person_id: string | null; calling_id: string | null; sort_order: number } = callingId
    ? { rotation_id: rotationId, calling_id: callingId, person_id: null, sort_order: nextOrder }
    : { rotation_id: rotationId, person_id: personId, calling_id: null, sort_order: nextOrder };

  const { error } = await supabase.from("rotation_members").insert(row);

  if (error) return { error: error.message };
  revalidatePath("/rotations");
  return { success: true };
}

export async function removeRotationMember(memberId: string): Promise<ActionResult> {
  const denied = await requireRotationsFeature();
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase.from("rotation_members").delete().eq("id", memberId);
  if (error) return { error: error.message };
  revalidatePath("/rotations");
  return { success: true };
}

export async function moveRotationMember(
  rotationId: string,
  memberId: string,
  direction: "up" | "down"
): Promise<ActionResult> {
  const denied = await requireRotationsFeature();
  if (denied) return denied;

  const supabase = await createClient();

  const { data: members, error } = await supabase
    .from("rotation_members")
    .select("id, sort_order")
    .eq("rotation_id", rotationId)
    .order("sort_order");

  if (error || !members) return { error: error?.message ?? "Could not load members." };

  const idx = members.findIndex((m) => m.id === memberId);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (idx === -1 || swapIdx < 0 || swapIdx >= members.length) {
    return { success: true }; // nothing to do at the boundary
  }

  const a = members[idx];
  const b = members[swapIdx];

  const { error: err1 } = await supabase
    .from("rotation_members")
    .update({ sort_order: b.sort_order })
    .eq("id", a.id);
  const { error: err2 } = await supabase
    .from("rotation_members")
    .update({ sort_order: a.sort_order })
    .eq("id", b.id);

  if (err1 || err2) return { error: err1?.message ?? err2?.message ?? "Could not reorder." };

  revalidatePath("/rotations");
  return { success: true };
}