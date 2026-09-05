import { createClient } from "@/lib/supabase/server";

export interface RotationMember {
  id: string; // rotation_members row id
  person_id: string;
  person_name: string;
  sort_order: number;
}

export interface RotationRow {
  id: string;
  meeting_type_id: string;
  meeting_type_name: string;
  element_key: string;
  element_label: string;
  next_index: number;
  eligibility_source: "standing_attendees" | "calling_names" | "manual";
  eligibility_calling_names: string[] | null;
  members: RotationMember[];
}

export async function getAllRotations(): Promise<RotationRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("rotations")
    .select(
      "id, meeting_type_id, element_key, next_index, eligibility_source, eligibility_calling_names, meeting_types(name), rotation_members(id, person_id, sort_order, people(name))"
    )
    .order("element_key");

  if (error || !data) return [];

  return (data as unknown[]).map((row) => {
    const r = row as {
      id: string;
      meeting_type_id: string;
      element_key: string;
      next_index: number;
      eligibility_source: "standing_attendees" | "calling_names" | "manual";
      eligibility_calling_names: string[] | null;
      meeting_types: { name?: string }[] | { name?: string } | null;
      rotation_members: { id: string; person_id: string; sort_order: number; people: { name?: string }[] | { name?: string } | null }[] | null;
    };
    const meetingType = Array.isArray(r.meeting_types) ? r.meeting_types[0] : r.meeting_types;
    const members = (r.rotation_members ?? [])
      .map((m) => {
        const person = Array.isArray(m.people) ? m.people[0] : m.people;
        return {
          id: m.id,
          person_id: m.person_id,
          person_name: person?.name ?? "Unknown",
          sort_order: m.sort_order,
        };
      })
      .sort((a, b) => a.sort_order - b.sort_order);

    return {
      id: r.id,
      meeting_type_id: r.meeting_type_id,
      meeting_type_name: meetingType?.name ?? "Meeting",
      element_key: r.element_key,
      element_label: r.element_key, // overwritten by caller with catalog label if needed
      next_index: r.next_index,
      eligibility_source: r.eligibility_source,
      eligibility_calling_names: r.eligibility_calling_names,
      members,
    };
  });
}

/**
 * Finds eligible people for a rotation based on its configured source, and
 * replaces its membership list with them (preserving existing sort order
 * for anyone still eligible, appending anyone new at the end, and
 * dropping anyone no longer eligible).
 */
export async function syncRotationMembership(rotationId: string): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { data: rotation, error: rotationError } = await supabase
    .from("rotations")
    .select("id, meeting_type_id, eligibility_source, eligibility_calling_names")
    .eq("id", rotationId)
    .single();

  if (rotationError || !rotation) {
    return { error: rotationError?.message ?? "Rotation not found." };
  }

  let eligiblePersonIds: string[] = [];

  if (rotation.eligibility_source === "calling_names") {
    const names = rotation.eligibility_calling_names ?? [];
    const { data: callings } = await supabase
      .from("callings")
      .select("current_holder_id")
      .in("name", names)
      .eq("active", true);

    eligiblePersonIds = Array.from(
      new Set(
        ((callings ?? []) as { current_holder_id: string | null }[])
          .map((c) => c.current_holder_id)
          .filter((id): id is string => Boolean(id))
      )
    );
  } else if (rotation.eligibility_source === "standing_attendees") {
    const { data: rows } = await supabase
      .from("meeting_type_members")
      .select("callings(current_holder_id)")
      .eq("meeting_type_id", rotation.meeting_type_id);

    eligiblePersonIds = Array.from(
      new Set(
        ((rows ?? []) as unknown[])
          .map((row) => {
            const r = row as { callings: { current_holder_id: string | null }[] | { current_holder_id: string | null } | null };
            const calling = Array.isArray(r.callings) ? r.callings[0] : r.callings;
            return calling?.current_holder_id ?? null;
          })
          .filter((id): id is string => Boolean(id))
      )
    );
  } else {
    // 'manual' rotations are never auto-synced.
    return {};
  }

  const { data: existingMembers } = await supabase
    .from("rotation_members")
    .select("person_id, sort_order")
    .eq("rotation_id", rotationId)
    .order("sort_order");

  const existing = (existingMembers ?? []) as { person_id: string; sort_order: number }[];
  const existingIds = new Set(existing.map((m) => m.person_id));
  const eligibleIds = new Set(eligiblePersonIds);

  // Drop anyone no longer eligible.
  const toRemove = existing.filter((m) => !eligibleIds.has(m.person_id)).map((m) => m.person_id);
  if (toRemove.length > 0) {
    const { error: removeError } = await supabase
      .from("rotation_members")
      .delete()
      .eq("rotation_id", rotationId)
      .in("person_id", toRemove);
    if (removeError) return { error: removeError.message };
  }

  // Add anyone newly eligible, at the end of the existing order.
  const toAdd = eligiblePersonIds.filter((id) => !existingIds.has(id));
  if (toAdd.length > 0) {
    const startOrder = existing.length > 0 ? Math.max(...existing.map((m) => m.sort_order)) + 1 : 0;
    const rows = toAdd.map((personId, i) => ({
      rotation_id: rotationId,
      person_id: personId,
      sort_order: startOrder + i,
    }));
    const { error: addError } = await supabase.from("rotation_members").insert(rows);
    if (addError) return { error: addError.message };
  }

  return {};
}

