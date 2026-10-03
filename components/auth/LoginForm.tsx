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

      <Link href="/auth/reset-password" className="mt-4 text-xs text-ink-muted underline">
        Forgot your password, or signing in for the first time?
      </Link>
    </>
  );
}
