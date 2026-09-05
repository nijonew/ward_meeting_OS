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

function mapTemplateRow(row: {
  id: string;
  element_id: string;
  sort_order: number;
  slot_count: number | null;
  meeting_elements: unknown;
}): TemplateElementRow {
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
}

/**
 * The *default* element list for a meeting type -- for non-Sacrament
 * types this is the one shared template (formatKey null); for Sacrament
 * Meeting, formatKey picks which of the 10 special_format buckets to
 * read (see migration 032). This is what new meetings get seeded from
 * (seedPlannedElementsForMeeting) and what /admin/meeting-templates
 * edits -- it is NOT what the planning view renders directly anymore
 * (see getPlannedElements).
 */
export async function getTemplateElements(meetingTypeId: string, formatKey: string | null = null): Promise<TemplateElementRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("meeting_templates")
    .select(
      "id, element_id, sort_order, slot_count, meeting_elements(key, label, resolution_kind, repeatable, max_slots)"
    )
    .eq("meeting_type_id", meetingTypeId);
  query = formatKey ? query.eq("format_key", formatKey) : query.is("format_key", null);

  const { data } = await query.order("sort_order", { ascending: true });
  return (data ?? []).map(mapTemplateRow);
}

/**
 * A specific meeting's own agenda elements (meeting_planned_elements) --
 * seeded once from the matching default template at creation time, then
 * freely add/remove/reorderable for that meeting alone (see
 * app/meetings/[id]/template-actions.ts). Returns an empty array for any
 * meeting created before this table existed (nothing was ever seeded for
 * it) -- callers should fall back to getTemplateElements in that case.
 */
export async function getPlannedElements(meetingId: string): Promise<TemplateElementRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("meeting_planned_elements")
    .select(
      "id, element_id, sort_order, slot_count, meeting_elements(key, label, resolution_kind, repeatable, max_slots)"
    )
    .eq("meeting_id", meetingId)
    .order("sort_order", { ascending: true });

  return (data ?? []).map(mapTemplateRow);
}

/**
 * Called once, right after a new meeting is created (alongside
 * applyRotationsToNewMeeting) -- copies the matching default template
 * into this meeting's own meeting_planned_elements row set. Best-effort:
 * an empty/missing default template (e.g. a meeting type or format with
 * nothing configured yet) just leaves the meeting with zero planned
 * elements, same as the pre-redesign "no elements configured" state.
 */
export async function seedPlannedElementsForMeeting(
  meetingId: string,
  meetingTypeId: string,
  formatKey: string | null = null
): Promise<void> {
  const supabase = await createClient();

  let query = supabase
    .from("meeting_templates")
    .select("element_id, sort_order, slot_count")
    .eq("meeting_type_id", meetingTypeId);
  query = formatKey ? query.eq("format_key", formatKey) : query.is("format_key", null);

  const { data } = await query;
  if (!data || data.length === 0) return;

  const { error } = await supabase.from("meeting_planned_elements").insert(
    data.map((row) => ({
      meeting_id: meetingId,
      element_id: row.element_id,
      sort_order: row.sort_order,
      slot_count: row.slot_count,
    }))
  );

  if (error) {
    console.error(`seedPlannedElementsForMeeting: meeting ${meetingId} failed:`, error.message);
  }
}

export interface RoleAssignmentValue {
  assigned_to_id: string | null;
  confirmed: boolean;
}

/**
 * Person-role assignments for a meeting, keyed by role (== element key).
 * `table` picks which underlying table to read: sacrament meetings use
 * sacrament_assignments (which has a `confirmed` column consumed by the
 * public view); every other meeting type reuses bishopric_assignments
 * (meeting-agnostic despite the name -- see architecture notes).
 */
export async function getRoleAssignments(
  meetingId: string,
  table: "sacrament_assignments" | "bishopric_assignments"
): Promise<Record<string, RoleAssignmentValue>> {
  const supabase = await createClient();

  const { data } =
    table === "sacrament_assignments"
      ? await supabase.from(table).select("role, assigned_to_id, confirmed").eq("meeting_id", meetingId)
      : await supabase.from(table).select("role, assigned_to_id").eq("meeting_id", meetingId);

  const result: Record<string, RoleAssignmentValue> = {};
  for (const row of (data ?? []) as { role: string; assigned_to_id: string | null; confirmed?: boolean }[]) {
    result[row.role] = {
      assigned_to_id: row.assigned_to_id,
      confirmed: row.confirmed ?? true,
    };
  }
  return result;
}