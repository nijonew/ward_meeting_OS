"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "@/app/auth/actions";

const initialState: { error?: string; success?: boolean } = {};

/**
 * Fixed 2026-09-06: this page was a byte-for-byte duplicate of
 * /auth/update-password (both called updatePassword, which requires an
 * active Supabase session) -- requestPasswordReset existed but was
 * never wired to any page. This is the actual "send me a reset link"
 * step; /auth/update-password is the "type your new password" step
 * reached from that email.
 *
 * Split 2026-10-03 from a single combined link that used to also cover
 * a first-time sign-in via a separate /auth/new-user page -- that page
 * is deleted as of 2026-10-10 (the user's own request to collapse the
 * no-account case down to a single "Request Access" path, see
 * /auth/request-access), so this page's own "I already have an
 * account, I just forgot my password" case is the only survivor of
 * that original split. Still calls the same requestPasswordReset
 * action it always has.
 */
export default function ResetPasswordPage() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <Link href="/login" className="text-xs text-ink-muted hover:text-ink">
        &larr; Sign in
      </Link>
      <h1 className="mt-2 font-display text-2xl">Reset your password</h1>
      <p className="mt-2 text-sm text-ink-muted">Enter your email and we&rsquo;ll send a link to set a new password.</p>

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
          {pending ? "Sending..." : "Send reset link"}
        </button>
        {state.error && <p className="text-sm text-danger">{state.error}</p>}
        {state.success && (
          <p className="text-sm text-ink">Check your email for a link to set your password.</p>
        )}
      </form>
    </main>
  );
}
