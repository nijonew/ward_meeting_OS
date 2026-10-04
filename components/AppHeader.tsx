import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { getWardName } from "@/lib/data/ward-settings";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { getUnverifiedProfileCount } from "@/lib/data/profile-verification";

/**
 * Shared top bar: wordmark (links home), a right-aligned context tag, and
 * sign-in state. Extracted out of the landing page so the dashboard (and
 * future pages) don't duplicate this markup.
 *
 * The wordmark reads "<ward name> Ward" (2026-10-03, the user's own
 * request: "take the name Ward OS and make it much less conspicuous...
 * put it only in the footer as is currently done") -- the app's own
 * product name no longer appears here at all, only in page footers,
 * which were untouched by this change. The ward name itself comes from
 * `ward_settings` (admin-editable via Table Admin), not a hardcoded
 * string -- see lib/data/ward-settings.ts.
 *
 * Gained an admin-only "needs verification" banner the same day, per
 * the user's own request: "there is notification for admins at the top
 * of the page (only seen by admins) to verify the individual and their
 * calling." Checks for logins not yet linked to a person (see
 * lib/data/profile-verification.ts) only when the viewer is already an
 * admin -- nobody else triggers that extra query, since this component
 * renders on nearly every route in the app.
 *
 * Gained a "signed in as" name next to Sign out, 2026-10-04, per the
 * user's own request after hitting exactly the confusion this solves
 * (testing against the wrong account without realizing it once roles
 * became calling-derived): "likely need to display some way to
 * identify the user showing the user is logged in as." Hovering it
 * shows the account's current features in a plain title tooltip --
 * useful for the same debugging moment, without adding visible
 * clutter to the header itself.
 */
export async function AppHeader({ tag }: { tag?: string }) {
  const [{ user, profile }, wardName] = await Promise.all([getSessionUser(), getWardName()]);
  const isAdmin = hasFeature(profile, "bishopric");
  const unverifiedCount = isAdmin ? await getUnverifiedProfileCount() : 0;
  const whoAmI = profile?.display_name || profile?.email || null;
  const featureList = profile && profile.features.size > 0 ? Array.from(profile.features).sort().join(", ") : "no features";

  return (
    <>
      {unverifiedCount > 0 && (
        <Link
          href="/admin/verify-logins"
          className="mb-4 block rounded border border-accent/40 bg-accent/10 px-4 py-2 text-xs font-medium text-ink transition-colors hover:bg-accent/20"
        >
          {unverifiedCount} login{unverifiedCount === 1 ? "" : "s"} need{unverifiedCount === 1 ? "s" : ""} verification &rarr;
        </Link>
      )}
      <header className="flex items-baseline justify-between border-b border-rule pb-6">
        <Link
          href="/"
          className="font-display text-xl tracking-tight text-ink transition-colors hover:text-ink-muted"
        >
          {wardName} Ward
        </Link>
        <div className="flex items-center gap-4">
          {tag && <span className="font-mono text-xs uppercase tracking-wider text-ink-muted">{tag}</span>}
          {whoAmI && (
            <span className="text-xs text-ink-muted" title={`Features: ${featureList}`}>
              {whoAmI}
            </span>
          )}
          {user ? (
            <form action={signOut}>
              <button
                type="submit"
                className="font-mono text-xs uppercase tracking-wider text-ink-muted transition-colors hover:text-ink"
              >
                Sign out
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="font-mono text-xs uppercase tracking-wider text-ink-muted transition-colors hover:text-ink"
            >
              Sign in
            </Link>
          )}
        </div>
      </header>
    </>
  );
}