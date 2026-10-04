import type { StoredRole } from "@/lib/supabase/get-session-user";

export interface UnverifiedProfile {
  id: string;
  email: string | null;
  display_name: string | null;
}

/** Every role an admin can grant from /admin/verify-logins -- "bishop"
 *  is filtered out of this list for whoever isn't currently a bishop
 *  themselves (see VerifyLoginRow's own canGrantBishop prop). */
export const GRANTABLE_ROLES: { value: StoredRole; label: string }[] = [
  { value: "bishop", label: "Bishop" },
  { value: "bishopric", label: "Bishopric (Counselor / Exec Sec / Clerk)" },
  { value: "general", label: "General (no extra access)" },
  { value: "music_planner", label: "Music Planner" },
  { value: "communications_specialist", label: "Communications Specialist" },
  { value: "yw_presidency", label: "Young Women Presidency" },
  { value: "yw_advisor", label: "Young Women Advisor" },
  { value: "yw_specialist", label: "Young Women Specialist" },
  { value: "ym_advisor", label: "Young Men Advisor" },
  { value: "ym_specialist", label: "Young Men Specialist" },
];
