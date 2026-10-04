import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { getUnverifiedProfiles } from "@/lib/data/profile-verification";
import { getActivePeople } from "@/lib/data/people";
import { VerifyLoginRow } from "@/components/admin/VerifyLoginRow";
import { SyncCallingRolesButton } from "@/components/admin/SyncCallingRolesButton";

/**
 * Admin-only list of every login with no role set yet (2026-10-03,
 * the user's own request, after asking how to link a logged-in
 * account to a calling: "a notification for admins at the top of the
 * page... to verify the individual and their calling"). Reached
 * either from AppHeader's own banner (shown only when this list is
 * non-empty) or directly. Verifying bundles the two linkages this app
 * previously needed two separate manual steps for (see
 * PROJECT_CONTEXT.md's Architecture section) into one: match the login
 * to a person record, and set its role.
 */
export default async function VerifyLoginsPage() {
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");

  if (profile?.role !== "bishopric") {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Admin" />
        <p className="mt-10 text-ink-muted">Only the Bishopric can verify logins.</p>
      </main>
    );
  }

  const [profiles, people] = await Promise.all([getUnverifiedProfiles(), getActivePeople()]);

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Admin" />

      <section className="mt-4">
        <Link href="/admin" className="text-xs text-ink-muted hover:text-ink">
          &larr; All tables
        </Link>
        <h1 className="rise-in mt-2 font-display text-3xl leading-tight sm:text-4xl">Verify Logins</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Every login that hasn&rsquo;t been given a role yet -- they have no access to anything until
          one of these is resolved. Match each to a person (or add a new one), then set their role.
        </p>
        <p className="mt-2 text-xs text-ink-muted">
          Already-verified accounts whose role was set to match their calling (Table Admin&rsquo;s
          &ldquo;Calling → Role Mapping&rdquo; table) update automatically from then on when that
          calling changes hands. Use this only after adding a brand-new mapping, to apply it to
          whoever already holds that calling right now:
        </p>
        <div className="mt-2">
          <SyncCallingRolesButton />
        </div>
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
                <th className="pb-2">Role</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <VerifyLoginRow key={p.id} profile={p} people={people} canGrantBishop={Boolean(profile.isBishop)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