/**
 * Bishop -> Bishopric First Counselor -> Bishopric Second Counselor, in
 * that fixed order, cycling every 3 calendar months regardless of how
 * many Sacrament Meetings fall in between: January/April/July/October
 * are the Bishop's, February/May/August/November the 1st Counselor's,
 * March/June/September/December the 2nd Counselor's. This is fixed by
 * calling name rather than driven by the generic rotations table, since
 * that engine advances once per meeting *created* (weekly, for Sacrament
 * Meeting) and has no concept of "hold for the whole month."
 */
const CONDUCTING_CALLING_ORDER = ["Bishop", "Bishopric First Counselor", "Bishopric Second Counselor"];

/**
 * Presiding and Conducting for a new Sacrament Meeting, resolved directly
 * from the Bishop/counselor callings rather than the generic per-meeting
 * rotation pointer -- see applyRotationsToNewMeeting. Both stay fully
 * editable afterward like any other sacrament_assignments row (via the
 * planning view or the Table Admin grid); this only sets the default.
 * Silently skips a role if the relevant calling is currently vacant,
 * matching how the generic rotation path skips an empty member list.
 */
async function applyFixedSacramentRoles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  meetingId: string,
  date: string
): Promise<void> {
  const { data: callingRows } = await supabase
    .from("callings")
    .select("name, current_holder_id")
    .in("name", CONDUCTING_CALLING_ORDER)
    .eq("active", true);

  const holderByCallingName = new Map(
    ((callingRows ?? []) as { name: string; current_holder_id: string | null }[]).map((c) => [c.name, c.current_holder_id])
  );

  const monthIndex = new Date(`${date}T00:00:00`).getMonth() % 3;
  const roles: { role: string; personId: string | null | undefined }[] = [
    { role: "presiding", personId: holderByCallingName.get("Bishop") },
    { role: "conducting", personId: holderByCallingName.get(CONDUCTING_CALLING_ORDER[monthIndex]) },
  ];

  for (const { role, personId } of roles) {
    if (!personId) continue;
    await supabase.from("sacrament_assignments").insert({ meeting_id: meetingId, role, assigned_to_id: personId, confirmed: false });
  }
}

/**
 * Called once, right after a new meeting is created. For every rotation
 * configured for that meeting type: writes the next-in-line person as
 * that element's assignment for the new meeting, then advances the
 * rotation's pointer -- so a later override in the planning view doesn't
 * change whose turn is next for future meetings. For Sacrament Meeting,
 * Presiding and Conducting are handled separately (see
 * applyFixedSacramentRoles) rather than through that generic pointer.
 */
export async function applyRotationsToNewMeeting(meetingId: string, meetingTypeId: string, meetingTypeSlug: string): Promise<void> {
  const supabase = await createClient();
  const isSacrament = meetingTypeSlug === "sacrament-meeting";

  if (isSacrament) {
    const { data: meetingRow } = await supabase.from("meetings").select("date").eq("id", meetingId).single();
    if (meetingRow?.date) await applyFixedSacramentRoles(supabase, meetingId, meetingRow.date);
  }

  const { data: rotations } = await supabase
    .from("rotations")
    .select("id, element_key, next_index, rotation_members(person_id, sort_order)")
    .eq("meeting_type_id", meetingTypeId);

  if (!rotations) return;

  const roleTable = isSacrament ? "sacrament_assignments" : "bishopric_assignments";
  const personAndTextKeys = new Set(["spiritual_thought", "handbook_training"]);

  for (const row of rotations as unknown[]) {
    const r = row as {
      id: string;
      element_key: string;
      next_index: number;
      rotation_members: { person_id: string; sort_order: number }[] | null;
    };

    // Conducting is now set by applyFixedSacramentRoles above, not this
    // generic pointer -- skip it here so a Sacrament Meeting doesn't end
    // up with two conflicting "conducting" assignment rows. (Its
    // `rotations` config row, if still configured, is simply unused now.)
    if (isSacrament && r.element_key === "conducting") continue;

    const members = (r.rotation_members ?? []).sort((a, b) => a.sort_order - b.sort_order);
    if (members.length === 0) continue;

    const index = r.next_index % members.length;
    const personId = members[index].person_id;

    if (personAndTextKeys.has(r.element_key)) {
      await supabase.from("meeting_element_notes").upsert(
        { meeting_id: meetingId, element_key: r.element_key, person_id: personId },
        { onConflict: "meeting_id,element_key" }
      );
    } else {
      const assignmentRow: Record<string, unknown> = {
        meeting_id: meetingId,
        role: r.element_key,
        assigned_to_id: personId,
      };
      if (isSacrament) assignmentRow.confirmed = false;
      await supabase.from(roleTable).insert(assignmentRow);
    }

    await supabase
      .from("rotations")
      .update({ next_index: (index + 1) % members.length })
      .eq("id", r.id);
  }
}