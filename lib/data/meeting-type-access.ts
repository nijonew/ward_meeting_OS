import { createClient } from "@/lib/supabase/server";
import type { MeetingTypeSlug } from "@/lib/types";

/**
 * Which meeting types a given logged-in account should see tiles for in
 * "My meetings" -- per the user's own request (2026-09-06): "only show
 * the meetings that apply to the person by nature of their calling."
 * Resolves: auth user -> people row (via people.profile_id, migration
 * `030`) -> callings they currently hold -> meeting_type_members (the
 * same calling-to-meeting-type mapping already used for rotation
 * eligibility, lib/data/rotations.ts) -> meeting types.
 *
 * Returns an empty list for an account with no matched `people` row, or
 * one that holds no calling mapped to any meeting type -- callers
 * should treat that as "no tiles," not an error. The Bishopric role is
 * NOT resolved this way -- callers should just show every type for
 * that role directly, since admins manage everything regardless of
 * which calling happens to be recorded against their own account.
 *
 * This only controls which tile *shows up* -- it is not itself an
 * access-control check. The calling-based non-admin *viewing*
 * mechanism this is meant to eventually feed into isn't built yet (see
 * PROJECT_CONTEXT.md); until it is, a tile here just links to the
 * existing admin-oriented /dashboard list filtered to that type.
 */
export async function getVisibleMeetingTypesForUser(userId: string): Promise<MeetingTypeSlug[]> {
  const supabase = await createClient();

  const { data: person } = await supabase.from("people").select("id").eq("profile_id", userId).maybeSingle();
  if (!person) return [];

  // Filters through the embedded `callings` relationship rather than a
  // direct column filter on meeting_type_members, mirroring the exact
  // query shape lib/data/rotations.ts already uses successfully for
  // 'standing_attendees' eligibility -- avoids needing to separately
  // confirm meeting_type_members' own FK column name.
  const { data: rows } = await supabase
    .from("meeting_type_members")
    .select("meeting_types(slug), callings!inner(current_holder_id, active)")
    .eq("callings.current_holder_id", person.id)
    .eq("callings.active", true);

  const slugs = new Set<MeetingTypeSlug>();
  for (const row of (rows ?? []) as unknown[]) {
    const r = row as { meeting_types: { slug?: string }[] | { slug?: string } | null };
    const meetingType = Array.isArray(r.meeting_types) ? r.meeting_types[0] : r.meeting_types;
    if (meetingType?.slug) slugs.add(meetingType.slug as MeetingTypeSlug);
  }
  return Array.from(slugs);
}
