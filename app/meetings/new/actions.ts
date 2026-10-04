"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { meetingFeature } from "@/lib/data/meeting-features";
import type { MeetingTypeSlug } from "@/lib/types";
import { applyRotationsToNewMeeting } from "@/lib/data/rotations";
import { seedPlannedElementsForMeeting } from "@/lib/data/meeting-elements";
import { seedSacramentProgramItemsForMeeting } from "@/lib/data/sacrament-program";

export type CreateMeetingState = { error?: string; existingMeetingId?: string };

export async function createMeeting(
  _prevState: CreateMeetingState,
  formData: FormData
): Promise<CreateMeetingState> {
  const { user, profile } = await getSessionUser();
  if (!user) return { error: "You must be signed in." };

  const meeting_type_id = formData.get("meeting_type_id") as string;
  const date = formData.get("date") as string;
  const time_of_day = (formData.get("time_of_day") as string) || null;
  const durationRaw = formData.get("duration_minutes") as string;
  const duration_minutes = durationRaw ? Number(durationRaw) : null;

  if (!meeting_type_id || !date) {
    return { error: "Choose a meeting type and a date." };
  }

  const supabase = await createClient();

  // Re-checked server-side against the SPECIFIC chosen type's planning
  // feature (2026-10-04, granular-features pass) -- the page's own
  // dropdown is already filtered to this, but a POST naming a type the
  // account has no planning feature for is rejected the same way, not
  // just hidden from the UI. Replaces the old blanket "bishopric" check
  // (itself only added 2026-10-03 as the first fix for this same gap).
  const { data: chosenType } = await supabase
    .from("meeting_types")
    .select("slug")
    .eq("id", meeting_type_id)
    .maybeSingle();
  if (!chosenType || !hasFeature(profile, meetingFeature(chosenType.slug as MeetingTypeSlug, "planning"))) {
    return { error: "Not authorized." };
  }

  // Guard against accidentally creating a second meeting for a date
  // that already has one (2026-10-03, the user's own report: "I
  // accidentally added a second sacrament meeting for a date that was
  // already planned... can we have a way to notify someone that they
  // are creating a meeting that is already there and that they can be
  // then be taken to that meeting planning?") -- surfaces the existing
  // meeting instead of silently creating a duplicate. Generate Meetings
  // (lib/data/meeting-schedule.ts) already has this same check built
  // in; this was the one creation path that didn't.
  const { data: existing } = await supabase
    .from("meetings")
    .select("id")
    .eq("meeting_type_id", meeting_type_id)
    .eq("date", date)
    .maybeSingle();
  if (existing) {
    return {
      error: "A meeting of this type already exists for this date.",
      existingMeetingId: existing.id,
    };
  }

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
  // Speakers & Music pre-fill by template (2026-09-10) -- see
  // seedSacramentProgramItemsForMeeting's own comment. Sacrament-only,
  // same as the special_format-driven seed just above.
  if (isSacrament) {
    await seedSacramentProgramItemsForMeeting(data.id, specialFormat);
  }

  // Straight to Planning (2026-10-03, "default to the planning view") --
  // skips the extra hop through the bare /meetings/[id] redirect.
  redirect(`/meetings/${data.id}/planning`);
}
