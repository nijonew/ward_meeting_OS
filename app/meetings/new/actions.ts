"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { applyRotationsToNewMeeting } from "@/lib/data/rotations";

export type CreateMeetingState = { error?: string };

export async function createMeeting(
  _prevState: CreateMeetingState,
  formData: FormData
): Promise<CreateMeetingState> {
  const meeting_type_id = formData.get("meeting_type_id") as string;
  const date = formData.get("date") as string;

  if (!meeting_type_id || !date) {
    return { error: "Choose a meeting type and a date." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meetings")
    .insert({ meeting_type_id, date, stage: "planning" })
    .select("id, meeting_types(slug)")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Could not create the meeting." };
  }

  const meetingType = Array.isArray(data.meeting_types) ? data.meeting_types[0] : data.meeting_types;
  await applyRotationsToNewMeeting(data.id, meeting_type_id, meetingType?.slug ?? "");

  redirect(`/meetings/${data.id}`);
}