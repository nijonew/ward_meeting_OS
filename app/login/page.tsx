import Link from "next/link";
import { getWardName } from "@/lib/data/ward-settings";
import { LoginForm } from "@/components/auth/LoginForm";

/** Converted to an async Server Component 2026-10-03 so the heading can
 *  read the admin-configurable ward name instead of a hardcoded "Ward
 *  OS" -- see components/AppHeader.tsx's own comment for the full
 *  context. The actual sign-in form (the only part needing client
 *  state) moved into LoginForm.tsx. */
export default async function LoginPage() {
  const wardName = await getWardName();

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <Link href="/" className="text-xs text-ink-muted hover:text-ink">
        &larr; Home
      </Link>
      <h1 className="mt-2 font-display text-2xl">{wardName} Ward</h1>
      <p className="mt-2 text-sm text-ink-muted">Sign in with your email and password.</p>

      <LoginForm />
    </main>
  );
}
