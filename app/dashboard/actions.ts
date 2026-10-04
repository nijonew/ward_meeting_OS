"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";

type ActionResult = { success: true } | { error: string };

async function requireBishopric(): Promise<{ userId: string } | ActionResult> {
  const { user, profile } = await getSessionUser();
  if (!user) return { error: "You must be signed in." };
  if (!hasFeature(profile, "bishopric")) return { error: "Not authorized." };
  return { userId: user.id };
}

/**
 * "Cancel a meeting from the dashboard" (Known open items) -- same
 * shape as youth_activities.cancelled/cancellation_note (migration
 * 032): shown, not hidden, independent of the planning-progress
 * `stage` field.
 *
 * **Bug fixed 2026-10-03, found while adding deleteMeeting below**:
 * this (and uncancelMeeting) had no server-side role check at all --
 * only the dashboard page's own `canManage` gate kept the Cancel/
 * Un-cancel controls out of a non-admin's view, the same gap already
 * found and fixed for several other actions earlier this session. Both
 * now re-check Bishopric server-side, matching every other role-gated
 * action in this app.
 */
export async function cancelMeeting(formData: FormData): Promise<ActionResult> {
  const auth = await requireBishopric();
  if (!("userId" in auth)) return auth;
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("cancellation_note") ?? "").trim() || null;
  if (!id) return { error: "Missing meeting id." };

  const { error } = await supabase
    .from("meetings")
    .update({ cancelled: true, cancellation_note: note })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { success: true };
}

export async function uncancelMeeting(id: string): Promise<ActionResult> {
  const auth = await requireBishopric();
  if (!("userId" in auth)) return auth;
  const supabase = await createClient();
  const { error } = await supabase
    .from("meetings")
    .update({ cancelled: false, cancellation_note: null })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * Permanently deletes a meeting and everything tied to it (migration
 * 054's `delete_meeting_cascade` function) -- distinct from Cancel,
 * which keeps the meeting on the calendar as "not to be held" (2026-10-03,
 * the user's own distinction: "The cancel button is for a meeting that
 * would normally be held but is not to be held... it is informational.
 * On the other hand I accidentally added a second sacrament meeting for
 * a date that was already planned. I want to be able to delete that
 * meeting"). Delete is for removing a meeting record outright -- a true
 * mistake (an accidental duplicate), not a real meeting that's simply
 * not happening this once.
 *
 * Deleting meeting A never touches meeting B's data even if they share
 * a date -- every related table (sacrament_assignments, sacrament_music,
 * meeting_planned_elements, etc.) is scoped by that specific meeting's
 * own `id`, never by date, so there's nothing to "impact" on the
 * meeting you actually want to keep. See the migration's own comment
 * for the exact list of tables this cleans up, and why it's a single
 * atomic Postgres function rather than a sequence of separate deletes
 * from here (a partial failure partway through 15 separate `.delete()`
 * calls could leave orphaned rows; one function call can't fail halfway).
 */
export async function deleteMeeting(id: string): Promise<ActionResult> {
  const auth = await requireBishopric();
  if (!("userId" in auth)) return auth;
  const supabase = await createClient();

  const { error } = await supabase.rpc("delete_meeting_cascade", { p_meeting_id: id });
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { success: true };
}
