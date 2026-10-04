import { createClient } from "@/lib/supabase/server";
import type { UnverifiedProfile } from "@/lib/data/profile-verification-shared";

export type { UnverifiedProfile } from "@/lib/data/profile-verification-shared";

/**
 * Every login not yet linked to a person record -- "needs
 * verification" (2026-10-04, reworked once roles were eliminated:
 * there's no `role is null` signal left at all now, since access
 * comes straight from whichever calling(s) a linked person holds). A
 * profile with no `people` row pointing at it via `profile_id` has, by
 * construction, zero callings and therefore zero features -- the
 * exact same "nothing until an admin links you" state the old
 * `role is null` check used to describe, just derived from the
 * person-link instead of a now-deleted column.
 *
 * `people.profile_id` has a unique constraint (migration `030`), so a
 * plain "not in the linked set" filter is enough -- no profile can
 * have more than one linking row to worry about.
 *
 * Split from profile-verification-shared.ts (same reasoning as
 * sacrament-program.ts/sacrament-program-shared.ts elsewhere in this
 * app) since this file imports createClient (next/headers), which
 * breaks the build the moment a Client Component imports anything
 * from it -- VerifyLoginRow.tsx needs UnverifiedProfile's type only.
 */
async function getLinkedProfileIds(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("people").select("profile_id").not("profile_id", "is", null);
  return ((data ?? []) as { profile_id: string }[]).map((p) => p.profile_id);
}

export async function getUnverifiedProfiles(): Promise<UnverifiedProfile[]> {
  const supabase = await createClient();
  const linkedIds = await getLinkedProfileIds();

  let query = supabase.from("profiles").select("id, email, display_name");
  if (linkedIds.length > 0) {
    query = query.not("id", "in", `(${linkedIds.join(",")})`);
  }
  const { data, error } = await query;
  return error || !data ? [] : (data as UnverifiedProfile[]);
}

/** A real count query rather than fetching every unverified profile
 *  and taking its length -- this runs on every page load for an admin
 *  viewer (AppHeader's own banner), so it stays as cheap as possible. */
export async function getUnverifiedProfileCount(): Promise<number> {
  const supabase = await createClient();
  const linkedIds = await getLinkedProfileIds();

  let query = supabase.from("profiles").select("id", { count: "exact", head: true });
  if (linkedIds.length > 0) {
    query = query.not("id", "in", `(${linkedIds.join(",")})`);
  }
  const { count, error } = await query;
  return error || count === null ? 0 : count;
}
