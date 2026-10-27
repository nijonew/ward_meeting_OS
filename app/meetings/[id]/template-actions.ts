"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { meetingFeature } from "@/lib/data/meeting-features";
import { getMeetingById } from "@/lib/data/meetings";
import { getMeetingWithType } from "@/lib/data/meeting-elements";

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

/**
 * The reverse direction from `mergeFormatTemplateIntoMeeting`
 * (`app/meetings/[id]/planning/actions.ts`) -- takes this meeting's
 * own CURRENT agenda and makes it the new standing default template
 * for its type (and, for Sacrament Meeting, its own current Format),
 * so every future meeting created with that type/format starts from
 * it. Built 2026-10-27, the user's own follow-up once the real
 * behavior of the Format control was clarified: "Yes, build both" --
 * this one and the merge-on-Format-change fix above, as two separate
 * controls, since they're genuinely opposite directions (template →
 * meeting vs. meeting → template).
 *
 * Overwrites the shared `meeting_templates` rows for this
 * meeting_type_id (+ format_key, for Sacrament Meeting) outright --
 * delete-then-insert from this meeting's own `meeting_planned_elements`,
 * same shape `seedPlannedElementsForMeeting` already reads. For
 * Sacrament Meeting, also does the same for `sacrament_program_templates`
 * from this meeting's own `sacrament_program_items` -- the Speakers &
 * Music list is just as much "this meeting's shape" as the core
 * agenda elements are, and the motivating example for this whole
 * feature (Primary Program) is specifically a Program item, not a
 * core element. Never touches any OTHER already-existing meeting --
 * only the shared template, which only affects a meeting created
 * *after* this runs.
 */
export async function saveMeetingAsTemplate(meetingId: string): Promise<ActionResult> {
  const denied = await requireTemplateFeature(meetingId);
  if (denied) return denied;

  const supabase = await createClient();
  const meeting = await getMeetingById(meetingId);
  const meetingWithType = await getMeetingWithType(meetingId);
  if (!meeting || !meetingWithType) return { error: "Could not load this meeting." };

  const isSacrament = meeting.meetingType === "sacrament-meeting";
  let formatKey: string | null = null;
  if (isSacrament) {
    const { data: planning } = await supabase
      .from("sacrament_planning")
      .select("special_format")
      .eq("meeting_id", meetingId)
      .maybeSingle();
    formatKey = (planning as { special_format: string | null } | null)?.special_format ?? "standard";
  }

  const { data: currentElements } = await supabase
    .from("meeting_planned_elements")
    .select("element_id, sort_order, slot_count")
    .eq("meeting_id", meetingId);

  let deleteTemplates = supabase
    .from("meeting_templates")
    .delete()
    .eq("meeting_type_id", meetingWithType.meetingTypeId);
  deleteTemplates = formatKey ? deleteTemplates.eq("format_key", formatKey) : deleteTemplates.is("format_key", null);
  const { error: deleteError } = await deleteTemplates;
  if (deleteError) return { error: deleteError.message };

  if (currentElements && currentElements.length > 0) {
    const { error: insertError } = await supabase.from("meeting_templates").insert(
      currentElements.map((row) => ({
        meeting_type_id: meetingWithType.meetingTypeId,
        format_key: formatKey,
        element_id: row.element_id,
        sort_order: row.sort_order,
        slot_count: row.slot_count,
      }))
    );
    if (insertError) return { error: insertError.message };
  }

  if (isSacrament && formatKey) {
    const { data: currentItems } = await supabase
      .from("sacrament_program_items")
      .select("item_key, sort_order")
      .eq("meeting_id", meetingId);

    const { error: deleteItemsError } = await supabase
      .from("sacrament_program_templates")
      .delete()
      .eq("format_key", formatKey);
    if (deleteItemsError) return { error: deleteItemsError.message };

    if (currentItems && currentItems.length > 0) {
      const { error: insertItemsError } = await supabase
        .from("sacrament_program_templates")
        .insert(currentItems.map((row) => ({ format_key: formatKey, item_key: row.item_key, sort_order: row.sort_order })));
      if (insertItemsError) return { error: insertItemsError.message };
    }
  }

  revalidatePath(`/meetings/${meetingId}/template`);
  revalidatePath(`/meetings/${meetingId}/planning`);
  revalidatePath("/admin/meeting-templates");
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
