"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { syncRotationMembership } from "@/lib/data/rotations";

type ActionResult = { success: true } | { error: string };

export async function syncRotation(rotationId: string): Promise<ActionResult> {
  const result = await syncRotationMembership(rotationId);
  if (result.error) return { error: result.error };
  revalidatePath("/rotations");
  return { success: true };
}

export async function addRotationMember(rotationId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const personId = String(formData.get("person_id") ?? "");
  if (!personId) return { error: "Choose a person." };

  const { data: existing } = await supabase
    .from("rotation_members")
    .select("sort_order")
    .eq("rotation_id", rotationId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

  const { error } = await supabase
    .from("rotation_members")
    .insert({ rotation_id: rotationId, person_id: personId, sort_order: nextOrder });

  if (error) return { error: error.message };
  revalidatePath("/rotations");
  return { success: true };
}

export async function removeRotationMember(memberId: string): Promise<ActionResult> {
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