"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInWithPassword } from "@/app/auth/actions";

const initialState: { error?: string } = {};

/** Split out of app/login/page.tsx (2026-10-03) so that page could
 *  become an async Server Component (needed to fetch the ward name for
 *  its heading) while this part -- the only part that actually needs
 *  client state -- stays a Client Component.
 *
 *  **Simplified to one no-account path, 2026-10-10** -- the user's own
 *  words, right after the /auth/new-user escape-hatch fix above: "I
 *  would prefer that there not be two options - login with previous
 *  access granted by email, or request access. I really only want
 *  request access as the only option." The "Signing in for the first
 *  time?" link (-> /auth/new-user, for an account an admin had already
 *  created directly through the Supabase dashboard) is gone -- that
 *  whole page is deleted, not just unlinked, since nothing else in the
 *  app still needs it. "Don't have an account yet?" is now the one and
 *  only path for anyone without access; "Forgot your password?" is
 *  untouched, a genuinely different case (an existing account that
 *  can't sign in), not part of what the user was asking to collapse.
 *
 *  **Both links gained a short hint line, 2026-10-19** -- right after
 *  fixing both destinations' own confirmation screens (see
 *  `/auth/reset-password`'s own comment for the full report: someone
 *  clicked "Forgot your password?", got no strong confirmation that
 *  anything happened, and reasonably assumed it was broken). Setting
 *  the expectation here too, before either link is even clicked --
 *  both flows are email-based, not something this page or the next one
 *  finishes on its own. */
export function LoginForm() {
  const [state, formAction, pending] = useActionState(signInWithPassword, initialState);

  return (
    <>
      <form action={formAction} className="mt-6 flex flex-col gap-3">
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          className="rounded border border-rule bg-surface px-3 py-2 text-sm"
        />
        <input
          type="password"
          name="password"
          required
          placeholder="Password"
          className="rounded border border-rule bg-surface px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent-deep disabled:opacity-50"
        >
          {pending ? "Signing in..." : "Sign in"}
        </button>
        {state.error && <p className="text-sm text-danger">{state.error}</p>}
      </form>

      <div className="mt-4 flex flex-col gap-3">
        <div>
          <Link href="/auth/reset-password" className="text-xs text-ink-muted underline">
            Forgot your password?
          </Link>
          <p className="mt-0.5 text-[11px] text-ink-muted/70">We&rsquo;ll email you a link to reset it.</p>
        </div>
        <div>
          <Link href="/auth/request-access" className="text-xs text-ink-muted underline">
            Don&rsquo;t have access yet?
          </Link>
          <p className="mt-0.5 text-[11px] text-ink-muted/70">
            We&rsquo;ll email you a link to verify your address first.
          </p>
        </div>
      </div>
    </>
  );
}
