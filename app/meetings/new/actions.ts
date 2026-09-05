"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { applyRotationsToNewMeeting } from "@/lib/data/rotations";
import { seedPlannedElementsForMeeting } from "@/lib/data/meeting-elements";

export type CreateMeetingState = { error?: string };

export async function createMeeting(
  _prevState: CreateMeetingState,
  formData: FormData
): Promise<CreateMeetingState> {
  const meeting_type_id = formData.get("meeting_type_id") as string;
  const date = formData.get("date") as string;
  const time_of_day = (formData.get("time_of_day") as string) || null;
  const durationRaw = formData.get("duration_minutes") as string;
  const duration_minutes = durationRaw ? Number(durationRaw) : null;

  if (!meeting_type_id || !date) {
    return { error: "Choose a meeting type and a date." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meetings")
    .insert({ meeting_type_id, date, stage: "planning", time_of_day, duration_minutes })
    .select("id, meeting_types(slug)")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Could not create the meeting." };
  }

  const meetingType = Array.isArray(data.meeting_types) ? data.meeting_types[0] : data.meeting_types;
  const meetingTypeSlug = meetingType?.slug ?? "";
  const isSacrament = meetingTypeSlug === "sacrament-meeting";

  // For Sacrament Meeting, special_format is chosen up front (on this
  // form) rather than lazily on first Meeting Info save, so the correct
  // format-specific default template can be seeded immediately below.
  const specialFormat = isSacrament ? String(formData.get("special_format") ?? "standard") : "standard";
  if (isSacrament) {
    await supabase.from("sacrament_planning").insert({ meeting_id: data.id, special_format: specialFormat });
  }

  await applyRotationsToNewMeeting(data.id, meeting_type_id, meetingTypeSlug);
  await seedPlannedElementsForMeeting(data.id, meeting_type_id, isSacrament ? specialFormat : null);

  redirect(`/meetings/${data.id}`);
}
