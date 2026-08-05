"use client";

import { useActionState } from "react";
import { sendMagicLink } from "@/app/auth/actions";

const initialState: { error?: string; success?: boolean } = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(sendMagicLink, initialState);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="font-display text-2xl">Ward Meeting OS</h1>
      <p className="mt-2 text-sm text-slate">
        Enter your email and we&rsquo;ll send you a sign-in link.
      </p>

      {state.success ? (
        <p className="mt-6 rounded-md border border-rule bg-card p-4 text-sm text-ink">
          Check your email for a sign-in link.
        </p>
      ) : (
        <form action={formAction} className="mt-6 flex flex-col gap-3">
          <input
            type="email"
            name="email"
            required
            placeholder="you@example.com"
            className="rounded-md border border-rule bg-card px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink/90 disabled:opacity-50"
          >
            {pending ? "Sending..." : "Send sign-in link"}
          </button>
          {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        </form>
      )}
    </main>
  );
}