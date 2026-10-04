import { createClient } from "./server";

/**
 * Permissions -- reworked twice on 2026-10-04. First pass replaced
 * `profiles.role` with ten boolean columns on `callings`
 * (`feature_bishopric`, etc.), but those turned out to just be the old
 * role names renamed, not real decomposed capabilities -- the user's
 * own correction: "I still think features are being defined by role
 * names. I would rather define features by features," followed by a
 * detailed worked example (per-meeting-type viewing/planning/template/
 * agenda-items/notes, Sacrament Meeting's own extras, every standalone
 * tool, and one feature per Table Admin table).
 *
 * This is that second pass: ~56 granular features (the full catalog
 * also lives in the `features` table, migration `060`, purely for
 * display/grouping in the assignment UI -- this union is the real
 * source of truth for what code can check). A person's access is
 * still the union of every feature granted by any *active* calling
 * they currently hold, via the new many-to-many `calling_features`
 * table (migration `060`) -- computed fresh on every request, never
 * cached, same as before.
 *
 * `sacrament_notes`/`sacrament_agenda_items` (the two per-type actions
 * every other meeting type has) were removed again by migration `061`,
 * the user's own call: Sacrament Meeting has no Minutes/Action Items/
 * Council Notes concept (that's a Bishopric Meeting/Ward Council/
 * Youth Council thing) and no agenda-item-submission workflow either
 * (Submit an Agenda Item already excludes Sacrament Meeting from its
 * own dropdown) -- both were speculative, never actually wired to
 * anything real for this meeting type.
 */
export type Feature =
  // Sacrament Meeting
  | "sacrament_viewing"
  | "sacrament_planning"
  | "sacrament_template"
  | "sacrament_music"
  | "sacrament_conducting"
  | "sacrament_rabnm"
  | "sacrament_program_view"
  // Bishopric Meeting
  | "bishopric_meeting_viewing"
  | "bishopric_meeting_planning"
  | "bishopric_meeting_template"
  | "bishopric_meeting_agenda_items"
  | "bishopric_meeting_notes"
  // Ward Council
  | "ward_council_viewing"
  | "ward_council_planning"
  | "ward_council_template"
  | "ward_council_agenda_items"
  | "ward_council_notes"
  // Youth Council
  | "youth_council_viewing"
  | "youth_council_planning"
  | "youth_council_template"
  | "youth_council_agenda_items"
  | "youth_council_notes"
  // Standalone tools
  | "announcement_adding"
  | "announcement_management"
  | "calling_planning"
  | "youth_teaching_planning"
  | "youth_activity_planning"
  | "ward_event_planning"
  | "meeting_schedule"
  | "meeting_cancellations"
  | "rotations"
  | "speaker_prayer_history"
  | "callings_roster"
  | "verify_logins"
  | "meeting_templates_admin"
  // Table Admin, one per table
  | "table_admin_ward_settings"
  | "table_admin_admin_select_options"
  | "table_admin_hymnal_songs"
  | "table_admin_agenda_items"
  | "table_admin_announcements"
  | "table_admin_bishopric_assignments"
  | "table_admin_callings"
  | "table_admin_council_notes"
  | "table_admin_meeting_action_items"
  | "table_admin_meeting_element_notes"
  | "table_admin_meetings"
  | "table_admin_people"
  | "table_admin_sacrament_assignments"
  | "table_admin_sacrament_music"
  | "table_admin_sacrament_planning"
  | "table_admin_sacrament_rabnm"
  | "table_admin_sacrament_speakers_adults"
  | "table_admin_sacrament_speakers_youth"
  | "table_admin_ward_events"
  | "table_admin_youth_activities"
  | "table_admin_youth_class_teachers";

export interface SessionProfile {
  features: Set<Feature>;
  /** True once a `people` row links to this login (`profile_id` set).
   *  "Needs verification" (the Verify Logins queue/banner) means the
   *  opposite of this, not "features is empty" -- an ordinary verified
   *  member with no feature-granting calling has an empty `features`
   *  set too, and that's a completely normal, expected state. */
  isLinked: boolean;
  display_name: string | null;
  email: string | null;
}

/** `profile?.features.has("sacrament_planning")` reads fine inline,
 *  but the negated form every gate actually needs is easiest as its
 *  own helper -- `hasFeature` handles a null profile safely either
 *  way. */
export function hasFeature(profile: SessionProfile | null, feature: Feature): boolean {
  return profile?.features.has(feature) ?? false;
}

/** True if the profile has at least one of the given features --
 *  shorthand for the common "any of these features" gate (e.g. a
 *  meeting type's viewing OR planning feature). */
export function hasAnyFeature(profile: SessionProfile | null, features: Feature[]): boolean {
  return features.some((f) => hasFeature(profile, f));
}

export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null as SessionProfile | null };
  }

  const [{ data: profileRow }, { data: person }] = await Promise.all([
    supabase.from("profiles").select("display_name, email").eq("id", user.id).maybeSingle(),
    supabase.from("people").select("id").eq("profile_id", user.id).maybeSingle(),
  ]);

  const features = new Set<Feature>();
  if (person) {
    const { data: rows } = await supabase
      .from("callings")
      .select("calling_features(feature_key)")
      .eq("current_holder_id", person.id)
      .eq("active", true);

    type Row = { calling_features: { feature_key: Feature }[] | { feature_key: Feature } | null };
    for (const row of (rows ?? []) as unknown as Row[]) {
      const entries = Array.isArray(row.calling_features)
        ? row.calling_features
        : row.calling_features
          ? [row.calling_features]
          : [];
      for (const entry of entries) features.add(entry.feature_key);
    }
  }

  const profile: SessionProfile = {
    features,
    isLinked: Boolean(person),
    display_name: (profileRow?.display_name as string | null) ?? null,
    email: (profileRow?.email as string | null) ?? null,
  };
  return { user, profile };
}
