import { createClient } from "@/lib/supabase/server";
import type { UnverifiedProfile } from "@/lib/data/profile-verification-shared";

export type { UnverifiedProfile } from "@/lib/data/profile-verification-shared";
export { GRANTABLE_ROLES } from "@/lib/data/profile-verification-shared";

/**
 * Every login with no role set yet -- the signal the user chose
 * (2026-10-03) for "needs verification": a null role means zero access
 * to anything in the app today, the one state that's unambiguously
 * incomplete (as opposed to "has a role but no person link yet," which
 * the user explicitly did NOT want flagged). Surfaced to admins via
 * AppHeader's banner and the full list at /admin/verify-logins.
 *
 * Split from profile-verification-shared.ts (2026-10-03, same split
 * sacrament-program.ts/sacrament-program-shared.ts already established)
 * -- this file imports createClient (next/headers), which breaks the
 * build outright the moment a Client Component imports anything from
 * it, even just a type. VerifyLoginRow.tsx (a Client Component) needs
 * GRANTABLE_ROLES/UnverifiedProfile, so those stay in the shared file.
 */
export async function getUnverifiedProfiles(): Promise<UnverifiedProfile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("id, email, display_name").is("role", null);
  return error || !data ? [] : (data as UnverifiedProfile[]);
}

export async function getUnverifiedProfileCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase.from("profiles").select("id", { count: "exact", head: true }).is("role", null);
  return error || count === null ? 0 : count;
}
