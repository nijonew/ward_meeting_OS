"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInWithPassword } from "@/app/auth/actions";

const initialState: { error?: string } = {};

/** Split out of app/login/page.tsx (2026-10-03) so that page could
 *  become an async Server Component (needed to fetch the ward name for
 *  its heading) while this part -- the only part that actually needs
 *  client state -- stays a Client Component. */
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

      <div className="mt-4 flex flex-col gap-1.5">
        <Link href="/auth/new-user" className="text-xs text-ink-muted underline">
          Signing in for the first time?
        </Link>
        <Link href="/auth/reset-password" className="text-xs text-ink-muted underline">
          Forgot your password?
        </Link>
        {/* Added 2026-10-10 (the user's own diagnosis of a real
            confusion a brand-new sign-up ran into): "Signing in for the
            first time?" reads, to someone who's never been added at
            all, like it should apply to them -- but that page's main
            form only works for an account an admin already created,
            and quietly shows a false "check your email" success message
            otherwise (Supabase's own password-reset call never reveals
            whether an email has an account). This gives a genuinely new
            person a direct path straight from /login, instead of
            requiring them to land on /auth/new-user first and then find
            its own small escape-hatch link at the bottom of that page. */}
        <Link href="/auth/request-access" className="text-xs text-ink-muted underline">
          Don&rsquo;t have an account yet?
        </Link>
      </div>
    </>
  );
}
