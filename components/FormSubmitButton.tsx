"use client";

import { useFormStatus } from "react-dom";

/**
 * A `useFormStatus()`-based submit button for a `<form>` whose button
 * needs its own label/class rather than `components/submit/SubmitButton.tsx`'s
 * fixed one (2026-11-14, generalizing that same fix across the rest of
 * the app -- the user's own follow-up, after the double-submission fix
 * on Submit Announcement/Agenda Item: "Can we ensure all buttons have
 * some kind of reaction once they are pushed so we don't get double
 * pushing?"). This exact shape -- a plain `<form action={inlineServerAction}>`
 * with a bare, never-disabled `<button type="submit">` -- turned out to
 * repeat across more than a dozen Server Component pages (Add Calling,
 * Publish/Archive, Sync, Delete, etc.), each with its own custom label
 * and class, which is what this one small shared component covers
 * instead of a dozen near-identical one-off wrappers.
 */
export function FormSubmitButton({
  children,
  pendingLabel,
  className,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:cursor-not-allowed disabled:opacity-50`}>
      {pending ? pendingLabel : children}
    </button>
  );
}
