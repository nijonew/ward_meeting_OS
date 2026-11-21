"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";

type ActionResult = { error?: string; success?: boolean };

/**
 * Looks up which features a DIFFERENT calling currently grants, for
 * the checklist's own "Import features from another calling" control
 * (2026-11-21, the user's own request: "can we create a tool... where
 * we can import the settings of another calling?"). Deliberately a
 * read, not a write -- it only hands the checked keys back to the
 * client, which pre-checks the on-screen checkboxes to match and
 * leaves the real save to the existing "Save Changes" button, so an
 * import can be reviewed (and un-checked where it shouldn't apply)
 * before anything actually changes in `calling_features`. Same
 * `table_admin_callings` gate as `saveCallingFeatures` -- reading
 * another calling's own grants is part of the same admin capability
 * as editing them.
 */
export async function getCallingFeatureKeysForImport(sourceCallingId: string): Promise<{ keys?: string[]; error?: string }> {
  const { profile } = await getSessionUser();
  if (!hasFeature(profile, "table_admin_callings")) return { error: "Not authorized." };
  if (!sourceCallingId) return { error: "Choose a calling to import from." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("calling_features").select("feature_key").eq("calling_id", sourceCallingId);
  if (error) return { error: error.message };

  return { keys: (data ?? []).map((r) => r.feature_key as string) };
}

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
