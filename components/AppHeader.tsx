import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";

/**
 * Shared top bar: wordmark (links home), a right-aligned context tag, and
 * sign-in state. Extracted out of the landing page so the dashboard (and
 * future pages) don't duplicate this markup.
 */
export async function AppHeader({ tag }: { tag: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="flex items-baseline justify-between border-b border-rule pb-6">
      <Link href="/" className="font-display text-xl tracking-tight">
        Ward Meeting OS
      </Link>
      <div className="flex items-center gap-4">
        <span className="font-mono text-xs uppercase tracking-widest text-slate">{tag}</span>
        {user ? (
          <form action={signOut}>
            <button
              type="submit"
              className="font-mono text-xs uppercase tracking-widest text-slate transition-colors hover:text-ink"
            >
              Sign out
            </button>
          </form>
        ) : (
          <Link
            href="/login"
            className="font-mono text-xs uppercase tracking-widest text-slate transition-colors hover:text-ink"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}