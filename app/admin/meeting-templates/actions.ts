"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { createClient } from "@/lib/supabase/server";
import { writeSortOrder } from "@/lib/data/reorder";

type ActionResult = { success: true } | { error: string };

/**
 * Every action here re-checks the role server-side rather than trusting
 * the page that rendered the button -- same enforcement-boundary pattern
 * as app/admin/[table]/actions.ts.
 */
async function requireMeetingTemplatesFeature(): Promise<ActionResult | null> {
  const { profile } = await getSessionUser();
  if (!hasFeature(profile, "meeting_templates_admin")) return { error: "Not authorized." };
  return null;
}

export async function addDefaultTemplateElement(
  meetingTypeId: string,
  formatKey: string | null,
  elementId: string
): Promise<ActionResult> {
  const denied = await requireMeetingTemplatesFeature();
  if (denied) return denied;

  const supabase = await createClient();

  let existingQuery = supabase
    .from("meeting_templates")
    .select("sort_order")
    .eq("meeting_type_id", meetingTypeId)
    .order("sort_order", { ascending: false })
    .limit(1);
  existingQuery = formatKey ? existingQuery.eq("format_key", formatKey) : existingQuery.is("format_key", null);
  const { data: existing } = await existingQuery;

  const nextSortOrder = existing && existing.length > 0 ? existing[0].sort_order + 10 : 10;

  const { data: element } = await supabase
    .from("meeting_elements")
    .select("repeatable")
    .eq("id", elementId)
    .single();

  const { error } = await supabase.from("meeting_templates").insert({
    meeting_type_id: meetingTypeId,
    format_key: formatKey,
    element_id: elementId,
    sort_order: nextSortOrder,
    slot_count: element?.repeatable ? 1 : null,
  });

  if (error) return { error: error.message };
  revalidatePath("/admin/meeting-templates");
  return { success: true };
}

export async function removeDefaultTemplateElement(templateRowId: string): Promise<ActionResult> {
  const denied = await requireMeetingTemplatesFeature();
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase.from("meeting_templates").delete().eq("id", templateRowId);

  if (error) return { error: error.message };
  revalidatePath("/admin/meeting-templates");
  return { success: true };
}

export async function setDefaultTemplateSlotCount(templateRowId: string, slotCount: number): Promise<ActionResult> {
  const denied = await requireMeetingTemplatesFeature();
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase.from("meeting_templates").update({ slot_count: slotCount }).eq("id", templateRowId);

  if (error) return { error: error.message };
  revalidatePath("/admin/meeting-templates");
  return { success: true };
}

/** Replaces the old swap-adjacent moveDefaultTemplateElement
 *  (2026-10-31, "apply broadly everywhere!") -- writes the whole new
 *  order at once, scoped by `meeting_type_id` + the nullable
 *  `format_key` (writeSortOrder's own `null`-aware scope handling). */
export async function setDefaultTemplateElementOrder(
  meetingTypeId: string,
  formatKey: string | null,
  orderedIds: string[]
): Promise<ActionResult> {
  const denied = await requireMeetingTemplatesFeature();
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await writeSortOrder(supabase, "meeting_templates", "id", orderedIds, {
    meeting_type_id: meetingTypeId,
    format_key: formatKey,
  });
  if (error) return { error };

  revalidatePath("/admin/meeting-templates");
  return { success: true };
}
