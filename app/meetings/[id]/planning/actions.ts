"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ASSIGNMENT_ROLES, SPEAKER_SLOTS_ADULT, SPEAKER_SLOTS_YOUTH } from "@/lib/data/sacrament-constants";

type ActionResult = { success: true } | { error: string };

export async function savePlanningInfo(meetingId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = await supabase.from("sacrament_planning").upsert(
    {
      meeting_id: meetingId,
      special_format: String(formData.get("special_format") ?? "standard"),
      ward_business: String(formData.get("ward_business") ?? "").trim() || null,
      stake_business: String(formData.get("stake_business") ?? "").trim() || null,
      recognitions: String(formData.get("recognitions") ?? "").trim() || null,
      hidden_notes: String(formData.get("hidden_notes") ?? "").trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "meeting_id" }
  );

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/meetings/${meetingId}/planning`);
  return { success: true };
}

export async function saveAssignments(meetingId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const rows = ASSIGNMENT_ROLES.map(({ value }) => ({
    meeting_id: meetingId,
    role: value,
    assigned_to_id: String(formData.get(`assigned_${value}`) ?? "") || null,
    confirmed: formData.get(`confirmed_${value}`) === "on",
  })).filter((row) => row.assigned_to_id !== null);

  const { error: deleteError } = await supabase
    .from("sacrament_assignments")
    .delete()
    .eq("meeting_id", meetingId);
  if (deleteError) {
    return { error: deleteError.message };
  }

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from("sacrament_assignments").insert(rows);
    if (insertError) {
      return { error: insertError.message };
    }
  }

  revalidatePath(`/meetings/${meetingId}/planning`);
  return { success: true };
}

async function saveSpeakers(
  table: "sacrament_speakers_adults" | "sacrament_speakers_youth",
  slots: readonly string[],
  meetingId: string,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();

  const rows = slots
    .map((slot) => {
      const speakerId = String(formData.get(`${slot}_speaker_id`) ?? "");
      const guestName = String(formData.get(`${slot}_guest_name`) ?? "").trim();
      const topic = String(formData.get(`${slot}_topic`) ?? "").trim();
      const duration = String(formData.get(`${slot}_duration`) ?? "").trim();
      const confirmed = formData.get(`${slot}_confirmed`) === "on";

      if (!speakerId && !guestName && !topic) {
        return null; // nothing entered for this slot -- skip it
      }

      return {
        meeting_id: meetingId,
        slot,
        speaker_id: speakerId || null,
        guest_speaker_name: guestName || null,
        topic: topic || null,
        duration: duration || null,
        confirmed,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const { error: deleteError } = await supabase.from(table).delete().eq("meeting_id", meetingId);
  if (deleteError) {
    return { error: deleteError.message };
  }

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from(table).insert(rows);
    if (insertError) {
      return { error: insertError.message };
    }
  }

  return { success: true };
}

export async function saveAdultSpeakers(meetingId: string, formData: FormData): Promise<ActionResult> {
  const result = await saveSpeakers(
    "sacrament_speakers_adults",
    SPEAKER_SLOTS_ADULT,
    meetingId,
    formData
  );
  revalidatePath(`/meetings/${meetingId}/planning`);
  return result;
}

export async function saveYouthSpeakers(meetingId: string, formData: FormData): Promise<ActionResult> {
  const result = await saveSpeakers(
    "sacrament_speakers_youth",
    SPEAKER_SLOTS_YOUTH,
    meetingId,
    formData
  );
  revalidatePath(`/meetings/${meetingId}/planning`);
  return result;
}

export async function addRabnmItem(meetingId: string, formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();

  const type = String(formData.get("type") ?? "");
  const callingId = String(formData.get("calling_id") ?? "");
  const detail = String(formData.get("detail") ?? "").trim();
  const eventDate = String(formData.get("event_date") ?? "");
  const personIds = formData
    .getAll("person_ids")
    .map(String)
    .filter(Boolean);

  if (!type) {
    return { error: "Choose a type." };
  }

  const { data: rabnm, error } = await supabase
    .from("sacrament_rabnm")
    .insert({
      meeting_id: meetingId,
      type,
      calling_id: callingId || null,
      detail: detail || null,
      event_date: eventDate || null,
    })
    .select("id")
    .single();

  if (error || !rabnm) {
    return { error: error?.message ?? "Could not save." };
  }

  if (personIds.length > 0) {
    const { error: peopleError } = await supabase
      .from("sacrament_rabnm_people")
      .insert(personIds.map((personId) => ({ rabnm_id: rabnm.id, person_id: personId })));

    if (peopleError) {
      return { error: peopleError.message };
    }
  }

  revalidatePath(`/meetings/${meetingId}/planning`);
  return { success: true };
}

export async function deleteRabnmItem(rabnmId: string, meetingId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("sacrament_rabnm").delete().eq("id", rabnmId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/meetings/${meetingId}/planning`);
  return { success: true };
}

export async function arrangeMusicItem(
  musicId: string,
  meetingId: string,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();

  const slot = String(formData.get("slot") ?? "");
  const publish = formData.get("publish") === "on";

  const { error } = await supabase
    .from("sacrament_music")
    .update({
      slot: slot || null,
      status: publish ? "published" : "pending",
    })
    .eq("id", musicId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/meetings/${meetingId}/planning`);
  return { success: true };
}
