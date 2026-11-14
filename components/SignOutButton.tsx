"use client";

import { FormSubmitButton } from "@/components/FormSubmitButton";

/**
 * Pulled out of AppHeader into its own small client component
 * (2026-11-14) -- AppHeader itself is an async Server Component (it
 * can't call useFormStatus directly), and it renders on nearly every
 * page in the app, so Sign out's own bare, never-disabled submit
 * button shared the same latent double-submit gap as everything else
 * fixed in this same pass. See FormSubmitButton's own comment.
 */
export function SignOutButton({ signOutAction }: { signOutAction: () => Promise<void> }) {
  return (
    <form action={signOutAction}>
      <FormSubmitButton
        pendingLabel="Signing out..."
        className="font-mono text-xs uppercase tracking-wider text-ink-muted transition-colors hover:text-ink"
      >
        Sign out
      </FormSubmitButton>
    </form>
  );
}
