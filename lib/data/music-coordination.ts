import { createClient } from "@/lib/supabase/server";

const CORE_HYMN_TYPES = ["opening_hymn", "sacrament_hymn", "closing_hymn"];
const PRAYER_ROLES = ["opening_prayer", "closing_prayer"];

export interface MeetingMusicStatus {
  meeting_id: string;
  date: string;
  core_hymns_set: number; // out of 3 (opening/sacrament/closing)
  core_hymns_published: number;
  extra_music_count: number; // intermediate hymns + musical numbers, any status
  speakers_confirmed: number;
  speakers_total_slots_used: number; // slots with a speaker or guest name entered, any confirm status
  prayers_confirmed: number; // out of 2
}

/**
 * One row per upcoming (not-yet-archived) sacrament meeting, summarizing
 * music/speaker/prayer readiness so the Bishopric can see at a glance
 * what's still missing across several weeks without opening each
 * meeting's planning page individually. Editing still happens there --
 * this is a status overview, not a second editor.
 */
export async function getUpcomingMusicCoordination(limit = 8): Promise<MeetingMusicStatus[]> {
  const supabase = await createClient();

  const { data: sacramentType } = await supabase
    .from("meeting_types")
    .select("id")
    .eq("slug", "sacrament-meeting")
    .single();
  if (!sacramentType) return [];

  const { data: meetings } = await supabase
    .from("meetings")
    .select("id, date")
    .eq("meeting_type_id", sacramentType.id)
    .neq("stage", "archived")
    .order("date", { ascending: true })
    .limit(limit);
  if (!meetings || meetings.length === 0) return [];

  const meetingIds = meetings.map((m) => m.id);

  const [musicRes, assignmentsRes, adultsRes, youthRes] = await Promise.all([
    supabase.from("sacrament_music").select("meeting_id, type, status").in("meeting_id", meetingIds),
    supabase
      .from("sacrament_assignments")
      .select("meeting_id, role, confirmed")
      .in("meeting_id", meetingIds)
      .in("role", PRAYER_ROLES),
    supabase
      .from("sacrament_speakers_adults")
      .select("meeting_id, speaker_id, guest_speaker_name, confirmed")
      .in("meeting_id", meetingIds),
    supabase
      .from("sacrament_speakers_youth")
      .select("meeting_id, speaker_id, guest_speaker_name, confirmed")
      .in("meeting_id", meetingIds),
  ]);

  const music = (musicRes.data ?? []) as { meeting_id: string; type: string; status: string }[];
  const assignments = (assignmentsRes.data ?? []) as { meeting_id: string; role: string; confirmed: boolean }[];
  const adults = (adultsRes.data ?? []) as {
    meeting_id: string;
    speaker_id: string | null;
    guest_speaker_name: string | null;
    confirmed: boolean;
  }[];
  const youth = (youthRes.data ?? []) as {
    meeting_id: string;
    speaker_id: string | null;
    guest_speaker_name: string | null;
    confirmed: boolean;
  }[];

  return meetings.map((m) => {
    const meetingMusic = music.filter((row) => row.meeting_id === m.id);
    const coreMusic = meetingMusic.filter((row) => CORE_HYMN_TYPES.includes(row.type));
    const extraMusic = meetingMusic.filter((row) => !CORE_HYMN_TYPES.includes(row.type));

    const meetingPrayers = assignments.filter((row) => row.meeting_id === m.id);
    const meetingSpeakers = [
      ...adults.filter((row) => row.meeting_id === m.id),
      ...youth.filter((row) => row.meeting_id === m.id),
    ].filter((row) => row.speaker_id || row.guest_speaker_name);

    return {
      meeting_id: m.id,
      date: m.date,
      core_hymns_set: new Set(coreMusic.map((row) => row.type)).size,
      core_hymns_published: coreMusic.filter((row) => row.status === "published").length,
      extra_music_count: extraMusic.length,
      speakers_confirmed: meetingSpeakers.filter((row) => row.confirmed).length,
      speakers_total_slots_used: meetingSpeakers.length,
      prayers_confirmed: meetingPrayers.filter((row) => row.confirmed).length,
    };
  });
}