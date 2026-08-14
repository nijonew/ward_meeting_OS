"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { success: true } | { error: string };

export async function addTemplateElement(
  meetingId: string,
  meetingTypeId: string,
  elementId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("meeting_templates")
    .select("sort_order")
    .eq("meeting_type_id", meetingTypeId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextSortOrder = existing && existing.length > 0 ? existing[0].sort_order + 10 : 10;

  const { data: element } = await supabase
    .from("meeting_elements")
    .select("repeatable")
    .eq("id", elementId)
    .single();

  const { error } = await supabase.from("meeting_templates").insert({
    meeting_type_id: meetingTypeId,
    element_id: elementId,
    sort_order: nextSortOrder,
    slot_count: element?.repeatable ? 1 : null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/meetings/${meetingId}/template`);
  return { success: true };
}

export async function removeTemplateElement(meetingId: string, templateRowId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("meeting_templates").delete().eq("id", templateRowId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/meetings/${meetingId}/template`);
  return { success: true };
}

export async function setTemplateSlotCount(
  meetingId: string,
  templateRowId: string,
  slotCount: number
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("meeting_templates")
    .update({ slot_count: slotCount })
    .eq("id", templateRowId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/meetings/${meetingId}/template`);
  return { success: true };
}

export async function moveTemplateElement(
  meetingId: string,
  meetingTypeId: string,
  templateRowId: string,
  direction: "up" | "down"
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("meeting_templates")
    .select("id, sort_order")
    .eq("meeting_type_id", meetingTypeId)
    .order("sort_order", { ascending: true });

  if (!rows) {
    return { error: "Could not load template." };
  }

  const index = rows.findIndex((r) => r.id === templateRowId);
  if (index === -1) {
    return { error: "Element not found in template." };
  }

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= rows.length) {
    return { success: true };
  }

  const current = rows[index];
  const swap = rows[swapIndex];

  const { error: error1 } = await supabase
    .from("meeting_templates")
    .update({ sort_order: swap.sort_order })
    .eq("id", current.id);
  const { error: error2 } = await supabase
    .from("meeting_templates")
    .update({ sort_order: current.sort_order })
    .eq("id", swap.id);

  if (error1 || error2) {
    return { error: error1?.message ?? error2?.message ?? "Could not reorder." };
  }

  revalidatePath(`/meetings/${meetingId}/template`);
  return { success: true };
}