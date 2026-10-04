import { createClient } from "@/lib/supabase/server";
import type { MeetingTypeSlug } from "@/lib/types";
import type { AppRole } from "@/lib/supabase/get-session-user";

/** "ward_council"/"youth_council" (2026-10-04, the user's own request)
 *  grant viewing access to exactly that one meeting type, nothing
 *  more -- a role-based alternative path to the same access
 *  meeting_type_members already grants by calling. See
 *  getVisibleMeetingTypesForUser below, which unions both sources. */
const ROLE_MEETING_TYPES: Partial<Record<AppRole, MeetingTypeSlug>> = {
  ward_council: "ward-council",
  youth_council: "youth-council",
};

/**
 * Which meeting types a given logged-in account should see tiles for in
 * "My meetings" -- per the user's own request (2026-09-06): "only show
 * the meetings that apply to the person by nature of their calling."
 * Resolves: auth user -> people row (via people.profile_id, migration
 * `030`) -> callings they currently hold -> meeting_type_members (the
 * same calling-to-meeting-type mapping already used for rotation
 * eligibility, lib/data/rotations.ts) -> meeting types.
 *
 * `role` (optional, 2026-10-04) additionally unions in whichever single
 * meeting type that role itself grants (ROLE_MEETING_TYPES) -- a
 * second, independent path to the same kind of access, for an account
 * whose role was set directly (e.g. via Verify Logins or the calling
 * auto-sync) rather than relying on meeting_type_members. Omitting it
 * keeps the old calling-only behavior exactly as it was.
 *
 * Returns an empty list for an account with no matched `people` row and
 * no role-granted type -- callers should treat that as "no tiles," not
 * an error. The Bishopric role is NOT resolved this way -- callers
 * should just show every type for that role directly, since admins
 * manage everything regardless of which calling happens to be recorded
 * against their own account.
 *
 * This only controls which tile *shows up* for "My meetings" -- for the
 * other callers (submitAgendaItem/submitAnnouncement's own access
 * checks, and /meetings/[id]/archived's real access-control gate), this
 * list IS the actual access boundary, not just a UI convenience.
 */
export async function getVisibleMeetingTypesForUser(userId: string, role?: AppRole | null): Promise<MeetingTypeSlug[]> {
  const supabase = await createClient();
  const slugs = new Set<MeetingTypeSlug>();

  const roleGrantedType = role ? ROLE_MEETING_TYPES[role] : undefined;
  if (roleGrantedType) slugs.add(roleGrantedType);

  const { data: person } = await supabase.from("people").select("id").eq("profile_id", userId).maybeSingle();
  if (person) {
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

    for (const row of (rows ?? []) as unknown[]) {
      const r = row as { meeting_types: { slug?: string }[] | { slug?: string } | null };
      const meetingType = Array.isArray(r.meeting_types) ? r.meeting_types[0] : r.meeting_types;
      if (meetingType?.slug) slugs.add(meetingType.slug as MeetingTypeSlug);
    }
  }

  return Array.from(slugs);
}
