import { createClient } from "@/lib/supabase/server";

export interface MeetingElement {
  id: string;
  key: string;
  label: string;
  resolution_kind: string;
  repeatable: boolean;
  max_slots: number | null;
}

export interface TemplateElementRow {
  id: string; // meeting_templates row id
  element_id: string;
  key: string;
  label: string;
  resolution_kind: string;
  repeatable: boolean;
  max_slots: number | null;
  sort_order: number;
  slot_count: number | null;
}

export interface MeetingWithType {
  id: string;
  date: string;
  meetingTypeId: string;
  meetingTypeName: string;
}

// Self-contained lookup -- doesn't depend on the shape of the existing
// getMeetingById helper, since we specifically need the real meeting_type_id
// UUID (not a slug) to join against the new catalog tables.
export async function getMeetingWithType(meetingId: string): Promise<MeetingWithType | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("meetings")
    .select("id, date, meeting_type_id, meeting_types(name)")
    .eq("id", meetingId)
    .single();

  if (!data) return null;

  const meetingType = data.meeting_types as unknown as { name: string } | null;

  return {
    id: data.id,
    date: data.date,
    meetingTypeId: data.meeting_type_id,
    meetingTypeName: meetingType?.name ?? "Meeting",
  };
}

export async function getApplicableElements(meetingTypeId: string): Promise<MeetingElement[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("meeting_element_types")
    .select("meeting_elements(id, key, label, resolution_kind, repeatable, max_slots, sort_order)")
    .eq("meeting_type_id", meetingTypeId);

  const elements = (data ?? [])
    .map((row) => row.meeting_elements as unknown as (MeetingElement & { sort_order: number }) | null)
    .filter((e): e is MeetingElement & { sort_order: number } => Boolean(e));

  return elements.sort((a, b) => a.sort_order - b.sort_order);
}

export async function getTemplateElements(meetingTypeId: string): Promise<TemplateElementRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("meeting_templates")
    .select(
      "id, element_id, sort_order, slot_count, meeting_elements(key, label, resolution_kind, repeatable, max_slots)"
    )
    .eq("meeting_type_id", meetingTypeId)
    .order("sort_order", { ascending: true });

  return (data ?? []).map((row) => {
    const el = row.meeting_elements as unknown as {
      key: string;
      label: string;
      resolution_kind: string;
      repeatable: boolean;
      max_slots: number | null;
    };
    return {
      id: row.id,
      element_id: row.element_id,
      sort_order: row.sort_order,
      slot_count: row.slot_count,
      key: el.key,
      label: el.label,
      resolution_kind: el.resolution_kind,
      repeatable: el.repeatable,
      max_slots: el.max_slots,
    };
  });
}