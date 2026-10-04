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
 * What calling_role_mappings (migration 057) would derive for this
 * person right now -- the highest-priority mapped calling among
 * whichever they currently hold, or null if none of their callings
 * have a real (non-null) mapped role. Mirrors
 * recompute_role_for_person's own query exactly, including filtering
 * out a null `role` -- every calling got a placeholder
 * calling_role_mappings row in the bulk seed (most left blank on
 * purpose), so a blank row must never be mistaken for "this calling
 * maps to nothing" vs. a real mapped one when picking by priority.
 * Kept as a plain select here (rather than calling that Postgres
 * function directly) because verifyLogin needs to *compare* this
 * against the admin's chosen role, not just blindly apply it.
 */
async function deriveRoleForPerson(supabase: Awaited<ReturnType<typeof createClient>>, personId: string): Promise<string | null> {
  const { data } = await supabase
    .from("callings")
    .select("calling_role_mappings(role, priority)")
    .eq("current_holder_id", personId);

  type Row = { calling_role_mappings: { role: string | null; priority: number }[] | { role: string | null; priority: number } | null };
  const mapped = ((data ?? []) as Row[])
    .map((row) => (Array.isArray(row.calling_role_mappings) ? row.calling_role_mappings[0] : row.calling_role_mappings))
    .filter((m): m is { role: string; priority: number } => m !== null && m.role !== null);

  if (mapped.length === 0) return null;
  mapped.sort((a, b) => a.priority - b.priority);
  return mapped[0].role;
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
 *
 * **Sets `profiles.role_source` (migration 057, 2026-10-04)**: compares
 * the admin's chosen role against what calling_role_mappings would
 * derive for the person just linked. A match means this grant lines up
 * with their actual calling, so it's tagged 'auto' -- this person WILL
 * get automatic role updates going forward if that calling's holder
 * changes. A deliberate override (the admin picked something the
 * mapping wouldn't have produced -- including "bishop", which the
 * mapping can never produce) is tagged 'manual', protected from ever
 * being silently overwritten by a later, unrelated calling change. See
 * that migration's own comment for the full reasoning.
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

  const derivedRole = linkedPersonId ? await deriveRoleForPerson(supabase, linkedPersonId) : null;
  const roleSource = derivedRole === role ? "auto" : "manual";

  const { error: roleError } = await supabase.from("profiles").update({ role, role_source: roleSource }).eq("id", profileId);
  if (roleError) return { error: roleError.message };

  revalidatePath("/admin/verify-logins");
  // The banner reads from AppHeader, which renders on nearly every
  // route -- "layout" revalidates it wherever it's currently mounted
  // rather than needing a path-by-path list.
  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * "Sync roles now" -- the manual catch-up for after a brand-new
 * calling_role_mappings row is added (adding that row alone doesn't
 * retroactively touch anyone already holding that calling, since
 * nothing fires a trigger on calling_role_mappings itself). Calls the
 * same Postgres function the trigger uses for every mapped calling at
 * once -- see migration 057's own comment.
 */
export async function syncAllCallingRoles(): Promise<ActionResult> {
  const profile = await requireAdminProfile();
  if (!profile) return { error: "Not authorized." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("sync_all_calling_roles");
  if (error) return { error: error.message };

  revalidatePath("/admin/verify-logins");
  revalidatePath("/", "layout");
  return { success: true };
}
