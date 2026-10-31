"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";

type ActionResult = { success: true } | { error: string };

async function requirePeopleFeature(): Promise<ActionResult | null> {
  const { profile } = await getSessionUser();
  if (!hasFeature(profile, "table_admin_people")) return { error: "Not authorized." };
  return null;
}

function revalidateBoth() {
  revalidatePath("/admin/archived-people");
  revalidatePath("/admin/people");
}

/**
 * Un-archives a person -- clears `archived_at` only. Their calling
 * assignment(s) and login link were cleared at archive time
 * (`archive_person`) and are NOT restored automatically -- re-link
 * either one by hand (`/admin/person-callings`, `/admin/verify-logins`)
 * once they're back, same as setting either up for a brand-new person.
 */
export async function restorePerson(id: string): Promise<ActionResult> {
  const denied = await requirePeopleFeature();
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase.from("people").update({ archived_at: null }).eq("id", id);
  if (error) return { error: error.message };

  revalidateBoth();
  return { success: true };
}

/**
 * A genuine, permanent delete -- for an actual duplicate or mistake,
 * confirmed by the user (2026-10-30): "Yes, keep a real
 * permanent-delete option." This is a plain `DELETE`, not a cascade --
 * `people.id` is referenced by several other tables (speakers,
 * assignments, rotation members, teaching assignments, and more), none
 * of which this action tries to clean up first. A real Postgres foreign-
 * key error surfaces as-is rather than being swallowed, which is the
 * correct outcome here: it means this specific person is still
 * genuinely referenced somewhere real, and deleting them anyway would
 * silently orphan that data -- the much bigger "merge duplicate people"
 * feature (deliberately not built yet) is the real fix for that case,
 * not this button.
 */
export async function deletePersonPermanently(id: string): Promise<ActionResult> {
  const denied = await requirePeopleFeature();
  if (denied) return denied;

  const supabase = await createClient();
  const { error } = await supabase.from("people").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidateBoth();
  return { success: true };
}
