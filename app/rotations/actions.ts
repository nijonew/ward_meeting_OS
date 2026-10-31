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
  UNLISTED_CALLING_VALUE,
} from "@/lib/data/rotations";
import type { MeetingTypeSlug } from "@/lib/types";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";

type ActionResult = { success: true } | { error: string };
type PushActionResult = { error?: string; filled?: number; overwritten?: number };
type PushFixedRolesActionResult = {
  error?: string;
  filled?: number;
  overwritten?: number;
  skippedVacant?: number;
  skippedAmbiguous?: number;
};
type SaveGridActionResult = { error?: string; success?: boolean; clearedVacant?: number };

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
 * **Rewritten 2026-10-31** (the user's own request: "I don't want
 * rotations to ever say anyone's name") -- each submitted cell value is
 * now a CALLING id, not a person id (see getAssignmentGrid's own doc
 * comment, lib/data/rotations.ts, for the full redesign). Resolved to a
 * real person right here, by the calling's own primary key -- never by
 * name, so two active `callings` rows sharing a name (this app's own
 * "more than one simultaneous holder" convention) can never be confused
 * with each other, unlike the bug this exact file's push actions hit
 * 2026-10-31 by resolving a NAME instead of an id. `UNLISTED_CALLING_VALUE`
 * means "leave this cell exactly as it is" -- it's the placeholder
 * shown when an existing assignment doesn't map to any calling this
 * grid tracks, and skipping it here is what keeps an untouched cell
 * from silently clearing a real assignment the grid simply can't show
 * by calling.
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
  const callingIdsSubmitted = new Set<string>();
  for (const [name, value] of formData.entries()) {
    const parsed = parseGridFieldName(name);
    if (!parsed || !columnKeys.has(parsed.roleKey)) continue;
    const raw = String(value);
    const values = byMeeting.get(parsed.meetingId) ?? {};
    values[parsed.roleKey] = raw;
    byMeeting.set(parsed.meetingId, values);
    if (raw && raw !== UNLISTED_CALLING_VALUE) callingIdsSubmitted.add(raw);
  }

  // Every submitted calling's CURRENT holder, resolved once in a single
  // batched query by primary key -- not a name lookup, so this can
  // never fall into the duplicate-calling-name trap.
  let holderByCallingId = new Map<string, string | null>();
  if (callingIdsSubmitted.size > 0) {
    const { data } = await supabase
      .from("callings")
      .select("id, current_holder_id")
      .in("id", Array.from(callingIdsSubmitted));
    holderByCallingId = new Map(
      ((data ?? []) as { id: string; current_holder_id: string | null }[]).map((c) => [c.id, c.current_holder_id])
    );
  }

  let clearedVacant = 0;

  for (const [meetingId, values] of byMeeting) {
    for (const roleKey of columnKeys) {
      const raw = values[roleKey] ?? "";
      // This cell's existing assignment doesn't map to a tracked
      // calling and wasn't changed -- leave it exactly as it is.
      if (raw === UNLISTED_CALLING_VALUE) continue;

      let assignedToId: string | null = null;
      if (raw) {
        const holder = holderByCallingId.get(raw) ?? null;
        if (holder) {
          assignedToId = holder;
        } else {
          // The chosen calling is currently vacant (or, defensively, an
          // id that no longer resolves at all) -- nothing to assign,
          // same as picking "Unassigned," but counted so the admin
          // knows why.
          clearedVacant += 1;
        }
      }

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
  return { success: true, clearedVacant: clearedVacant > 0 ? clearedVacant : undefined };
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
 * Adds a calling as a rotation member -- the only kind addRotationMember
 * can create going forward (2026-10-31, the user's own request: "I want
 * calling names only when selecting the rotation"). Person-based
 * membership (migration 080 let a rotation hold either) is closed off
 * here on purpose, re-checked server-side rather than just hidden from
 * the page -- a direct POST can't resurrect it even if the UI's own
 * "Add someone..." picker is gone. A rotation that still has a legacy
 * person-based member from before this change keeps it (see
 * RotationMember.display_label) until an admin removes it by hand;
 * removeRotationMember still works on either kind unchanged.
 */
export async function addRotationMember(rotationId: string, formData: FormData): Promise<ActionResult> {
  const denied = await requireRotationsFeature();
  if (denied) return denied;

  const supabase = await createClient();
  const callingId = String(formData.get("calling_id") ?? "");
  if (!callingId) return { error: "Choose a calling." };

  const { data: existing } = await supabase
    .from("rotation_members")
    .select("sort_order")
    .eq("rotation_id", rotationId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

  const { error } = await supabase
    .from("rotation_members")
    .insert({ rotation_id: rotationId, calling_id: callingId, person_id: null, sort_order: nextOrder });

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