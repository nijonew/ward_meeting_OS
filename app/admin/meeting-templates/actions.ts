"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { success: true } | { error: string };

/**
 * Every action here re-checks the role server-side rather than trusting
 * the page that rendered the button -- same enforcement-boundary pattern
 * as app/admin/[table]/actions.ts.
 */
async function requireBishopric(): Promise<ActionResult | null> {
  const { profile } = await getSessionUser();
  if (profile?.role !== "bishopric") return { error: "Not authorized." };
  return null;
}

export async function addDefaultTemplateElement(
  meetingTypeId: string,
  formatKey: string | null,
  elementId: string
): Promise<ActionResult> {
  const denied = await requireBishopric();
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
  const denied = await requireBishopric();
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase.from("meeting_templates").delete().eq("id", templateRowId);

  if (error) return { error: error.message };
  revalidatePath("/admin/meeting-templates");
  return { success: true };
}

export async function setDefaultTemplateSlotCount(templateRowId: string, slotCount: number): Promise<ActionResult> {
  const denied = await requireBishopric();
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase.from("meeting_templates").update({ slot_count: slotCount }).eq("id", templateRowId);

  if (error) return { error: error.message };
  revalidatePath("/admin/meeting-templates");
  return { success: true };
}

export async function moveDefaultTemplateElement(
  meetingTypeId: string,
  formatKey: string | null,
  templateRowId: string,
  direction: "up" | "down"
): Promise<ActionResult> {
  const denied = await requireBishopric();
  if (denied) return denied;

  const supabase = await createClient();

  let rowsQuery = supabase
    .from("meeting_templates")
    .select("id, sort_order")
    .eq("meeting_type_id", meetingTypeId)
    .order("sort_order", { ascending: true });
  rowsQuery = formatKey ? rowsQuery.eq("format_key", formatKey) : rowsQuery.is("format_key", null);
  const { data: rows } = await rowsQuery;

  if (!rows) return { error: "Could not load template." };

  const index = rows.findIndex((r) => r.id === templateRowId);
  if (index === -1) return { error: "Element not found in template." };

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= rows.length) return { success: true };

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

  if (error1 || error2) return { error: error1?.message ?? error2?.message ?? "Could not reorder." };
  revalidatePath("/admin/meeting-templates");
  return { success: true };
}
