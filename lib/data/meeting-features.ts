import type { Feature } from "@/lib/supabase/get-session-user";
import type { MeetingTypeSlug } from "@/lib/types";

/**
 * Every meeting type has the same five granular actions (2026-10-04,
 * the user's own breakdown: "Sacrament Meeting viewing, Sacrament
 * Meeting Planning, Sacrament meeting template creation... Bishopric
 * Meeting agenda item adding, bishopric meeting note taking, and so on
 * for each meeting type"). This maps (type, action) to the exact
 * feature key migration `060` seeded, so nothing has to hardcode the
 * per-type string at each of the many call sites that need one --
 * `hasFeature(profile, meetingFeature(meeting.meetingType, "planning"))`
 * reads the same regardless of which of the four types it's actually
 * checking.
 */
const TYPE_PREFIX: Record<MeetingTypeSlug, string> = {
  "sacrament-meeting": "sacrament",
  "bishopric-meeting": "bishopric_meeting",
  "ward-council": "ward_council",
  "youth-council": "youth_council",
};

export type MeetingFeatureAction = "viewing" | "planning" | "template" | "agenda_items" | "notes";

export function meetingFeature(type: MeetingTypeSlug, action: MeetingFeatureAction): Feature {
  return `${TYPE_PREFIX[type]}_${action}` as Feature;
}

/** Every meeting type's version of one action, for a cross-cutting
 *  check that isn't scoped to one specific meeting yet (e.g. the
 *  Dashboard's "+ New Meeting" button, which doesn't know which type
 *  until the form is submitted) -- `hasAnyFeature(profile,
 *  allMeetingFeatures("planning"))` is "can plan at least one type." */
export function allMeetingFeatures(action: MeetingFeatureAction): Feature[] {
  return (Object.keys(TYPE_PREFIX) as MeetingTypeSlug[]).map((type) => meetingFeature(type, action));
}
