"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, type SessionProfile, type StoredRole } from "@/lib/supabase/get-session-user";

type ActionResult = { success: true } | { error: string };

async function requireAdminProfile(): Promise<SessionProfile | null> {
  const { profile } = await getSessionUser();
  if (profile?.role !== "bishopric") return null;
  return profile;
}

/**
 * Links a login to a person record (an existing one, or a brand-new
 * one created inline) and sets its role -- the "Verify" action
 * (2026-10-03), bundling the two linkages described in
 * PROJECT_CONTEXT.md's Architecture section into one admin screen
 * instead of two separate manual steps (Supabase dashboard for role,
 * Table Admin for the person link).
 *
 * `role: "bishop"` is the one restricted case: only a sitting Bishop
 * (profile.isBishop, not just any bishopric-equivalent account) can
 * grant it to a successor -- re-checked here, not just hidden from the
 * UI's own role dropdown, matching this app's established
 * enforcement-boundary pattern for every other role-gated action.
 */
export async function verifyLogin(
  profileId: string,
  role: StoredRole,
  personId: string | null,
  newPersonName: string
): Promise<ActionResult> {
  const profile = await requireAdminProfile();
  if (!profile) return { error: "Not authorized." };

  if (role === "bishop" && !profile.isBishop) {
    return { error: "Only the current Bishop can grant the Bishop role." };
  }

  const supabase = await createClient();

  let linkedPersonId = personId;
  const trimmedName = newPersonName.trim();
  if (!linkedPersonId && trimmedName) {
    const { data: newPerson, error: insertError } = await supabase
      .from("people")
      .insert({ name: trimmedName, profile_id: profileId, active: true, attendance_status: "attending" })
      .select("id")
      .single();
    if (insertError || !newPerson) return { error: insertError?.message ?? "Could not create that person." };
    linkedPersonId = newPerson.id;
  } else if (linkedPersonId) {
    const { error: linkError } = await supabase.from("people").update({ profile_id: profileId }).eq("id", linkedPersonId);
    if (linkError) return { error: linkError.message };
  }

  const { error: roleError } = await supabase.from("profiles").update({ role }).eq("id", profileId);
  if (roleError) return { error: roleError.message };

  revalidatePath("/admin/verify-logins");
  // The banner reads from AppHeader, which renders on nearly every
  // route -- "layout" revalidates it wherever it's currently mounted
  // rather than needing a path-by-path list.
  revalidatePath("/", "layout");
  return { success: true };
}
