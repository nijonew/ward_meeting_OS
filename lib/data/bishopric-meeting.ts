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
}

export interface BishopricMeetingData {
  minutes: BishopricMinutes | null;
  assignments: BishopricAssignmentRow[];
  actionItems: ActionItemRow[];
  agendaItems: AgendaItemRow[];
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
      .select("id, title, body, submitted_by_name, status")
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