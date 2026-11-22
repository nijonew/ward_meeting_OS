"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMeetingFeature } from "@/lib/data/meeting-auth";
import { writeSortOrder } from "@/lib/data/reorder";
import { nextAgendaItemSortOrder } from "@/lib/data/bishopric-meeting";

type ActionResult = { success: true } | { error: string };

/**
 * Only ever writes `minutes_body`/`next_meeting_date` -- the two fields
 * BishopricMinutesForm still renders (2026-10-19, consolidated down
 * from 9). Deliberately does NOT include the other seven columns
 * (spiritual_thought_*, handbook_training_*, calendar_review_notes,
 * etc.) in this upsert at all -- they're no longer submitted by the
 * form, and including them as `null` here would silently wipe out any
 * historical data still sitting in those columns on every save.
 */
// Widened to a non-strict shape rather than the shared `ActionResult`
// union (2026-11-01) -- `useActionState`'s own `initialState` ({}) must
// be assignable to this function's return type, which a strict
// `{ success: true } | { error: string }` union rejects (same reason
// AgendaGridForm's own saveAgendaGrid uses an equivalent loose local
// type, SaveGridActionResult, rather than a stricter one). The actual
// `return` statements below are unchanged.
export async function saveBishopricMinutes(
  meetingId: string,
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  // Re-checked here now (2026-11-05) -- this form also renders from
  // the Archived page's "Edit Notes" unlock, reachable by an account
  // that holds the `notes` feature but not `planning`, so the old
  // "the UI path is already gated" assumption no longer holds. See
  // lib/data/meeting-auth.ts's own doc comment.
  const authError = await requireMeetingFeature(meetingId, "notes");
  if (authError) return authError;

  const supabase = await createClient();

  const field = (name: string) => String(formData.get(name) ?? "").trim() || null;

  const { error } = await supabase.from("bishopric_minutes").upsert(
    {
      meeting_id: meetingId,
      minutes_body: field("minutes_body"),
      next_meeting_date: field("next_meeting_date"),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "meeting_id" }
  );

  if (error) return { error: error.message };
  revalidatePath(`/meetings/${meetingId}`);
  return { success: true };
}

export async function saveBishopricAssignments(meetingId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const rows = ["opening_prayer", "closing_prayer"]
    .map((role) => ({
      meeting_id: meetingId,
      role,
      assigned_to_id: String(formData.get(`assigned_${role}`) ?? "") || null,
    }))
    .filter((row) => row.assigned_to_id !== null);

  const { error: deleteError } = await supabase
    .from("bishopric_assignments")
    .delete()
    .eq("meeting_id", meetingId);
  if (deleteError) return { error: deleteError.message };

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from("bishopric_assignments").insert(rows);
    if (insertError) return { error: insertError.message };
  }

  revalidatePath(`/meetings/${meetingId}`);
  return { success: true };
}

export async function addActionItem(meetingId: string, formData: FormData): Promise<ActionResult> {
  // Same re-check as saveBishopricMinutes, same reason -- also
  // reachable now from the Archived page's "Edit Notes" unlock.
  const authError = await requireMeetingFeature(meetingId, "notes");
  if (authError) return authError;

  const supabase = await createClient();

  const description = String(formData.get("description") ?? "").trim();
  if (!description) return { error: "Description is required." };

  const { error } = await supabase.from("meeting_action_items").insert({
    meeting_id: meetingId,
    description,
    assigned_to_id: String(formData.get("assigned_to_id") ?? "") || null,
    due_date: String(formData.get("due_date") ?? "") || null,
  });

  if (error) return { error: error.message };
  revalidatePath(`/meetings/${meetingId}`);
  return { success: true };
}

export async function toggleActionItem(itemId: string, meetingId: string, completed: boolean): Promise<ActionResult> {
  // Same re-check as saveBishopricMinutes, same reason -- also
  // reachable now from the Archived page's "Edit Notes" unlock.
  const authError = await requireMeetingFeature(meetingId, "notes");
  if (authError) return authError;

  const supabase = await createClient();

  const { error } = await supabase
    .from("meeting_action_items")
    .update({ completed: !completed })
    .eq("id", itemId);

  if (error) return { error: error.message };
  revalidatePath(`/meetings/${meetingId}`);
  return { success: true };
}

/**
 * Per-item notes for an agenda item, rendered inline in the Discussion
 * section (2026-10-19, migration 078's new `agenda_items.notes` column)
 * -- replaces the old single notes block at the bottom of the page.
 */
export async function saveAgendaItemNotes(itemId: string, meetingId: string, notes: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("agenda_items")
    .update({ notes: notes.trim() || null })
    .eq("id", itemId);

  if (error) return { error: error.message };
  revalidatePath(`/meetings/${meetingId}`);
  return { success: true };
}

export async function setAgendaItemStatus(
  itemId: string,
  meetingId: string,
  status: "published" | "archived"
): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase.from("agenda_items").update({ status }).eq("id", itemId);

  if (error) return { error: error.message };
  revalidatePath(`/meetings/${meetingId}`);
  return { success: true };
}

