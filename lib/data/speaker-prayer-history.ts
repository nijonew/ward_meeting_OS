import { createClient } from "@/lib/supabase/server";

export interface HistoryEntry {
  meeting_id: string | null; // null for a speaker_prayer_history_import row -- not tied to a real meeting
  date: string;
  person_id: string | null;
  person_name: string; // resolved name, or the guest's name for non-ward speakers
  role: "Opening Prayer" | "Closing Prayer" | "Speaker" | "Youth Speaker" | "Prayer";
  topic: string | null;
  /** Set only for a speaker_prayer_history_import row -- lets the page
   *  show a delete control only where one applies (an archived-meeting-
   *  sourced entry is owned by that meeting, not this table). */
  historyImportId?: string;
}

export interface DueEntry {
  person_id: string;
  person_name: string;
  last_date: string | null; // null = never on record
}

export interface PersonWithAgeGroup {
  id: string;
  name: string;
  age_group: "adult" | "youth" | "child" | null;
}

/**
 * Active people plus their `age_group` (migration 029) -- splits
 * "Due to Speak" into separate Adult/Youth lists (2026-10-27, the
 * user's own vision: "a separate list by date of adults, and another
 * for youth of when they spoke last"). A plain `.eq("active", true)`
 * fetch here rather than widening the shared `getActivePeople()`
 * (`lib/data/people.ts`) -- that one's `PersonOption` shape is used by
 * every person picker in the app, and age_group has no reason to be
 * there just for this one page's own need.
 */
export async function getActivePeopleWithAgeGroup(): Promise<PersonWithAgeGroup[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("people").select("id, name, age_group").eq("active", true).order("name");
  return (data ?? []) as PersonWithAgeGroup[];
}

/**
 * Every prayer/speaker assignment from ARCHIVED sacrament meetings, plus
 * every row in `speaker_prayer_history_import` (migration 079,
 * 2026-10-21) -- the ward's own pre-app history, bulk-imported from a
 * real spreadsheet, plus anything logged by hand afterward via this
 * page's own add-entry form. The two sources are merged, not one
 * replacing the other -- a date already covered by a real archived
 * meeting is never duplicated in the import table (the import migration
 * itself skips those rows at insert time). Meetings still in planning/
 * ready/live can still change, so they're excluded until the record is
 * final. For speakers, confirmed=false rows are excluded too (never
 * actually happened as planned) -- prayers have no equivalent flag since
 * sacrament_assignments.confirmed was dropped (migration 041,
 * 2026-09-08): an archived meeting's prayer assignment is taken as
 * having happened once it's filled, same as everything else on that
 * table.
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

  const dateByMeeting = new Map((archivedMeetings ?? []).map((m) => [m.id, m.date]));
  const meetingIds = (archivedMeetings ?? []).map((m) => m.id);

  const [assignmentsRes, adultsRes, youthRes, peopleRes, importRes] = await Promise.all([
    meetingIds.length > 0
      ? supabase
          .from("sacrament_assignments")
          .select("meeting_id, role, assigned_to_id")
          .in("meeting_id", meetingIds)
          .in("role", ["opening_prayer", "closing_prayer"])
      : Promise.resolve({ data: [] }),
    meetingIds.length > 0
      ? supabase
          .from("sacrament_speakers_adults")
          .select("meeting_id, speaker_id, guest_speaker_name, topic, confirmed")
          .in("meeting_id", meetingIds)
          .eq("confirmed", true)
      : Promise.resolve({ data: [] }),
    meetingIds.length > 0
      ? supabase
          .from("sacrament_speakers_youth")
          .select("meeting_id, speaker_id, guest_speaker_name, topic, confirmed")
          .in("meeting_id", meetingIds)
          .eq("confirmed", true)
      : Promise.resolve({ data: [] }),
    supabase.from("people").select("id, name"),
    // Historical/manually-logged entries (migration 079, 2026-10-21) --
    // not tied to a real meeting row at all, read alongside the
    // archived-meeting data above rather than replacing it.
    supabase.from("speaker_prayer_history_import").select("id, person_id, role, occurred_on, notes"),
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

  for (const row of (importRes.data ?? []) as {
    id: string;
    person_id: string;
    role: "speaker" | "prayer";
    occurred_on: string;
    notes: string | null;
  }[]) {
    entries.push({
      meeting_id: null,
      date: row.occurred_on,
      person_id: row.person_id,
      person_name: nameById.get(row.person_id) ?? "Unknown",
      role: row.role === "speaker" ? "Speaker" : "Prayer",
      topic: row.notes,
      historyImportId: row.id,
    });
  }

  // Ongoing dedup against overlap, not just the one-time import-time
  // check (2026-10-27, the user's own vision for this page: "combine
  // the imported names/dates/info with the data from all recorded
  // sacrament meetings... removing any duplicates/overlap on dates").
  // Migration 079's own import only skipped a date already covered by
  // a real archived meeting *as of the import* -- a meeting that
  // archives *later*, for a date someone already logged by hand here,
  // would otherwise show up twice forever. A meeting-sourced entry
  // always wins; the matching import-sourced row is dropped from the
  // merged list (not deleted from the table -- it's still real data,
  // just superseded by the authoritative meeting record for display).
  const meetingSourcedKeys = new Set(
    entries
      .filter((e) => e.meeting_id !== null && e.person_id)
      .map((e) => `${e.person_id}::${e.date}::${roleCategory(e.role)}`)
  );
  const deduped = entries.filter(
    (e) => e.meeting_id !== null || !e.person_id || !meetingSourcedKeys.has(`${e.person_id}::${e.date}::${roleCategory(e.role)}`)
  );

  return deduped.sort((a, b) => b.date.localeCompare(a.date));
}

/** Opening/Closing Prayer and the bare "Prayer" import role are all the
 *  same category for dedup/grouping purposes; Speaker and Youth Speaker
 *  are the other. */
function roleCategory(role: HistoryEntry["role"]): "speaker" | "prayer" {
  return role === "Speaker" || role === "Youth Speaker" ? "speaker" : "prayer";
}

export interface SpeakingPrayingNote {
  speaking_note: string | null;
  praying_note: string | null;
}

/**
 * The Notes Database's informational flags (migration 079, 2026-10-21 --
 * "Inactive," "Won't Speak," "Won't Pray," "Lives outside of ward," etc.)
 * -- purely informational, shown as a small flag next to a person's name
 * on the Due to Speak/Due for a Prayer lists. Never used to filter who
 * shows up on those lists, per the user's own explicit decision.
 */
export async function getSpeakingPrayingNotes(): Promise<Map<string, SpeakingPrayingNote>> {
  const supabase = await createClient();
  const { data } = await supabase.from("people").select("id, speaking_note, praying_note");
  const result = new Map<string, SpeakingPrayingNote>();
  for (const row of (data ?? []) as { id: string; speaking_note: string | null; praying_note: string | null }[]) {
    if (row.speaking_note || row.praying_note) {
      result.set(row.id, { speaking_note: row.speaking_note, praying_note: row.praying_note });
    }
  }
  return result;
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