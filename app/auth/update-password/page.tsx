"use client";

import { useActionState } from "react";
import { updatePassword } from "@/app/auth/actions";

const initialState: { error?: string } = {};

export default function UpdatePasswordPage() {
  const [state, formAction, pending] = useActionState(updatePassword, initialState);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="font-display text-2xl">Set your password</h1>
      <p className="mt-2 text-sm text-slate">Choose a password you&rsquo;ll use to sign in from now on.</p>

      <form action={formAction} className="mt-6 flex flex-col gap-3">
        <input
          type="password"
          name="password"
          required
          minLength={8}
          placeholder="New password (8+ characters)"
          className="rounded-md border border-rule bg-card px-3 py-2 text-sm"
        />
        <input
          type="password"
          name="confirm"
          required
          minLength={8}
          placeholder="Confirm password"
          className="rounded-md border border-rule bg-card px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink/90 disabled:opacity-50"
        >
          {pending ? "Saving..." : "Set password"}
        </button>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      </form>
    </main>
  );
}