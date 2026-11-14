"use client";

import { useFormStatus } from "react-dom";

/**
 * Disables itself while its parent `<form>`'s own Server Action is in
 * flight -- fixes a real bug, 2026-11-14 (the user's own report:
 * "submitting an announcement adds it twice"). Both `AnnouncementForm`
 * and `AgendaItemForm` were a plain `<form action={onSubmit}>` with a
 * bare `<button type="submit">`, never disabled, with no "Submitting..."
 * feedback at all -- a double-click (or an impatient second click on a
 * slow connection, before the redirect that follows a successful insert
 * actually lands) fires the same Server Action twice, inserting two
 * rows from one real submission. `useFormStatus` reads the nearest
 * parent `<form>`'s own pending state, so this needs no change to
 * either action's own signature (unlike `useActionState`, which would
 * also require a `prevState` param and a returned state object) --
 * both actions keep their existing plain `(formData) => Promise<void>`
 * shape.
 */
export function SubmitButton({ children = "Submit" }: { children?: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-1 w-fit rounded bg-accent px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Submitting..." : children}
    </button>
  );
}
