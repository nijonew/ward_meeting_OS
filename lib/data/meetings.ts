import { createClient } from "@/lib/supabase/server";
import type { Meeting, MeetingLifecycleStage, MeetingType, MeetingTypeSlug } from "@/lib/types";

// NOTE: no generated Database types are wired up yet (would need the
// Supabase CLI), so these queries are loosely typed at the client level.
// The functions below map raw rows into the app's existing Meeting /
// MeetingType shapes so nothing downstream (LifecycleBadge, dashboard
// rendering, etc.) has to change.

export async function getMeetingTypes(): Promise<MeetingType[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("meeting_types").select("slug, name").order("name");

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    slug: row.slug as MeetingTypeSlug,
    name: row.name as string,
    isBuilt: row.slug === "sacrament-meeting" || row.slug === "bishopric-meeting",
  }));
}

function mapMeetingRow(row: {
  id: string;
  date: string;
  stage: string;
  meeting_types: { slug: string; name: string }[] | { slug: string; name: string } | null;
}): Meeting {
  const meetingType = Array.isArray(row.meeting_types) ? row.meeting_types[0] : row.meeting_types;

  return {
    id: row.id,
    meetingType: (meetingType?.slug ?? "sacrament-meeting") as MeetingTypeSlug,
    title: meetingType?.name ?? "Meeting",
    date: row.date,
    stage: row.stage as MeetingLifecycleStage,
  };
}

export async function getUpcomingMeetings(): Promise<Meeting[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meetings")
    .select("id, date, stage, meeting_types(slug, name)")
    .order("date", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map(mapMeetingRow);
}

export async function getUpcomingMeeting(): Promise<Meeting | null> {
  const meetings = await getUpcomingMeetings();
  return meetings.find((m) => m.meetingType === "sacrament-meeting") ?? meetings[0] ?? null;
}

export async function getMeetingById(id: string): Promise<Meeting | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meetings")
    .select("id, date, stage, meeting_types(slug, name)")
    .eq("id", id)
    .single();

  if (error || !data) {
    return null;
  }

  return mapMeetingRow(data);
}
