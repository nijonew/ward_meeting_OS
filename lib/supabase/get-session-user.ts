import { createClient } from "./server";

export type AppRole =
  | "bishopric"
  | "music_planner"
  | "communications_specialist"
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