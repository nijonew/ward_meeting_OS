import { createClient } from "@/lib/supabase/server";
import type { MeetingTypeSlug } from "@/lib/types";
import type { PersonOption } from "@/lib/data/people";

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
 * The actual eligible-people computation for a rotation's configured
 * source -- pulled out of syncRotationMembership so the assignment
 * grid (see getAssignmentGrid below) can compute "who could even be
 * assigned here, by calling" fresh, without needing to first sync (and
 * so without the possibility of showing a stale stored member list).
 * 'manual' rotations have no computable source -- callers get an empty
 * list back, same as syncRotationMembership's own early return.
 */
export async function computeEligiblePersonIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eligibilitySource: "standing_attendees" | "calling_names" | "manual",
  eligibilityCallingNames: string[] | null,
  meetingTypeId: string
): Promise<string[]> {
  if (eligibilitySource === "calling_names") {
    const names = eligibilityCallingNames ?? [];
    const { data: callings } = await supabase
      .from("callings")
      .select("current_holder_id")
      .in("name", names)
      .eq("active", true);

    return Array.from(
      new Set(
        ((callings ?? []) as { current_holder_id: string | null }[])
          .map((c) => c.current_holder_id)
          .filter((id): id is string => Boolean(id))
      )
    );
  }

  if (eligibilitySource === "standing_attendees") {
    const { data: rows } = await supabase
      .from("meeting_type_members")
      .select("callings(current_holder_id)")
      .eq("meeting_type_id", meetingTypeId);

    return Array.from(
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
  }

  return [];
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

  if (rotation.eligibility_source === "manual") {
    // 'manual' rotations are never auto-synced.
    return {};
  }

  const eligiblePersonIds = await computeEligiblePersonIds(
    supabase,
    rotation.eligibility_source,
    rotation.eligibility_calling_names,
    rotation.meeting_type_id
  );

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

export interface PushRotationResult {
  filled: number;
  skippedExisting: number;
}

/**
 * "Push rotations starting <date>" (the user's own request, 2026-09-06)
 * -- fills in the applied-assignment grid from a rotation's own member
 * order for every upcoming meeting of that type from the chosen date
 * forward, to help with manual input (e.g. meetings created before a
 * rotation had any members at all -- see the empty-rotation-membership
 * finding elsewhere in PROJECT_CONTEXT.md -- never got their assignment
 * row written by applyRotationsToNewMeeting at creation time). Only
 * ever fills a blank cell -- a meeting that already has an assignment
 * for this role is left alone, matching every other "override wins"
 * rule already used throughout this app, and the pointer only advances
 * for the ones actually filled, so this can't skip anyone's turn.
 */
export async function pushRotationToUpcomingMeetings(
  rotationId: string,
  fromDateISO: string
): Promise<PushRotationResult | { error: string }> {
  const supabase = await createClient();

  const { data: rotation, error: rotationError } = await supabase
    .from("rotations")
    .select("id, meeting_type_id, element_key, next_index, meeting_types(slug), rotation_members(person_id, sort_order)")
    .eq("id", rotationId)
    .single();

  if (rotationError || !rotation) {
    return { error: rotationError?.message ?? "Rotation not found." };
  }

  const meetingType = Array.isArray(rotation.meeting_types) ? rotation.meeting_types[0] : rotation.meeting_types;
  const slug = (meetingType as { slug?: string } | null)?.slug as MeetingTypeSlug | undefined;
  if (!slug) return { error: "Could not determine this rotation's meeting type." };

  const members = ((rotation.rotation_members ?? []) as { person_id: string; sort_order: number }[]).sort(
    (a, b) => a.sort_order - b.sort_order
  );
  if (members.length === 0) return { error: "This rotation has no members yet." };

  const table = gridTableFor(slug);

  const { data: meetingRows } = await supabase
    .from("meetings")
    .select("id, date, meeting_types!inner(slug)")
    .eq("meeting_types.slug", slug)
    .gte("date", fromDateISO)
    .order("date", { ascending: true });
  const meetings = (meetingRows ?? []) as { id: string; date: string }[];
  if (meetings.length === 0) return { filled: 0, skippedExisting: 0 };

  const { data: existingAssignments } = await supabase
    .from(table)
    .select("meeting_id")
    .eq("role", rotation.element_key)
    .in(
      "meeting_id",
      meetings.map((m) => m.id)
    );
  const alreadyAssigned = new Set(((existingAssignments ?? []) as { meeting_id: string }[]).map((r) => r.meeting_id));

  let nextIndex = rotation.next_index;
  let filled = 0;
  let skippedExisting = 0;

  for (const meeting of meetings) {
    if (alreadyAssigned.has(meeting.id)) {
      skippedExisting += 1;
      continue;
    }
    const personId = members[nextIndex % members.length].person_id;
    const row: Record<string, unknown> = { meeting_id: meeting.id, role: rotation.element_key, assigned_to_id: personId };
    const { error: insertError } = await supabase.from(table).insert(row);
    if (insertError) return { error: insertError.message };
    nextIndex = (nextIndex + 1) % members.length;
    filled += 1;
  }

  if (filled > 0) {
    await supabase.from("rotations").update({ next_index: nextIndex }).eq("id", rotationId);
  }

  return { filled, skippedExisting };
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
export const CONDUCTING_CALLING_ORDER = ["Bishop", "Bishopric First Counselor", "Bishopric Second Counselor"];

/** Presiding's own eligible list (2026-09-09, the user's own request:
 *  "default presiding to the bishop, but allow for members of the
 *  bishopric/stake presidency to be in the dropdown") -- broader than
 *  Conducting's, since a visiting stake presidency member can preside
 *  even though they'd never be in the Conducting rotation. */
export const STAKE_PRESIDENCY_CALLING_NAMES = [
  "Stake President",
  "Stake President First Counselor",
  "Stake President Second Counselor",
];

/**
 * The calling-restricted eligible-people list for one person_role agenda
 * element -- the general-purpose version of what eligiblePeopleByColumn
 * (below) already does per /rotations column, reused 2026-09-09 for the
 * meeting planning agenda grid's own dropdowns (the user's own words:
 * "all dropdowns should follow the rules for the field by calling rather
 * than have all people in the dropdown"). Presiding/Conducting are
 * fixed-by-calling rather than rotation-table-driven (see
 * applyFixedSacramentRoles) so they're resolved directly from the same
 * calling names that function itself reads, same as
 * eligiblePeopleByColumn's own Conducting special-case; every other
 * element key is resolved from its real `rotations` row, if one exists.
 *
 * Returns null -- not an empty array -- when no calling-based rule is
 * configured for this element at all (no matching `rotations` row, or
 * one explicitly set to "manual"), so callers can fall back to showing
 * every active person rather than an empty dropdown. An empty ARRAY
 * (as opposed to null) means a rule IS configured but nobody currently
 * holds the relevant calling -- surfaced as-is, not silently widened,
 * matching the applied-assignment grid's own "No one eligible" handling.
 */
export async function getEligiblePeopleForElement(
  meetingTypeSlug: MeetingTypeSlug,
  meetingTypeId: string,
  elementKey: string
): Promise<PersonOption[] | null> {
  const supabase = await createClient();

  if (meetingTypeSlug === "sacrament-meeting" && (elementKey === "presiding" || elementKey === "conducting")) {
    const names = elementKey === "presiding" ? [...CONDUCTING_CALLING_ORDER, ...STAKE_PRESIDENCY_CALLING_NAMES] : CONDUCTING_CALLING_ORDER;
    const ids = await computeEligiblePersonIds(supabase, "calling_names", names, meetingTypeId);
    return personOptionsByIds(supabase, ids);
  }

  const { data: rotation } = await supabase
    .from("rotations")
    .select("eligibility_source, eligibility_calling_names")
    .eq("meeting_type_id", meetingTypeId)
    .eq("element_key", elementKey)
    .maybeSingle();

  if (!rotation || rotation.eligibility_source === "manual") return null;

  const ids = await computeEligiblePersonIds(
    supabase,
    rotation.eligibility_source as "standing_attendees" | "calling_names",
    rotation.eligibility_calling_names,
    meetingTypeId
  );
  return personOptionsByIds(supabase, ids);
}

/**
 * Batched version of getEligiblePeopleForElement for a whole agenda's
 * worth of person_role elements at once -- one `rotations` query instead
 * of one per element key.
 */
export async function getEligiblePeopleByElementKey(
  meetingTypeSlug: MeetingTypeSlug,
  meetingTypeId: string,
  elementKeys: string[]
): Promise<Record<string, PersonOption[] | null>> {
  const supabase = await createClient();
  const result: Record<string, PersonOption[] | null> = {};

  const fixedKeys = elementKeys.filter((k) => meetingTypeSlug === "sacrament-meeting" && (k === "presiding" || k === "conducting"));
  for (const key of fixedKeys) {
    const names = key === "presiding" ? [...CONDUCTING_CALLING_ORDER, ...STAKE_PRESIDENCY_CALLING_NAMES] : CONDUCTING_CALLING_ORDER;
    const ids = await computeEligiblePersonIds(supabase, "calling_names", names, meetingTypeId);
    result[key] = await personOptionsByIds(supabase, ids);
  }

  const remaining = elementKeys.filter((k) => !fixedKeys.includes(k));
  if (remaining.length > 0) {
    const { data: rotationRows } = await supabase
      .from("rotations")
      .select("element_key, eligibility_source, eligibility_calling_names")
      .eq("meeting_type_id", meetingTypeId)
      .in("element_key", remaining);
    const byKey = new Map(
      (
        (rotationRows ?? []) as {
          element_key: string;
          eligibility_source: "standing_attendees" | "calling_names" | "manual";
          eligibility_calling_names: string[] | null;
        }[]
      ).map((r) => [r.element_key, r])
    );

    for (const key of remaining) {
      const rotation = byKey.get(key);
      if (!rotation || rotation.eligibility_source === "manual") {
        result[key] = null;
        continue;
      }
      const ids = await computeEligiblePersonIds(supabase, rotation.eligibility_source, rotation.eligibility_calling_names, meetingTypeId);
      result[key] = await personOptionsByIds(supabase, ids);
    }
  }

  return result;
}

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
    await supabase.from("sacrament_assignments").insert({ meeting_id: meetingId, role, assigned_to_id: personId });
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
 *
 * The assignment write and the pointer advance happen together inside
 * the apply_rotation_assignment() Postgres function (migration 025) --
 * one RPC call per rotation, not two separate ones -- so a failure
 * partway through can't desync the pointer from what was actually
 * assigned. That function also re-reads next_index live under a row
 * lock rather than trusting the value fetched here, so it stays correct
 * even if two meetings for the same rotation were somehow created back
 * to back.
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
    .select("id, element_key, rotation_members(person_id, sort_order)")
    .eq("meeting_type_id", meetingTypeId);

  if (!rotations) return;

  const roleTable = isSacrament ? "sacrament_assignments" : "bishopric_assignments";
  const personAndTextKeys = new Set(["spiritual_thought", "handbook_training"]);

  for (const row of rotations as unknown[]) {
    const r = row as {
      id: string;
      element_key: string;
      rotation_members: { person_id: string; sort_order: number }[] | null;
    };

    // Conducting is now set by applyFixedSacramentRoles above, not this
    // generic pointer -- skip it here so a Sacrament Meeting doesn't end
    // up with two conflicting "conducting" assignment rows. (Its
    // `rotations` config row, if still configured, is simply unused now.)
    if (isSacrament && r.element_key === "conducting") continue;

    const members = (r.rotation_members ?? []).sort((a, b) => a.sort_order - b.sort_order);
    if (members.length === 0) continue;

    const target = personAndTextKeys.has(r.element_key) ? "element_notes" : roleTable;

    const { error } = await supabase.rpc("apply_rotation_assignment", {
      p_rotation_id: r.id,
      p_meeting_id: meetingId,
      p_element_key: r.element_key,
      p_target: target,
      p_member_ids: members.map((m) => m.person_id),
    });

    if (error) {
      // Best-effort, matching this function's existing behavior (one
      // rotation failing shouldn't stop the rest from being applied) --
      // but now at least surfaced instead of silently swallowed, since
      // the two writes this replaces never checked their errors either.
      console.error(`applyRotationsToNewMeeting: rotation ${r.id} (${r.element_key}) failed:`, error.message);
    }
  }
}

// ---------------------------------------------------------------------
// Applied-assignment grid (meetings × roles), per the user's own request
// (2026-09-06): "the rotation order is secondary to the actual applied
// order by meeting and all assignments." This reads/writes the exact
// same per-meeting rows every other view does (sacrament_assignments/
// bishopric_assignments) -- it's a different, more direct way to see
// and edit them, not a new data source. It also happens to be the
// clearest way to see whether Presiding/Conducting (fixed by calling,
// not a rotation_members list -- see applyFixedSacramentRoles above)
// are actually varying month to month, since those roles have no
// membership list of their own to inspect on the regular /rotations
// cards below.

export interface GridColumn {
  key: string;
  label: string;
  /** Who could even be assigned here, by calling -- computed fresh from
   *  callings/meeting_type_members each time (see computeEligiblePersonIds),
   *  not the possibly-stale rotation_members list. Empty for a column
   *  with no calling-based eligibility rule configured at all (falls
   *  back to showing everyone, in the page). */
  eligiblePeople: PersonOption[];
}

export interface GridCell {
  assignedToId: string | null;
  assignedToName: string | null;
}

export interface GridRow {
  meetingId: string;
  date: string;
  cells: Record<string, GridCell>;
}

// Presiding is deliberately not a column -- it always defaults to the
// Bishop (see applyFixedSacramentRoles) and was never meant to be
// picked from a dropdown, per the user's own call (2026-09-06).
const GRID_COLUMN_KEYS_BY_TYPE: Record<MeetingTypeSlug, { key: string; label: string }[]> = {
  "sacrament-meeting": [
    { key: "conducting", label: "Conducting" },
    { key: "chorister", label: "Chorister" },
    { key: "organist", label: "Organist" },
  ],
  "bishopric-meeting": [
    { key: "opening_prayer", label: "Opening Prayer" },
    { key: "closing_prayer", label: "Closing Prayer" },
    { key: "spiritual_thought", label: "Spiritual Thought" },
    { key: "handbook_training", label: "Handbook Training" },
  ],
  "ward-council": [
    { key: "opening_prayer", label: "Opening Prayer" },
    { key: "closing_prayer", label: "Closing Prayer" },
    { key: "spiritual_thought", label: "Spiritual Thought" },
  ],
  "youth-council": [
    { key: "opening_prayer", label: "Opening Prayer" },
    { key: "closing_prayer", label: "Closing Prayer" },
    { key: "spiritual_thought", label: "Spiritual Thought" },
  ],
};

export function gridTableFor(meetingTypeSlug: MeetingTypeSlug): "sacrament_assignments" | "bishopric_assignments" {
  return meetingTypeSlug === "sacrament-meeting" ? "sacrament_assignments" : "bishopric_assignments";
}

/** Just the keys/labels (no eligibility lookup) -- for saving a grid
 *  row, which only needs to know which form fields to read. */
export function gridColumnsFor(meetingTypeSlug: MeetingTypeSlug): { key: string; label: string }[] {
  return GRID_COLUMN_KEYS_BY_TYPE[meetingTypeSlug] ?? [];
}

export async function personOptionsByIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: string[]
): Promise<PersonOption[]> {
  if (ids.length === 0) return [];
  const { data } = await supabase.from("people").select("id, name").in("id", ids).order("name");
  return (data ?? []) as PersonOption[];
}

/**
 * The eligible-people list for every column of a meeting type's grid,
 * computed fresh from callings each call -- "only those who could be
 * assigned in that rotation by virtue of their calling" (the user's
 * own words, 2026-09-06), not everyone active in the ward. Conducting
 * (Sacrament Meeting) is fixed-by-calling rather than rotation-table-
 * driven, so it's handled separately, straight from the same three
 * callings applyFixedSacramentRoles itself reads.
 */
async function eligiblePeopleByColumn(
  meetingTypeSlug: MeetingTypeSlug,
  meetingTypeId: string,
  columns: { key: string; label: string }[]
): Promise<Record<string, PersonOption[]>> {
  const supabase = await createClient();
  const result: Record<string, PersonOption[]> = {};

  if (meetingTypeSlug === "sacrament-meeting") {
    const { data } = await supabase
      .from("callings")
      .select("name, current_holder_id, people:current_holder_id(name)")
      .in("name", CONDUCTING_CALLING_ORDER)
      .eq("active", true);
    const rows = (data ?? []) as unknown as { name: string; current_holder_id: string | null; people: { name?: string }[] | { name?: string } | null }[];
    const byName = new Map(rows.map((r) => [r.name, r]));
    result["conducting"] = CONDUCTING_CALLING_ORDER.map((name) => byName.get(name))
      .filter((r): r is (typeof rows)[number] => Boolean(r?.current_holder_id))
      .map((r) => {
        const person = Array.isArray(r.people) ? r.people[0] : r.people;
        return { id: r.current_holder_id as string, name: person?.name ?? "Unknown" };
      });
  }

  const remaining = columns.filter((c) => !result[c.key]);
  if (remaining.length > 0) {
    const { data: rotationRows } = await supabase
      .from("rotations")
      .select("element_key, eligibility_source, eligibility_calling_names")
      .eq("meeting_type_id", meetingTypeId);
    const byKey = new Map(
      ((rotationRows ?? []) as { element_key: string; eligibility_source: "standing_attendees" | "calling_names" | "manual"; eligibility_calling_names: string[] | null }[]).map(
        (r) => [r.element_key, r]
      )
    );

    for (const col of remaining) {
      const rotation = byKey.get(col.key);
      if (!rotation || rotation.eligibility_source === "manual") {
        result[col.key] = [];
        continue;
      }
      const ids = await computeEligiblePersonIds(
        supabase,
        rotation.eligibility_source,
        rotation.eligibility_calling_names,
        meetingTypeId
      );
      result[col.key] = await personOptionsByIds(supabase, ids);
    }
  }

  return result;
}

/**
 * One row per upcoming meeting of the given type (today through
 * throughDateISO), one cell per applicable role -- the actual assigned
 * person right now, whatever put it there (a fixed-by-calling rule, the
 * generic rotation pointer, or a manual override). Meetings with none
 * created yet in that window simply won't appear -- run Generate
 * Meetings / Meeting Schedule first if a date is missing.
 */
export async function getAssignmentGrid(
  meetingTypeSlug: MeetingTypeSlug,
  throughDateISO: string
): Promise<{ columns: GridColumn[]; rows: GridRow[] }> {
  const columnKeys = GRID_COLUMN_KEYS_BY_TYPE[meetingTypeSlug] ?? [];
  const table = gridTableFor(meetingTypeSlug);
  const supabase = await createClient();

  const { data: meetingType } = await supabase.from("meeting_types").select("id").eq("slug", meetingTypeSlug).single();
  const eligibleByColumn = meetingType
    ? await eligiblePeopleByColumn(meetingTypeSlug, meetingType.id as string, columnKeys)
    : {};
  const columns: GridColumn[] = columnKeys.map((c) => ({ ...c, eligiblePeople: eligibleByColumn[c.key] ?? [] }));

  const today = new Date().toISOString().slice(0, 10);

  const { data: meetingRows } = await supabase
    .from("meetings")
    .select("id, date, meeting_types!inner(slug)")
    .eq("meeting_types.slug", meetingTypeSlug)
    .gte("date", today)
    .lte("date", throughDateISO)
    .order("date", { ascending: true });

  const meetings = (meetingRows ?? []) as { id: string; date: string }[];
  if (meetings.length === 0) return { columns, rows: [] };

  const meetingIds = meetings.map((m) => m.id);
  const { data: assignmentRows } = await supabase
    .from(table)
    .select("meeting_id, role, assigned_to_id, people(name)")
    .in("meeting_id", meetingIds);

  const byMeeting = new Map<string, Record<string, GridCell>>();
  for (const row of (assignmentRows ?? []) as unknown[]) {
    const r = row as {
      meeting_id: string;
      role: string;
      assigned_to_id: string | null;
      people: { name?: string }[] | { name?: string } | null;
    };
    const person = Array.isArray(r.people) ? r.people[0] : r.people;
    const cells = byMeeting.get(r.meeting_id) ?? {};
    cells[r.role] = { assignedToId: r.assigned_to_id, assignedToName: person?.name ?? null };
    byMeeting.set(r.meeting_id, cells);
  }

  const rows: GridRow[] = meetings.map((m) => ({
    meetingId: m.id,
    date: m.date,
    cells: byMeeting.get(m.id) ?? {},
  }));

  return { columns, rows };
}