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

export interface VerifiedProfileRow {
  personId: string;
  personName: string;
  email: string | null;
  /** The login's own sign-up timestamp (`profiles.created_at`) -- not
   *  literally "when an admin approved it," since that moment has
   *  never been recorded anywhere (see this file's own history in
   *  PROJECT_CONTEXT.md). This is the one date already on record for
   *  every account, past and future, per the user's own explicit
   *  choice when asked. */
  signedUpAt: string | null;
}

/**
 * Every login already linked to a person, newest sign-up first --
 * "a list of approvals by date" (2026-11-16, the user's own request).
 * The inverse of `getUnverifiedProfiles()` above: that one lists what
 * still needs a human to confirm identity; this one is the completed
 * record of that same step, for every account that's already been
 * through it.
 *
 * Reads `people` (not `profiles`) as the base table and embeds the
 * linked `profiles` row through `profile_id` -- `people.name` is the
 * real display name everywhere else in this app, unlike
 * `profiles.display_name`, which only a self-signed-up account's own
 * first-name field ever populates (see the 2026-10-30 "submitted by
 * showed an email" fix elsewhere in this file's history) and would
 * leave an admin-invited account's row blank.
 */
export async function getVerifiedProfiles(): Promise<VerifiedProfileRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("people")
    .select("id, name, profiles:profile_id(email, created_at)")
    .not("profile_id", "is", null);

  if (error || !data) return [];

  const rows = (data as unknown[]).map((row) => {
    const r = row as {
      id: string;
      name: string;
      profiles: { email: string | null; created_at: string | null } | { email: string | null; created_at: string | null }[] | null;
    };
    const linked = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return {
      personId: r.id,
      personName: r.name,
      email: linked?.email ?? null,
      signedUpAt: linked?.created_at ?? null,
    };
  });

  // Newest sign-up first; a row with no date at all (shouldn't happen
  // once linked, but defensively) sorts to the end rather than
  // throwing off the rest of the order.
  rows.sort((a, b) => {
    if (!a.signedUpAt && !b.signedUpAt) return 0;
    if (!a.signedUpAt) return 1;
    if (!b.signedUpAt) return -1;
    return b.signedUpAt.localeCompare(a.signedUpAt);
  });

  return rows;
}
