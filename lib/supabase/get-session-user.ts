import { createClient } from "./server";

/** "general" (2026-10-04, the user's own request: "we probably need
 *  another role which gives no extra access") grants nothing by
 *  construction, not by any special-casing -- every permission check
 *  in this app is an exact match against a specific role string, so a
 *  value that never appears in any such check is automatically a dead
 *  end. Exists so a verified account whose calling doesn't map to
 *  anything special still has somewhere to land other than staying
 *  stuck with `role = null` (and therefore stuck in the Verify Logins
 *  queue) forever.
 *
 *  "ward_council"/"youth_council" (same day, the user's own request)
 *  grant viewing access to that specific meeting type -- a ROLE-based
 *  alternative path to the exact same access the existing calling-based
 *  `meeting_type_members` mechanism already grants (see
 *  lib/data/meeting-type-access.ts's getVisibleMeetingTypesForUser,
 *  which unions both sources together). Neither grants anything beyond
 *  that one meeting type -- not admin access, not the other council's
 *  meetings. */
export type AppRole =
  | "bishopric"
  | "general"
  | "music_planner"
  | "communications_specialist"
  | "ward_council"
  | "youth_council"
  | "yw_presidency"
  | "yw_advisor"
  | "yw_specialist"
  | "ym_advisor"
  | "ym_specialist";

/**
 * Every value profiles.role can actually hold in the database --
 * every AppRole plus "bishop", added 2026-10-03 as its own distinct
 * value rather than folding the Bishop into the shared "bishopric"
 * role (the user's own request: "let's make the bishop its own role
 * rather than lumping it in the bishopric role. A bishop can
 * essentially give ownership to the next bishop and is the one that
 * can grant that access."). See SessionProfile.role/isBishop below for
 * how this gets normalized back down to one check everywhere else.
 */
export type StoredRole = AppRole | "bishop";

export interface SessionProfile {
  /**
   * Normalized: a stored "bishop" reads as "bishopric" here. Every
   * existing `role === "bishopric"` check across this app (there are
   * dozens) keeps working completely unchanged, and the Bishop keeps
   * exactly the same full admin access everywhere "bishopric" already
   * had -- nothing elsewhere needed to change for this to be true.
   */
  role: AppRole | null;
  /**
   * True only when the raw database value is literally "bishop" -- the
   * one place in the app that needs to tell a sitting Bishop apart
   * from the rest of the admin group: granting the "bishop" role to a
   * successor (app/admin/verify-logins/actions.ts) is restricted to
   * whoever already holds it, not any bishopric-equivalent account.
   */
  isBishop: boolean;
  display_name: string | null;
  email: string | null;
}

export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null as SessionProfile | null };
  }

  const { data } = await supabase
    .from("profiles")
    .select("role, display_name, email")
    .eq("id", user.id)
    .single();

  if (!data) {
    return { user, profile: null as SessionProfile | null };
  }

  const rawRole = data.role as StoredRole | null;
  const profile: SessionProfile = {
    role: rawRole === "bishop" ? "bishopric" : (rawRole as AppRole | null),
    isBishop: rawRole === "bishop",
    display_name: data.display_name as string | null,
    email: data.email as string | null,
  };
  return { user, profile };
}