"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";

type ActionResult = { error?: string; success?: boolean };

/**
 * Saves one calling's complete feature set in a single submit --
 * purpose-built for the Calling Features checklist page, replacing the
 * "add a row per (calling, feature) pair" workflow Table Admin's raw
 * `calling_features` grid would otherwise require (thousands of rows
 * across every calling x ~58 features -- the user's own concern,
 * 2026-10-04).
 *
 * Diffs the submitted checked set against what's actually in
 * `calling_features` and only touches rows that changed (insert
 * newly-checked, delete newly-unchecked) rather than
 * delete-everything-then-reinsert, so a save never leaves the calling
 * with momentarily zero features granted partway through, and so an
 * unrelated concurrent read of this calling's features never sees a
 * false "nothing granted" gap.
 */
export async function saveCallingFeatures(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const { profile } = await getSessionUser();
  if (!hasFeature(profile, "table_admin_callings")) return { error: "Not authorized." };

  const callingId = String(formData.get("calling_id") ?? "");
  if (!callingId) return { error: "Missing calling." };

  const supabase = await createClient();

  const checked = new Set(formData.getAll("feature").map(String));

  const { data: existingRows, error: fetchError } = await supabase
    .from("calling_features")
    .select("feature_key")
    .eq("calling_id", callingId);

  if (fetchError) return { error: fetchError.message };

  const existing = new Set((existingRows ?? []).map((r) => r.feature_key as string));

  const toAdd = Array.from(checked).filter((key) => !existing.has(key));
  const toRemove = Array.from(existing).filter((key) => !checked.has(key));

  if (toAdd.length > 0) {
    const { error } = await supabase
      .from("calling_features")
      .insert(toAdd.map((feature_key) => ({ calling_id: callingId, feature_key })));
    if (error) return { error: error.message };
  }

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from("calling_features")
      .delete()
      .eq("calling_id", callingId)
      .in("feature_key", toRemove);
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/calling-features");
  return { success: true };
}
