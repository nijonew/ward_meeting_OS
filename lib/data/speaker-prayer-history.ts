import { createClient } from "@/lib/supabase/server";

export interface HistoryEntry {
  meeting_id: string;
  date: string;
  person_id: string | null;
  person_name: string; // resolved name, or the guest's name for non-ward speakers
  role: "Opening Prayer" | "Closing Prayer" | "Speaker" | "Youth Speaker";
  topic: string | null;
}

export interface DueEntry {
  person_id: string;
  person_name: string;
  last_date: string | null; // null = never on record
}

/**
 * Every prayer/speaker assignment from ARCHIVED sacrament meetings only
 * -- meetings still in planning/ready/live can still change, so they're
 * excluded until the record is final. Confirmed=false rows are excluded
 * too (never actually happened as planned).
 */
export async function getSpeakerPrayerHistory(): Promise<HistoryEntry[]> {
  const supabase = await createClient();

  const { data: sacramentType } = await supabase
    .from("meeting_types")
    .select("id")
    .eq("slug", "sacrament-meeting")
    .single();
  if (!sacramentType) return [];

  const { data: archivedMeetings } = await supabase
    .from("meetings")
    .select("id, date")
    .eq("meeting_type_id", sacramentType.id)
    .eq("stage", "archived");
  if (!archivedMeetings || archivedMeetings.length === 0) return [];

  const dateByMeeting = new Map(archivedMeetings.map((m) => [m.id, m.date]));
  const meetingIds = archivedMeetings.map((m) => m.id);

  const [assignmentsRes, adultsRes, youthRes, peopleRes] = await Promise.all([
    supabase
      .from("sacrament_assignments")
      .select("meeting_id, role, assigned_to_id, confirmed")
      .in("meeting_id", meetingIds)
      .in("role", ["opening_prayer", "closing_prayer"])
      .eq("confirmed", true),
    supabase
      .from("sacrament_speakers_adults")
      .select("meeting_id, speaker_id, guest_speaker_name, topic, confirmed")
      .in("meeting_id", meetingIds)
      .eq("confirmed", true),
    supabase
      .from("sacrament_speakers_youth")
      .select("meeting_id, speaker_id, guest_speaker_name, topic, confirmed")
      .in("meeting_id", meetingIds)
      .eq("confirmed", true),
    supabase.from("people").select("id, name"),
  ]);

  const nameById = new Map(((peopleRes.data ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));

  const entries: HistoryEntry[] = [];

  for (const row of (assignmentsRes.data ?? []) as { meeting_id: string; role: string; assigned_to_id: string | null }[]) {
    if (!row.assigned_to_id) continue;
    entries.push({
      meeting_id: row.meeting_id,
      date: dateByMeeting.get(row.meeting_id) ?? "",
      person_id: row.assigned_to_id,
      person_name: nameById.get(row.assigned_to_id) ?? "Unknown",
      role: row.role === "opening_prayer" ? "Opening Prayer" : "Closing Prayer",
      topic: null,
    });
  }

  for (const row of (adultsRes.data ?? []) as {
    meeting_id: string;
    speaker_id: string | null;
    guest_speaker_name: string | null;
    topic: string | null;
  }[]) {
    if (!row.speaker_id && !row.guest_speaker_name) continue;
    entries.push({
      meeting_id: row.meeting_id,
      date: dateByMeeting.get(row.meeting_id) ?? "",
      person_id: row.speaker_id,
      person_name: row.speaker_id ? nameById.get(row.speaker_id) ?? "Unknown" : `${row.guest_speaker_name} (guest)`,
      role: "Speaker",
      topic: row.topic,
    });
  }

  for (const row of (youthRes.data ?? []) as {
    meeting_id: string;
    speaker_id: string | null;
    guest_speaker_name: string | null;
    topic: string | null;
  }[]) {
    if (!row.speaker_id && !row.guest_speaker_name) continue;
    entries.push({
      meeting_id: row.meeting_id,
      date: dateByMeeting.get(row.meeting_id) ?? "",
      person_id: row.speaker_id,
      person_name: row.speaker_id ? nameById.get(row.speaker_id) ?? "Unknown" : `${row.guest_speaker_name} (guest)`,
      role: "Youth Speaker",
      topic: row.topic,
    });
  }

  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * For each active person, their most recent date in a given set of
 * history entries -- sorted so people who've never had a turn (or had
 * one longest ago) show first. This is the "who's due" view.
 */
export function buildDueList(
  entries: HistoryEntry[],
  activePeople: { id: string; name: string }[]
): DueEntry[] {
  const lastByPerson = new Map<string, string>();
  for (const e of entries) {
    if (!e.person_id) continue;
    const existing = lastByPerson.get(e.person_id);
    if (!existing || e.date > existing) {
      lastByPerson.set(e.person_id, e.date);
    }
  }

  return activePeople
    .map((p) => ({ person_id: p.id, person_name: p.name, last_date: lastByPerson.get(p.id) ?? null }))
    .sort((a, b) => {
      if (a.last_date === b.last_date) return a.person_name.localeCompare(b.person_name);
      if (a.last_date === null) return -1;
      if (b.last_date === null) return 1;
      return a.last_date.localeCompare(b.last_date);
    });
}