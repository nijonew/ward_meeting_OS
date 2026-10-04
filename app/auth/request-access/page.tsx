"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestAccess } from "@/app/auth/actions";

const initialState: { error?: string; success?: boolean } = {};

/**
 * Self-serve account creation (2026-10-03, the user's own question
 * after reading /auth/new-user's "ask your ward's admin to add you
 * first" line: "Can the user create an account without the ward admin
 * setting that up first?"). Reached from /auth/new-user as the
 * alternative for anyone who hasn't been pre-invited.
 *
 * Calls requestAccess (app/auth/actions.ts), which is just Supabase's
 * own sign-up -- no separate approval-request mechanism exists or is
 * needed, since the resulting account comes in with no role at all
 * and lands in the exact same /admin/verify-logins queue an
 * admin-invited-but-unverified account already would. This page's own
 * job ends at account creation; everything after that (matching to a
 * person, granting a role) is the same Verify Logins flow either way.
 */
export default function RequestAccessPage() {
  const [state, formAction, pending] = useActionState(requestAccess, initialState);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <Link href="/auth/new-user" className="text-xs text-ink-muted hover:text-ink">
        &larr; Back
      </Link>
      <h1 className="mt-2 font-display text-2xl">Request access</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Create your own account below. An admin will still need to verify you and set up your
        access before you can use most of the site -- this just gets your login started.
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
            Account created. Try{" "}
            <Link href="/login" className="underline">
              signing in
            </Link>{" "}
            now -- if you&rsquo;re asked to confirm your email first, check your inbox for a
            link. Either way, an admin still needs to verify your account afterward before you
            have full access.
          </p>
        )}
      </form>
    </main>
  );
}
