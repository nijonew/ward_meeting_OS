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

export interface SessionProfile {
  role: AppRole | null;
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name, email")
    .eq("id", user.id)
    .single();

  return { user, profile: (profile as SessionProfile) ?? null };
}