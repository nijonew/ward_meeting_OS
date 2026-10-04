"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "@/app/auth/actions";

const initialState: { error?: string; success?: boolean } = {};

/**
 * First-time sign-in, split out 2026-10-03 from a single combined link
 * that used to cover both this and a forgotten password (the user's
 * own report: "There is not distinction between new user and lost
 * password. I would like to have separate links and pages for that").
 * See /auth/reset-password for that other case's own copy.
 *
 * Calls the exact same requestPasswordReset action that page does --
 * there's no separate "new user" mechanism in this app to call
 * instead. An account only exists here once an admin has already
 * invited it directly through the Supabase dashboard (no self-serve
 * sign-up, per this app's own identity-matching policy -- see
 * PROJECT_CONTEXT.md's "Adding new people" workflow), so a first-time
 * sign-in and a forgotten password both reduce to the exact same
 * question Supabase answers identically either way: "does an account
 * with this email already exist, and if so, send it a link to set a
 * password." Only the page's own copy differs between the two.
 */
export default function NewUserPage() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <Link href="/login" className="text-xs text-ink-muted hover:text-ink">
        &larr; Sign in
      </Link>
      <h1 className="mt-2 font-display text-2xl">Signing in for the first time</h1>
      <p className="mt-2 text-sm text-ink-muted">
        If an admin has already set up your account, enter your email below and we&rsquo;ll send
        you a link to set your password.
      </p>

      <form action={formAction} className="mt-6 flex flex-col gap-3">
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          className="rounded border border-rule bg-surface px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent-deep disabled:opacity-50"
        >
          {pending ? "Sending..." : "Send me a link"}
        </button>
        {state.error && <p className="text-sm text-danger">{state.error}</p>}
        {state.success && <p className="text-sm text-ink">Check your email for a link to set your password.</p>}
      </form>

      <p className="mt-4 text-xs text-ink-muted">Haven&rsquo;t been set up yet? Ask your ward&rsquo;s admin to add you first.</p>
    </main>
  );
}
