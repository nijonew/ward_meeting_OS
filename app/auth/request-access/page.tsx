"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestAccess } from "@/app/auth/actions";

const initialState: { error?: string; success?: boolean } = {};

/**
 * Self-serve account creation (2026-10-03, the user's own question
 * after reading the old /auth/new-user page's "ask your ward's admin
 * to add you first" line: "Can the user create an account without the
 * ward admin setting that up first?").
 *
 * **Made the one and only no-account path, 2026-10-10** (the user's
 * own words: "I would prefer that there not be two options - login
 * with previous access granted by email, or request access. I really
 * only want request access as the only option. Someone puts in their
 * email, they click the request access button, they are told to
 * verify their email and that once their email is verified an admin
 * will review their access request."). The old /auth/new-user page --
 * "sign in for the first time," for someone an admin had already
 * invited directly through the Supabase dashboard -- is deleted
 * outright; this page (linked straight from /login now) is the single
 * place anyone without access starts. The password fields below were
 * already part of this form before this change and stay exactly where
 * they were -- Supabase's sign-up call needs a real password set at
 * account-creation time, there's no separate "set your password later"
 * step for a self-served account the way there was for an admin-invited
 * one.
 *
 * Calls requestAccess (app/auth/actions.ts), which is just Supabase's
 * own sign-up -- no separate approval-request mechanism exists or is
 * needed, since the resulting account comes in with no `people` row
 * linking to it yet, which is exactly what `/admin/verify-logins`
 * already treats as "needs verification." This page's own job ends at
 * account creation; everything after that (confirming the email,
 * matching to a person, granting access) is the same Verify Logins
 * flow regardless of how the account got created.
 */
export default function RequestAccessPage() {
  const [state, formAction, pending] = useActionState(requestAccess, initialState);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <Link href="/login" className="text-xs text-ink-muted hover:text-ink">
        &larr; Sign in
      </Link>
      <h1 className="mt-2 font-display text-2xl">Request access</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Enter your email and choose a password below, then click &ldquo;Request access.&rdquo;
        You&rsquo;ll be asked to verify your email first -- once that&rsquo;s done, an admin will
        review your request and set up your access.
      </p>

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
          placeholder="Choose a password"
          className="rounded border border-rule bg-surface px-3 py-2 text-sm"
        />
        <input
          type="password"
          name="confirm"
          required
          placeholder="Confirm password"
          className="rounded border border-rule bg-surface px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent-deep disabled:opacity-50"
        >
          {pending ? "Requesting..." : "Request access"}
        </button>
        {state.error && <p className="text-sm text-danger">{state.error}</p>}
        {state.success && (
          <p className="text-sm text-ink">
            Check your email for a link to verify your address. Once you&rsquo;ve verified it, an
            admin will review your request -- you&rsquo;ll be able to{" "}
            <Link href="/login" className="underline">
              sign in
            </Link>{" "}
            with the email and password you just chose once that&rsquo;s done.
          </p>
        )}
      </form>
    </main>
  );
}
