"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { success: true } | { error: string };

export async function saveBishopricMinutes(meetingId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const field = (name: string) => String(formData.get(name) ?? "").trim() || null;

  const { error } = await supabase.from("bishopric_minutes").upsert(
    {
      meeting_id: meetingId,
      spiritual_thought_presenter_id: field("spiritual_thought_presenter_id"),
      spiritual_thought_notes: field("spiritual_thought_notes"),
      handbook_training_topic: field("handbook_training_topic"),
      handbook_training_presenter_id: field("handbook_training_presenter_id"),
      calendar_review_notes: field("calendar_review_notes"),
      callings_discussion_notes: field("callings_discussion_notes"),
      sacrament_planning_discussion_notes: field("sacrament_planning_discussion_notes"),
      young_men_coordination_notes: field("young_men_coordination_notes"),
      impressions: field("impressions"),
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
  const supabase = await createClient();

  const { error } = await supabase
    .from("meeting_action_items")
    .update({ completed: !completed })
    .eq("id", itemId);

  if (error) return { error: error.message };
  revalidatePath(`/meetings/${meetingId}`);
  return { success: true };
}

export async function addAgendaItemDirect(meetingId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!title) return { error: "Title is required." };

  const { error } = await supabase.from("agenda_items").insert({
    meeting_id: meetingId,
    title,
    body,
    submitted_by_name: "Bishopric",
    submitted_by_email: user?.email ?? "",
    status: "published",
  });

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

  const { error } = await supabase.from("agenda_items").update({ meeting_id: meetingId }).eq("id", itemId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  revalidatePath(`/meetings/${meetingId}/planning`);
  return { success: true };
}