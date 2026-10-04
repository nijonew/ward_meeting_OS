import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { getUnverifiedProfiles } from "@/lib/data/profile-verification";
import { getActivePeople } from "@/lib/data/people";
import { VerifyLoginRow } from "@/components/admin/VerifyLoginRow";

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
          Every login not yet matched to a person -- they have no access to anything until this is
          done. Match each to a person (or add a new one). Their access then comes automatically
          from whichever calling(s) that person holds, set on the Callings table in Table Admin.
        </p>
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
    </main>
  );
}
