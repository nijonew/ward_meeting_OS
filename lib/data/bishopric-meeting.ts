import { createClient } from "@/lib/supabase/server";

export interface BishopricMinutes {
  spiritual_thought_presenter_id: string | null;
  spiritual_thought_notes: string | null;
  handbook_training_topic: string | null;
  handbook_training_presenter_id: string | null;
  calendar_review_notes: string | null;
  callings_discussion_notes: string | null;
  sacrament_planning_discussion_notes: string | null;
  young_men_coordination_notes: string | null;
  impressions: string | null;
  minutes_body: string | null;
  next_meeting_date: string | null;
}

export interface BishopricAssignmentRow {
  role: string;
  assigned_to_id: string | null;
}

export interface ActionItemRow {
  id: string;
  description: string;
  assigned_to_id: string | null;
  assigned_to_name: string | null;
  due_date: string | null;
  completed: boolean;
}

export interface AgendaItemRow {
  id: string;
  title: string;
  body: string;
  submitted_by_name: string;
  status: string;
  /** Migration 078 -- an admin's own inline notes on this item,
   *  rendered in the Discussion section, separate from `body` (the
   *  submitter's own description). */
  notes: string | null;
}

export interface UnassignedAgendaItemRow {
  id: string;
  title: string;
  body: string;
  submitted_by_name: string;
  created_at: string;
}

export interface PastAgendaItemRow {
  id: string;
  title: string;
  meetingDate: string;
}

export interface BishopricMeetingData {
  minutes: BishopricMinutes | null;
  assignments: BishopricAssignmentRow[];
  actionItems: ActionItemRow[];
  agendaItems: AgendaItemRow[];
}

/**
 * Agenda items for one specific meeting -- usable for ANY meeting type,
 * not just Bishopric Meeting (agenda_items is a general catalog element
 * that any meeting type's template can include).
 */
export async function getAgendaItemsForMeeting(meetingId: string): Promise<AgendaItemRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agenda_items")
    .select("id, title, body, submitted_by_name, status, notes")
    .eq("meeting_id", meetingId)
    .order("created_at");
  return (data as AgendaItemRow[] | null) ?? [];
}

/**
 * Public submissions from /submit never get a meeting_id (the form
 * doesn't ask which meeting) -- these show up here so the Bishopric can
 * assign each one to a specific upcoming meeting, where it'll then
 * appear in that meeting's own Agenda Items section for the usual
 * publish/archive review.
 */
export async function getUnassignedAgendaItems(): Promise<UnassignedAgendaItemRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agenda_items")
    .select("id, title, body, submitted_by_name, created_at")
    .is("meeting_id", null)
    .order("created_at");
  return (data as UnassignedAgendaItemRow[] | null) ?? [];
}

/**
 * Past agenda items of the SAME meeting type, for the "Add from a past
 * meeting" dropdown in the Discussion section (2026-11-15, the user's
 * own request: "add past meeting agenda items by dropdown in
 * non-sacrament meetings") -- an item that never got addressed (or
 * needs raising again) can be carried forward onto today's meeting
 * without retyping it. Scoped to this one meeting type specifically --
 * a Ward Council item has no business showing up while planning a
 * Bishopric Meeting -- and excludes the current meeting itself (an
 * item already on today's own agenda has nothing to be "added from").
 *
 * Deliberately not filtered by `status` -- "published" vs. "archived"
 * here just means "currently showing on that meeting's own agenda" vs.
 * "removed from it," neither of which reliably means "was actually
 * addressed." Every past item is a fair candidate; the admin picking
 * from the dropdown is the one who knows which still needs raising.
 * Limited to the most recent 30 so the dropdown stays usable even for
 * a meeting type with a long history.
 */
export async function getPastAgendaItemsForType(
  meetingTypeId: string,
  excludeMeetingId: string
): Promise<PastAgendaItemRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agenda_items")
    .select("id, title, created_at, meetings!inner(date, meeting_type_id)")
    .eq("meetings.meeting_type_id", meetingTypeId)
    .neq("meeting_id", excludeMeetingId)
    .order("created_at", { ascending: false })
    .limit(30);

  const rows = ((data ?? []) as unknown[]).map((row) => {
    const r = row as { id: string; title: string; meetings: { date: string } | { date: string }[] | null };
    const meeting = Array.isArray(r.meetings) ? r.meetings[0] : r.meetings;
    return { id: r.id, title: r.title, meetingDate: meeting?.date ?? "" };
  });

  // Most recent meeting first, regardless of each item's own
  // created_at (an item submitted well ahead of its meeting would
  // otherwise sort out of order relative to one submitted the same
  // week as an earlier meeting).
  rows.sort((a, b) => (a.meetingDate < b.meetingDate ? 1 : a.meetingDate > b.meetingDate ? -1 : 0));
  return rows;
}

export async function getBishopricMeetingData(meetingId: string): Promise<BishopricMeetingData> {
  const supabase = await createClient();

  const [minutesRes, assignmentsRes, actionItemsRes, agendaRes] = await Promise.all([
    supabase
      .from("bishopric_minutes")
      .select(
        "spiritual_thought_presenter_id, spiritual_thought_notes, handbook_training_topic, handbook_training_presenter_id, calendar_review_notes, callings_discussion_notes, sacrament_planning_discussion_notes, young_men_coordination_notes, impressions, minutes_body, next_meeting_date"
      )
      .eq("meeting_id", meetingId)
      .maybeSingle(),
    supabase.from("bishopric_assignments").select("role, assigned_to_id").eq("meeting_id", meetingId),
    supabase
      .from("meeting_action_items")
      .select("id, description, assigned_to_id, due_date, completed, people(name)")
      .eq("meeting_id", meetingId)
      .order("completed")
      .order("due_date"),
    supabase
      .from("agenda_items")
      .select("id, title, body, submitted_by_name, status, notes")
      .eq("meeting_id", meetingId)
      .order("created_at"),
  ]);

  return {
    minutes: (minutesRes.data as BishopricMinutes | null) ?? null,
    assignments: (assignmentsRes.data as BishopricAssignmentRow[] | null) ?? [],
    actionItems: ((actionItemsRes.data ?? []) as unknown[]).map((row) => {
      const r = row as {
        id: string;
        description: string;
        assigned_to_id: string | null;
        due_date: string | null;
        completed: boolean;
        people: { name?: string }[] | { name?: string } | null;
      };
      const person = Array.isArray(r.people) ? r.people[0] : r.people;
      return {
        id: r.id,
        description: r.description,
        assigned_to_id: r.assigned_to_id,
        assigned_to_name: person?.name ?? null,
        due_date: r.due_date,
        completed: r.completed,
      };
    }),
    agendaItems: (agendaRes.data as AgendaItemRow[] | null) ?? [],
  };
}