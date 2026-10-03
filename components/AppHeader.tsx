import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import { getWardName } from "@/lib/data/ward-settings";

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
 */
export async function AppHeader({ tag }: { tag?: string }) {
  const supabase = await createClient();
  const [{ data: { user } }, wardName] = await Promise.all([supabase.auth.getUser(), getWardName()]);

  return (
    <header className="flex items-baseline justify-between border-b border-rule pb-6">
      <Link
        href="/"
        className="font-display text-xl tracking-tight text-ink transition-colors hover:text-ink-muted"
      >
        {wardName} Ward
      </Link>
      <div className="flex items-center gap-4">
        {tag && <span className="font-mono text-xs uppercase tracking-wider text-ink-muted">{tag}</span>}
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
  );
}