/**
 * Assigns a publicly-submitted agenda item (no meeting_id yet) to a
 * specific meeting -- from here it shows up in that meeting's own
 * Agenda Items section for the usual publish/archive review.
 */
export async function assignAgendaItemToMeeting(itemId: string, meetingId: string): Promise<ActionResult> {
  const supabase = await createClient();

  // An unassigned item has never had a sort_order (getUnassignedAgendaItems
  // doesn't order by one) -- lands at the end of its new meeting's list,
  // 2026-11-22, same as every other agenda item that just got a
  // meeting_id for the first time.
  const { error } = await supabase
    .from("agenda_items")
    .update({ meeting_id: meetingId, sort_order: await nextAgendaItemSortOrder(meetingId) })
    .eq("id", itemId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  revalidatePath(`/meetings/${meetingId}/planning`);
  return { success: true };
}

/**
 * Carries a PAST agenda item forward onto today's meeting (2026-11-15,
 * the user's own request: "add past meeting agenda items by dropdown
 * in non-sacrament meetings") -- deliberately a COPY, not a move
 * (unlike `assignAgendaItemToMeeting` above, which really does
 * reassign an item that never had a meeting at all). Moving the
 * original row's own `meeting_id` would quietly rewrite a past --
 * likely already-archived -- meeting's own finalized agenda, which
 * this app's own Vision document explicitly treats as a frozen
 * historical record. A new row, referencing today's meeting, leaves
 * the original exactly where it was; if the same stuck item needs
 * raising again at a THIRD meeting later, it's still sitting there in
 * the past-items dropdown to carry forward again.
 */
export async function addPastAgendaItemToMeeting(pastItemId: string, meetingId: string): Promise<ActionResult> {
  const authError = await requireMeetingFeature(meetingId, "agenda_items");
  if (authError) return authError;

  const supabase = await createClient();

  const { data: source, error: fetchError } = await supabase
    .from("agenda_items")
    .select("title, body, submitted_by_name, submitted_by_email, time_needed")
    .eq("id", pastItemId)
    .maybeSingle();
  if (fetchError || !source) return { error: "Could not find that agenda item." };

  const { error } = await supabase.from("agenda_items").insert({
    ...source,
    meeting_id: meetingId,
    status: "published",
    sort_order: await nextAgendaItemSortOrder(meetingId),
  });

  if (error) return { error: error.message };
  revalidatePath(`/meetings/${meetingId}/planning`);
  return { success: true };
}

/**
 * Drag-handle reorder for a meeting's own Agenda Items list
 * (2026-11-22, the user's own request: "I would like to have a way to
 * reorder agenda items with a handle like we have done in other
 * meetings. Please make this ubiquitous in all non-sacrament
 * meetings.") -- same shape as every other drag-reorderable list in
 * this app since 2026-10-31 (`setAnnouncementPullOrder`,
 * `moveTemplateElement`'s own successor, etc.): writes the whole new
 * order at once via the shared `writeSortOrder` helper, scoped to this
 * one meeting's own rows so a client can never reorder a different
 * meeting's items by forging an id it was never shown.
 *
 * Gated on the `agenda_items` feature, not just the page's own broader
 * `planning` gate -- same as `addPastAgendaItemToMeeting`, the other
 * recently-added action in this file: this is new code with no
 * "the UI path is already gated" precedent to lean on, so it starts
 * checked, matching this file's own documented caution about the
 * older, still-unchecked actions above.
 */
export async function setAgendaItemOrder(meetingId: string, orderedIds: string[]): Promise<ActionResult> {
  const authError = await requireMeetingFeature(meetingId, "agenda_items");
  if (authError) return authError;

  const supabase = await createClient();
  const { error } = await writeSortOrder(supabase, "agenda_items", "id", orderedIds, { meeting_id: meetingId });
  if (error) return { error };

  revalidatePath(`/meetings/${meetingId}/planning`);
  return { success: true };
}

/**
 * Drag-handle reorder for the Review section's own announcements list
 * (2026-11-22, same request as `setAgendaItemOrder` above: "Same with
 * announcements"). Unlike Sacrament Meeting's explicit-pull Announcements
 * block, Review's list has no membership of its own to reorder directly
 * -- `collaborative_announcement_order` (migration 110) is a pure
 * per-meeting order override, lazily populated by
 * `getAnnouncementsForMeetingReview` itself (lib/data/meeting-review.ts)
 * before this ever gets called, so by drag time every currently-shown
 * announcement already has a row here for `writeSortOrder`'s own
 * UPDATE-only write to land on.
 *
 * Gated on `planning`, not a narrower action -- Review has no feature
 * of its own, and only an account holding this meeting type's own
 * planning feature ever reaches the Planning page this control lives
 * on in the first place.
 */
export async function setReviewAnnouncementOrder(meetingId: string, orderedIds: string[]): Promise<ActionResult> {
  const authError = await requireMeetingFeature(meetingId, "planning");
  if (authError) return authError;

  const supabase = await createClient();
  const { error } = await writeSortOrder(supabase, "collaborative_announcement_order", "announcement_id", orderedIds, {
    meeting_id: meetingId,
  });
  if (error) return { error };

  revalidatePath(`/meetings/${meetingId}/planning`);
  return { success: true };
}