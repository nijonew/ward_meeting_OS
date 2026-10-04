import { createClient } from "@/lib/supabase/server";
import type { MeetingTypeSlug } from "@/lib/types";
import type { Feature } from "@/lib/supabase/get-session-user";

/** "ward_council"/"youth_council" features (2026-10-04) grant viewing
 *  access to exactly that one meeting type, nothing more -- a
 *  feature-based alternative path to the same access
 *  meeting_type_members already grants by calling. See
 *  getVisibleMeetingTypesForUser below, which unions both sources. */
const FEATURE_MEETING_TYPES: Partial<Record<Feature, MeetingTypeSlug>> = {
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
 * `features` (optional, 2026-10-04) additionally unions in whichever
 * meeting type(s) those features themselves grant (FEATURE_MEETING_TYPES)
 * -- a second, independent path to the same kind of access, for an
 * account whose Ward Council/Youth Council feature came from a calling
 * flagged directly for it rather than relying on meeting_type_members.
 * Omitting it keeps the old calling-only behavior exactly as it was.
 *
 * Returns an empty list for an account with no matched `people` row and
 * no feature-granted type -- callers should treat that as "no tiles,"
 * not an error. The Bishopric feature is NOT resolved this way --
 * callers should just show every type for that feature directly, since
 * admins manage everything regardless of which calling happens to be
 * recorded against their own account.
 *
 * This only controls which tile *shows up* for "My meetings" -- for the
 * other callers (submitAgendaItem/submitAnnouncement's own access
 * checks, and /meetings/[id]/archived's real access-control gate), this
 * list IS the actual access boundary, not just a UI convenience.
 */
export async function getVisibleMeetingTypesForUser(userId: string, features?: Set<Feature>): Promise<MeetingTypeSlug[]> {
  const supabase = await createClient();
  const slugs = new Set<MeetingTypeSlug>();

  if (features) {
    for (const [feature, slug] of Object.entries(FEATURE_MEETING_TYPES) as [Feature, MeetingTypeSlug][]) {
      if (features.has(feature)) slugs.add(slug);
    }
  }

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
