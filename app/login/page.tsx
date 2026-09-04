"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInWithPassword } from "@/app/auth/actions";

const initialState: { error?: string } = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signInWithPassword, initialState);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="font-display text-2xl">Ward OS</h1>
      <p className="mt-2 text-sm text-slate">Sign in with your email and password.</p>

      <form action={formAction} className="mt-6 flex flex-col gap-3">
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          className="rounded-md border border-rule bg-card px-3 py-2 text-sm"
        />
        <input
          type="password"
          name="password"
          required
          placeholder="Password"
          className="rounded-md border border-rule bg-card px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink/90 disabled:opacity-50"
        >
          {pending ? "Signing in..." : "Sign in"}
        </button>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      </form>

      <Link href="/auth/reset-password" className="mt-4 text-xs text-slate underline">
        Forgot your password, or signing in for the first time?
      </Link>
    </main>
  );
}