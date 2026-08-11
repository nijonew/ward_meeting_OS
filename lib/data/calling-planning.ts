import { createClient } from "@/lib/supabase/server";

export interface CallingDetail {
  id: string;
  name: string;
  title_prefix: string | null;
  current_holder_id: string | null;
  current_holder_name: string | null;
  active: boolean;
}

export interface SuggestionRow {
  id: string;
  person_id: string;
  person_name: string;
  note: string | null;
}

export interface CallingPlanningRow {
  id: string;
  calling_status: string;
  selected_person_id: string | null;
  selected_person_name: string | null;
  date_set_apart: string | null;
  release_person_id: string | null;
  release_person_name: string | null;
  release_status: string;
  notes: string | null;
  announced_meeting_id: string | null;
  created_at: string;
  suggestions: SuggestionRow[];
}

function personName(rel: unknown): string | null {
  if (Array.isArray(rel)) return (rel[0] as { name?: string } | undefined)?.name ?? null;
  return (rel as { name?: string } | null)?.name ?? null;
}

export async function getCallingDetail(callingId: string): Promise<CallingDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("callings")
    .select("id, name, title_prefix, current_holder_id, active, people:current_holder_id(name)")
    .eq("id", callingId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    name: data.name,
    title_prefix: data.title_prefix,
    current_holder_id: data.current_holder_id,
    current_holder_name: personName(data.people),
    active: data.active,
  };
}

export async function getCallingPlanningHistory(callingId: string): Promise<CallingPlanningRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("calling_planning")
    .select(
      "id, calling_status, selected_person_id, date_set_apart, release_person_id, release_status, notes, announced_meeting_id, created_at, selected:selected_person_id(name), released:release_person_id(name), calling_planning_suggestions(id, person_id, note, people(name))"
    )
    .eq("calling_id", callingId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return (data as unknown[]).map((row) => {
    const r = row as {
      id: string;
      calling_status: string;
      selected_person_id: string | null;
      date_set_apart: string | null;
      release_person_id: string | null;
      release_status: string;
      notes: string | null;
      announced_meeting_id: string | null;
      created_at: string;
      selected: unknown;
      released: unknown;
      calling_planning_suggestions:
        | { id: string; person_id: string; note: string | null; people: { name?: string } | { name?: string }[] | null }[]
        | null;
    };

    return {
      id: r.id,
      calling_status: r.calling_status,
      selected_person_id: r.selected_person_id,
      selected_person_name: personName(r.selected),
      date_set_apart: r.date_set_apart,
      release_person_id: r.release_person_id,
      release_person_name: personName(r.released),
      release_status: r.release_status,
      notes: r.notes,
      announced_meeting_id: r.announced_meeting_id,
      created_at: r.created_at,
      suggestions: (r.calling_planning_suggestions ?? []).map((s) => ({
        id: s.id,
        person_id: s.person_id,
        person_name: personName(s.people) ?? "(unknown)",
        note: s.note,
      })),
    };
  });
}
