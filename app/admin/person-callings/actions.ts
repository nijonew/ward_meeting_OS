"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";

type ActionResult = { error?: string; success?: boolean };

/**
 * Saves one person's complete set of held callings in a single submit
 * -- the checkbox-assignment UI the user asked for (2026-10-30):
 * "an assignable calling dropdown with the ability to assign multiple
 * callings by checkbox and have it cross reference with the callings
 * list." The inverse of Calling Features' own checklist (a calling's
 * many features, a real join table) rather than a direct reuse of it:
 * `callings.current_holder_id` is a single nullable FK per calling
 * row, not a join table, so checking a calling here can reassign it
 * away from whoever else currently holds it -- the page shows that
 * name next to the checkbox beforehand so it's never a surprise click.
 * (If the same calling genuinely needs more than one simultaneous
 * holder, add a second `callings` row with the same name -- the
 * established pattern this app already uses, e.g. "Stake High
 * Councilor (<area>)" -- rather than one row holding a list.)
 *
 * Diffs the checked set against which callings actually point at this
 * person right now and only touches what changed -- add the person to
 * newly-checked callings, clear newly-unchecked ones back to null
 * (guarded to only clear a calling that still points at this exact
 * person, so a concurrent reassignment elsewhere can't be stomped by
 * an unrelated save here). Either batch update can be rejected outright
 * by the `enforce_calling_handoff` trigger (migration 057) if it would
 * transfer a `requires_self_handoff`-flagged calling away from its
 * current holder without that holder's own authorization -- surfaced
 * here as a plain error, not swallowed.
 */
export async function savePersonCallings(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const { profile } = await getSessionUser();
  if (!hasFeature(profile, "table_admin_callings")) return { error: "Not authorized." };

  const personId = String(formData.get("person_id") ?? "");
  if (!personId) return { error: "Missing person." };

  const supabase = await createClient();

  const checked = new Set(formData.getAll("calling").map(String));

  const { data: heldRows, error: fetchError } = await supabase
    .from("callings")
    .select("id")
    .eq("current_holder_id", personId);
  if (fetchError) return { error: fetchError.message };

  const held = new Set((heldRows ?? []).map((r) => r.id as string));

  const toAdd = Array.from(checked).filter((id) => !held.has(id));
  const toRemove = Array.from(held).filter((id) => !checked.has(id));

  if (toAdd.length > 0) {
    const { error } = await supabase.from("callings").update({ current_holder_id: personId }).in("id", toAdd);
    if (error) return { error: error.message };
  }

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from("callings")
      .update({ current_holder_id: null })
      .in("id", toRemove)
      .eq("current_holder_id", personId);
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/person-callings");
  revalidatePath("/admin/people");
  revalidatePath("/admin/callings");
  revalidatePath("/callings");
  revalidatePath("/calling-planning");
  revalidatePath("/rotations");
  return { success: true };
}
