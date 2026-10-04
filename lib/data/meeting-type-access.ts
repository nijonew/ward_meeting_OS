import { createClient } from "@/lib/supabase/server";
import type { MeetingTypeSlug } from "@/lib/types";
import type { Feature } from "@/lib/supabase/get-session-user";
import { meetingFeature } from "@/lib/data/meeting-features";

const ALL_MEETING_TYPE_SLUGS: MeetingTypeSlug[] = [
  "sacrament-meeting",
  "bishopric-meeting",
  "ward-council",
  "youth-council",
];

/**
 * Which meeting types a given logged-in account should see tiles for in
 * "My meetings" -- per the user's own request (2026-09-06): "only show
 * the meetings that apply to the person by nature of their calling."
 * Resolves: auth user -> people row (via people.profile_id, migration
 * `030`) -> callings they currently hold -> meeting_type_members (the
 * same calling-to-meeting-type mapping already used for rotation
 * eligibility, lib/data/rotations.ts) -> meeting types.
 *
 * `features` (optional, 2026-10-04, rewritten for the granular-features
 * model) additionally unions in every meeting type this account holds
 * any of the `<type>_viewing`/`<type>_planning`/`<type>_agenda_items`
 * features for -- a second, independent path to the same kind of
 * access, for an account whose access to a type came from a calling's
 * own feature grant rather than (or in addition to) meeting_type_members.
 * Any one of the three implies inclusion here deliberately: an admin
 * managing a meeting type should see its tile/be allowed to submit for
 * it too, and someone granted only agenda-item access for a type (no
 * viewing/planning at all) still counts as "attends" it for
 * submitAgendaItem/submitAnnouncement's own checks -- without needing
 * every feature granted separately on the same calling. `template`/
 * `notes` are deliberately excluded -- those are sub-permissions once
 * already involved with a type, not signals of attendance on their
 * own. Omitting `features` keeps the old calling-only behavior exactly
 * as it was. Replaces the old role-based "Bishopric sees every type"
 * shortcut every caller used to special-case on top of this function --
 * under granular features there's no single "is admin" flag, so a
 * caller that needs "every type I can plan" should just rely on this
 * list directly, matching every feature actually granted.
 *
 * Returns an empty list for an account with no matched `people` row and
 * no feature-granted type -- callers should treat that as "no tiles,"
 * not an error.
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
    for (const type of ALL_MEETING_TYPE_SLUGS) {
      if (
        features.has(meetingFeature(type, "viewing")) ||
        features.has(meetingFeature(type, "planning")) ||
        features.has(meetingFeature(type, "agenda_items"))
      ) {
        slugs.add(type);
      }
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
