/**
 * Shared "not yet verified" message, 2026-11-25 (the user's own
 * report: someone was able to reach Youth Activities/both Lessons
 * pages/Calendar's youth items without ever being verified). Those
 * pages had only ever checked `!user` (any confirmed Supabase Auth
 * login) before rendering real content -- a deliberate choice at the
 * time for each one individually, but it meant a freshly self-signed-up
 * account (`/auth/request-access`) could browse all of it the instant
 * their email was confirmed, well before an admin ever linked them to
 * a `people` row via Verify Logins. Every one of those pages now also
 * checks `profile?.isLinked` (the real "has an admin verified this
 * account" signal, see `SessionProfile`'s own doc comment in
 * `lib/supabase/get-session-user.ts`) and renders this instead.
 *
 * Same wrapper/message shape every other feature-gated page in this
 * app already uses for "your account doesn't have access" (e.g.
 * `/calling-planning`'s own early return) -- pulled into one shared
 * component since this exact block is now needed on half a dozen
 * pages, real duplication worth collapsing.
 */
export function VerificationRequiredNotice() {
  return (
    <p className="mt-10 text-ink-muted">
      An admin still needs to verify your account before you can see this.
    </p>
  );
}
