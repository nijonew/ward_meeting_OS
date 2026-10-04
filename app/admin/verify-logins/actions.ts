"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";

type ActionResult = { success: true } | { error: string };

async function requireAdmin(): Promise<ActionResult | null> {
  const { profile } = await getSessionUser();
  if (!hasFeature(profile, "verify_logins")) return { error: "Not authorized." };
  return null;
}

/**
 * Links a login to a person record (an existing one, or a brand-new
 * one created inline) -- the "Verify" action (2026-10-03), now just
 * this one linkage instead of two. Once roles were eliminated
 * (2026-10-04, the user's own request: "I want to eliminate roles. I
 * want the calling table to include a way to select the features that
 * are available to that calling"), there's no role left to pick here
 * at all -- access comes straight from whichever calling(s) the
 * linked person currently holds (see lib/supabase/get-session-user.ts).
 * Verifying someone is purely an identity-matching act now, not also a
 * permission grant.
 */
export async function verifyLogin(profileId: string, personId: string | null, newPersonName: string): Promise<ActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const supabase = await createClient();

  const trimmedName = newPersonName.trim();
  if (!personId && trimmedName) {
    const { error: insertError } = await supabase
      .from("people")
      .insert({ name: trimmedName, profile_id: profileId, active: true, attendance_status: "attending" });
    if (insertError) return { error: insertError.message };
  } else if (personId) {
    const { error: linkError } = await supabase.from("people").update({ profile_id: profileId }).eq("id", personId);
    if (linkError) return { error: linkError.message };
  } else {
    return { error: "Choose an existing person or enter a new name." };
  }

  revalidatePath("/admin/verify-logins");
  // The banner reads from AppHeader, which renders on nearly every
  // route -- "layout" revalidates it wherever it's currently mounted
  // rather than needing a path-by-path list.
  revalidatePath("/", "layout");
  return { success: true };
}
