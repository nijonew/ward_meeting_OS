import { createClient } from "@/lib/supabase/server";
import { sweepPastAnnouncements } from "@/lib/data/announcements";
import { ANNOUNCEMENT_WHERE, MEETING_TYPE_ANNOUNCEMENT_LABEL, MULTI_SELECT_SEPARATOR } from "@/lib/data/announcement-constants";
import type { MeetingTypeSlug } from "@/lib/types";

export interface ReviewAnnouncement {
  id: string;
  title: string;
  body: string;
}

export interface PreviousMeetingMinutes {
  date: string;
  text: string;
}

type CollaborativeMeetingTypeSlug = "bishopric-meeting" | "ward-council" | "youth-council";

function isCollaborativeType(slug: MeetingTypeSlug): slug is CollaborativeMeetingTypeSlug {
  return slug === "bishopric-meeting" || slug === "ward-council" || slug === "youth-council";
}

/**
 * Whether a comma-joined `where_announced` value includes `label` --
 * same ordered-prefix-matching approach as `AdminTableEditor.tsx`'s own
 * `parseMultiSelectValue` (needed there for the identical reason: one
 * real option's own label contains the separator, "Ward Communications
 * (Printed, Weekly Email, Social Media, etc.)", so a naive
 * `.split(", ")` would fracture it). Kept as its own small copy here
 * rather than importing that function directly -- it takes
 * `AdminOption[]` ({value, label} pairs) where this only ever has a
 * plain `ANNOUNCEMENT_WHERE` string list to check against.
 */
function whereAnnouncedIncludes(raw: string | null, label: string, allValues: readonly string[]): boolean {
  if (!raw) return false;
  let remaining = raw;
  for (const value of allValues) {
    if (remaining === value) {
      return value === label;
    }
    if (remaining.startsWith(`${value}${MULTI_SELECT_SEPARATOR}`)) {
      if (value === label) return true;
      remaining = remaining.slice(value.length + MULTI_SELECT_SEPARATOR.length);
    }
  }
  return false;
}

/**
 * Review section content #1 (2026-10-19, the user's own design): an
 * announcement shows up in a collaborative meeting's Review section
 * automatically whenever this meeting type's own label is checked in
 * the announcement's "Where should this be announced?" field -- no
 * pull/consume mechanism, no join table, unlike Sacrament Meeting's own
 * Announcements block (lib/data/sacrament-announcements.ts), which is a
 * genuinely different, explicit-pull design. Read-only everywhere it
 * renders.
 */
export async function getAnnouncementsForMeetingReview(meetingType: MeetingTypeSlug): Promise<ReviewAnnouncement[]> {
  if (!isCollaborativeType(meetingType)) return [];
  const label = MEETING_TYPE_ANNOUNCEMENT_LABEL[meetingType];

  await sweepPastAnnouncements();
  const supabase = await createClient();
  const { data } = await supabase
    .from("announcements")
    .select("id, title, body, where_announced")
    .eq("status", "published")
    .order("created_at", { ascending: false });

  return ((data ?? []) as { id: string; title: string; body: string; where_announced: string | null }[])
    .filter((row) => whereAnnouncedIncludes(row.where_announced, label, ANNOUNCEMENT_WHERE))
    .map((row) => ({ id: row.id, title: row.title, body: row.body }));
}

/**
 * Review section content #2: just the general Minutes summary from the
 * most recent earlier meeting of the same type (the user's own
 * confirmation: "Just the general Minutes summary," not a deeper
 * breakdown). Bishopric Meeting reads `bishopric_minutes.minutes_body`;
 * Ward Council/Youth Council read `council_notes.notes` -- both are
 * the same "General Minutes"/"Notes" field BishopricMinutesForm/
 * CouncilNotesForm already save. Read-only here regardless.
 */
export async function getPreviousMeetingMinutes(
  meetingType: MeetingTypeSlug,
  beforeDateIso: string
): Promise<PreviousMeetingMinutes | null> {
  if (!isCollaborativeType(meetingType)) return null;
  const supabase = await createClient();

  const { data: meetingRow } = await supabase
    .from("meetings")
    .select("id, date, meeting_type_id, meeting_types!inner(slug)")
    .eq("meeting_types.slug", meetingType)
    .lt("date", beforeDateIso)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!meetingRow) return null;

  if (meetingType === "bishopric-meeting") {
    const { data } = await supabase
      .from("bishopric_minutes")
      .select("minutes_body")
      .eq("meeting_id", meetingRow.id)
      .maybeSingle();
    if (!data?.minutes_body) return null;
    return { date: meetingRow.date, text: data.minutes_body };
  }

  const { data } = await supabase
    .from("council_notes")
    .select("notes")
    .eq("meeting_id", meetingRow.id)
    .maybeSingle();
  if (!data?.notes) return null;
  return { date: meetingRow.date, text: data.notes };
}
