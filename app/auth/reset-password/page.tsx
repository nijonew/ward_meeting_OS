"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "@/app/auth/actions";

const initialState: { error?: string; success?: boolean } = {};

/**
 * Fixed 2026-09-06: this page was a byte-for-byte duplicate of
 * /auth/update-password (both called updatePassword, which requires an
 * active Supabase session) -- requestPasswordReset existed but was
 * never wired to any page. A first-time user or someone who'd forgotten
 * their password, following login's "Forgot your password, or signing
 * in for the first time?" link here, would hit a form trying to set a
 * password with no session to update instead of ever getting an email.
 * This is now the actual "send me a reset link" step; /auth/update-password
 * is the "type your new password" step reached from that email.
 */
export default function ResetPasswordPage() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <Link href="/login" className="text-xs text-ink-muted hover:text-ink">
        &larr; Sign in
      </Link>
      <h1 className="mt-2 font-display text-2xl">Reset your password</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Enter your email and we&rsquo;ll send a link to set a password. Use this the first
        time you sign in too.
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
