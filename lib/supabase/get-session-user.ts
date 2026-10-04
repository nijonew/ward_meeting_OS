import { createClient } from "./server";

/**
 * Permissions, reworked 2026-10-04 (the user's own request, after
 * noticing the role system and the Calling -> Role Mapping table built
 * minutes earlier were duplicating the same information two ways: "I
 * want to eliminate roles. I want the calling table to include a way
 * to select the features that are available to that calling.")
 *
 * There is no more `profiles.role` at all. A person's access is simply
 * the union of every feature flag (a boolean column on `callings`,
 * `feature_<name>`) across whichever active callings they currently
 * hold -- computed fresh on every request, not cached. Holding two
 * callings that each grant a feature just means both features are
 * present; there's no priority/tie-breaking concept anymore, since
 * flags OR together instead of one value winning.
 *
 * This replaces the entire previous role system in one step: the
 * "bishop" vs "bishopric" split, `role_source`, `calling_role_mappings`,
 * and the "general" (no-access) role all existed only to support a
 * single cached `role` value -- none of them are needed once access is
 * a live-computed set instead of a stored column. See migration `057`
 * for the schema side, and PROJECT_CONTEXT.md's Architecture section
 * for the full history of what this replaced and why.
 */
export type Feature =
  | "bishopric"
  | "music_planner"
  | "communications_specialist"
  | "ward_council"
  | "youth_council"
  | "yw_presidency"
  | "yw_advisor"
  | "yw_specialist"
  | "ym_advisor"
  | "ym_specialist";

export const ALL_FEATURES: Feature[] = [
  "bishopric",
  "music_planner",
  "communications_specialist",
  "ward_council",
  "youth_council",
  "yw_presidency",
  "yw_advisor",
  "yw_specialist",
  "ym_advisor",
  "ym_specialist",
];

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

/** `profile?.features.has("bishopric")` reads fine inline, but the
 *  negated form every gate actually needs (`role !== "bishopric"`
 *  under the old system) is easiest as its own helper -- `hasFeature`
 *  handles a null profile safely either way. */
export function hasFeature(profile: SessionProfile | null, feature: Feature): boolean {
  return profile?.features.has(feature) ?? false;
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
    const featureColumns = ALL_FEATURES.map((f) => `feature_${f}`).join(", ");
    const { data: callings } = await supabase
      .from("callings")
      .select(featureColumns)
      .eq("current_holder_id", person.id)
      .eq("active", true);

    for (const row of (callings ?? []) as unknown as Record<string, boolean | null>[]) {
      for (const feature of ALL_FEATURES) {
        if (row[`feature_${feature}`]) features.add(feature);
      }
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
