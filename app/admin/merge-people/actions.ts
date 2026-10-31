"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";

type MergeResult = { error?: string; success?: boolean };

/** Calls the merge_people() Postgres function (migration 096) --
 *  everything re-pointed and deleted there, atomically; this action is
 *  just the auth gate + the one RPC call. keep_id/remove_id are read
 *  from the submitted form, not trusted blindly -- merge_people itself
 *  also re-validates both ids exist and aren't the same before touching
 *  anything, so a stale/tampered submission fails loudly rather than
 *  doing something unexpected. */
export async function mergePeople(_prevState: unknown, formData: FormData): Promise<MergeResult> {
  const { profile } = await getSessionUser();
  if (!hasFeature(profile, "merge_people")) return { error: "Not authorized." };

  const keepId = String(formData.get("keep_id") ?? "");
  const removeId = String(formData.get("remove_id") ?? "");
  if (!keepId || !removeId) return { error: "Choose both people." };
  if (keepId === removeId) return { error: "Choose two different people." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("merge_people", { keep_id: keepId, remove_id: removeId });
  if (error) return { error: error.message };

  revalidatePath("/admin/merge-people");
  revalidatePath("/admin/archived-people");
  revalidatePath("/admin/person-callings");
  return { success: true };
}
