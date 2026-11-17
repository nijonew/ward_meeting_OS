import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { getUnverifiedProfiles, getVerifiedProfiles } from "@/lib/data/profile-verification";
import { getActivePeople } from "@/lib/data/people";
import { VerifyLoginRow } from "@/components/admin/VerifyLoginRow";

function formatSignUpDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Admin-only list of every login not yet linked to a person (2026-10-03,
 * the user's own request, after asking how to link a logged-in
 * account to a calling: "a notification for admins at the top of the
 * page... to verify the individual and their calling"). Reached
 * either from AppHeader's own banner (shown only when this list is
 * non-empty) or directly.
 *
 * No role to pick anymore (2026-10-04, roles eliminated in favor of
 * per-calling feature flags -- see lib/supabase/get-session-user.ts):
 * verifying is purely matching the login to a real person. Once
 * linked, access comes automatically from whichever calling(s) that
 * person holds -- set those on the Callings grid in Table Admin, not
 * here.
 */
export default async function VerifyLoginsPage() {
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");

  if (!hasFeature(profile, "verify_logins")) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Admin" />
        <p className="mt-10 text-ink-muted">You don&rsquo;t have access to verify logins.</p>
      </main>
    );
  }

  const [profiles, people, verified] = await Promise.all([
    getUnverifiedProfiles(),
    getActivePeople(),
    getVerifiedProfiles(),
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Admin" />

      <section className="mt-4">
        <Link href="/admin" className="text-xs text-ink-muted hover:text-ink">
          &larr; All tables
        </Link>
        <h1 className="rise-in mt-2 font-display text-3xl leading-tight sm:text-4xl">Verify Logins</h1>
      </section>

      {profiles.length === 0 ? (
        <p className="text-sm text-ink-muted">Nothing to verify right now.</p>
      ) : (
        <div className="overflow-x-auto rounded border border-rule bg-surface p-6">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-rule text-left font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">
                <th className="pb-2">Login</th>
                <th className="pb-2">Person</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <VerifyLoginRow key={p.id} profile={p} people={people} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* "A list of approvals by date" (2026-11-16, the user's own
          request) -- every already-verified login, newest sign-up
          first. There's no recorded "approved on" moment anywhere in
          this schema (see getVerifiedProfiles's own doc comment), so
          per the user's own explicit choice, this uses each account's
          sign-up date instead -- the one date that's actually on
          record, for every account, past and future. */}
      <section>
        <h2 className="font-display text-xl">Already Verified</h2>
        <p className="mt-1 text-xs text-ink-muted">
          Sorted by sign-up date (not literally when it was verified -- that moment isn&rsquo;t
          recorded anywhere).
        </p>
        {verified.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted/50">No verified logins yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded border border-rule bg-surface p-6">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-rule text-left font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">
                  <th className="pb-2">Person</th>
                  <th className="pb-2">Login</th>
                  <th className="pb-2">Signed up</th>
                </tr>
              </thead>
              <tbody>
                {verified.map((v) => (
                  <tr key={v.personId} className="border-t border-rule/40">
                    <td className="py-2 pr-3 text-ink">{v.personName}</td>
                    <td className="py-2 pr-3 text-ink-muted">{v.email ?? "—"}</td>
                    <td className="py-2 text-ink-muted">{formatSignUpDate(v.signedUpAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
