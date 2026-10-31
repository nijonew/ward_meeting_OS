"use client";

import Link from "next/link";
import { useState, useActionState } from "react";
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
 *
 * **Replaced the inline success message with a real confirmation
 * screen, 2026-10-19** (the user's own report: "They used the password
 * reset, but thought it was a bug that it went back to the log-in
 * page. I tried it and it went back to the login page, but I also got
 * an email that took me to the correct location. Might need a landing
 * page after putting in an email to reset passwords that tells them to
 * use the email from the system... rather than just going back to the
 * log-in page."). Nothing was actually broken server-side --
 * `requestPasswordReset` never redirects, and the old version of this
 * page DID already render "Check your email for a link to set your
 * password" -- but that one small line sat directly under an otherwise
 * completely unchanged form, with a `&larr; Sign in` link right at the
 * top of the same page. With no strong visual confirmation that
 * anything had happened, clicking that link right back to `/login` was
 * the obvious next move, which is exactly what both the reporting user
 * and this session's own test of it did -- indistinguishable in
 * practice from "the page just goes back to login," even though no
 * code ever navigated anywhere. On success, the entire form is now
 * replaced by a dedicated confirmation screen (the "landing page" the
 * user asked for) that states plainly to go open the email instead of
 * expecting this page to do anything further -- the email address just
 * submitted is echoed back for confirmation, via a controlled `email`
 * field tracked alongside the existing uncontrolled form submission.
 */
export default function ResetPasswordPage() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);
  const [email, setEmail] = useState("");

  if (state.success) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
        <h1 className="font-display text-2xl">Check your email</h1>
        <p className="mt-2 text-sm text-ink">
          We sent a password reset link to <strong>{email || "your email address"}</strong>.
          Open that email and click the link in it to set a new password -- this page
          won&rsquo;t do that for you.
        </p>
        <p className="mt-2 text-xs text-ink-muted">
          Don&rsquo;t see it? Check your spam folder, or wait a few minutes and try again.
        </p>
        <Link href="/login" className="mt-6 text-xs text-ink-muted hover:text-ink">
          &larr; Back to sign in
        </Link>
      </main>
    );
  }

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
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="rounded border border-rule bg-surface px-3 py-2 text-base"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent-deep disabled:opacity-50"
        >
          {pending ? "Sending..." : "Send reset link"}
        </button>
        {state.error && <p className="text-sm text-danger">{state.error}</p>}
      </form>
    </main>
  );
}
