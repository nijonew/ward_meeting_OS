"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { meetingFeature } from "@/lib/data/meeting-features";
import { getMeetingById } from "@/lib/data/meetings";

export type ActionResult = { success: true } | { error: string };

/**
 * These four actions operate on meeting_planned_elements, keyed by
 * meeting_id -- editing here only ever affects this one meeting's own
 * agenda. Before the Sacrament Meeting Planning redesign, this page
 * edited the shared meeting_templates catalog (one list per meeting
 * type, used by every meeting of that type); that catalog is now only
 * edited via /admin/meeting-templates, and is what seeds a *new*
 * meeting's starting agenda (see seedPlannedElementsForMeeting).
 *
 * Had no server-side check at all before 2026-10-04 -- an incidental
 * gap found while re-gating this app's other actions for the new
 * feature system, fixed alongside it with the matching per-type
 * `<type>_template` feature.
 */
async function requireTemplateFeature(meetingId: string): Promise<ActionResult | null> {
  const { profile } = await getSessionUser();
  const meeting = await getMeetingById(meetingId);
  if (!meeting) return { error: "Could not load this meeting." };
  if (!hasFeature(profile, meetingFeature(meeting.meetingType, "template"))) return { error: "Not authorized." };
  return null;
}

export async function addTemplateElement(meetingId: string, elementId: string): Promise<ActionResult> {
  const denied = await requireTemplateFeature(meetingId);
  if (denied) return denied;

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("meeting_planned_elements")
    .select("sort_order")
    .eq("meeting_id", meetingId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextSortOrder = existing && existing.length > 0 ? existing[0].sort_order + 10 : 10;

  const { data: element } = await supabase
    .from("meeting_elements")
    .select("repeatable")
    .eq("id", elementId)
    .single();

  const { error } = await supabase.from("meeting_planned_elements").insert({
    meeting_id: meetingId,
    element_id: elementId,
    sort_order: nextSortOrder,
    slot_count: element?.repeatable ? 1 : null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/meetings/${meetingId}/template`);
  revalidatePath(`/meetings/${meetingId}/planning`);
  return { success: true };
}

export async function removeTemplateElement(meetingId: string, plannedRowId: string): Promise<ActionResult> {
  const denied = await requireTemplateFeature(meetingId);
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase.from("meeting_planned_elements").delete().eq("id", plannedRowId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/meetings/${meetingId}/template`);
  revalidatePath(`/meetings/${meetingId}/planning`);
  return { success: true };
}

export async function setTemplateSlotCount(
  meetingId: string,
  plannedRowId: string,
  slotCount: number
): Promise<ActionResult> {
  const denied = await requireTemplateFeature(meetingId);
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase
    .from("meeting_planned_elements")
    .update({ slot_count: slotCount })
    .eq("id", plannedRowId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/meetings/${meetingId}/template`);
  revalidatePath(`/meetings/${meetingId}/planning`);
  return { success: true };
}

export async function moveTemplateElement(
  meetingId: string,
  plannedRowId: string,
  direction: "up" | "down"
): Promise<ActionResult> {
  const denied = await requireTemplateFeature(meetingId);
  if (denied) return denied;

  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("meeting_planned_elements")
    .select("id, sort_order")
    .eq("meeting_id", meetingId)
    .order("sort_order", { ascending: true });

  if (!rows) {
    return { error: "Could not load agenda elements." };
  }

  const index = rows.findIndex((r) => r.id === plannedRowId);
  if (index === -1) {
    return { error: "Element not found in this meeting's agenda." };
  }

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= rows.length) {
    return { success: true };
  }

  const current = rows[index];
  const swap = rows[swapIndex];

  const { error: error1 } = await supabase
    .from("meeting_planned_elements")
    .update({ sort_order: swap.sort_order })
    .eq("id", current.id);
  const { error: error2 } = await supabase
    .from("meeting_planned_elements")
    .update({ sort_order: current.sort_order })
    .eq("id", swap.id);

  if (error1 || error2) {
    return { error: error1?.message ?? error2?.message ?? "Could not reorder." };
  }

  revalidatePath(`/meetings/${meetingId}/template`);
  revalidatePath(`/meetings/${meetingId}/planning`);
  return { success: true };
}
