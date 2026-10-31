import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { getArchivedPeople } from "@/lib/data/archived-people";
import { ArchivedPersonRow } from "@/components/admin/ArchivedPersonRow";

/**
 * The read side of People's archive-instead-of-delete behavior
 * (2026-10-30, migration 091) -- the user's own request: "when someone
 * is deleted from the people page they should be added to a new
 * archived people page." Restore clears `archived_at` only (their
 * calling/login link stay cleared, see `archive_person`'s own doc
 * comment); Delete Permanently is a genuine, irreversible delete, kept
 * per the user's own confirmed choice for a real duplicate or mistake.
 */
export default async function ArchivedPeoplePage() {
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");

  if (!hasFeature(profile, "table_admin_people")) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Archived People" />
        <p className="mt-10 text-ink-muted">Your account doesn&rsquo;t have access to archived people.</p>
      </main>
    );
  }

  const people = await getArchivedPeople();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Archived People" />

      <section className="mt-4">
        <Link href="/admin" className="text-xs text-ink-muted hover:text-ink">
          &larr; All tables
        </Link>
        <h1 className="rise-in mt-2 font-display text-3xl leading-tight sm:text-4xl">Archived People</h1>
      </section>

      {people.length > 0 ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-rule text-left font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">
              <th className="pb-2 pr-3">Name</th>
              <th className="pb-2 pr-3">Archived</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <ArchivedPersonRow key={p.id} person={p} />
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-ink-muted">No archived people right now.</p>
      )}
    </main>
  );
}
