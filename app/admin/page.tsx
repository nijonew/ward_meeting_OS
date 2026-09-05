import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { ADMIN_TABLES } from "@/lib/admin/registry";

export default async function AdminIndexPage() {
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");

  if (profile?.role !== "bishopric") {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Admin" />
        <p className="mt-10 text-slate">Only the Bishopric can access table admin.</p>
      </main>
    );
  }

  const tables = Object.values(ADMIN_TABLES);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Admin" />

      <section className="mt-4">
        <h1 className="font-display text-3xl leading-tight sm:text-4xl">Table Admin</h1>
        <p className="mt-2 text-sm text-slate">
          Direct edit access to the underlying data tables. Fields tied to app logic (rotation order,
          meeting stage, and the like) are intentionally left out here &mdash; use their dedicated pages
          for those.
        </p>
      </section>

      {tables.length === 0 ? (
        <p className="text-sm text-slate">No tables configured yet.</p>
      ) : (
        <ul className="divide-y divide-rule rounded-lg border border-rule bg-card">
          {tables.map((t) => (
            <li key={t.table}>
              <Link href={`/admin/${t.table}`} className="flex items-baseline justify-between px-6 py-4 hover:bg-paper">
                <span className="font-medium text-ink">{t.label}</span>
                {t.description && <span className="ml-4 truncate text-xs text-slate">{t.description}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section>
        <h2 className="font-display text-xl">Other Admin Tools</h2>
        <p className="mt-1 text-xs text-slate">
          Not generic-grid editors -- these have dedicated add/remove/reorder UIs of their own.
        </p>
        <ul className="mt-3 divide-y divide-rule rounded-lg border border-rule bg-card">
          <li>
            <Link
              href="/admin/meeting-templates"
              className="flex items-baseline justify-between px-6 py-4 hover:bg-paper"
            >
              <span className="font-medium text-ink">Meeting Templates</span>
              <span className="ml-4 truncate text-xs text-slate">
                Default agenda elements new meetings are seeded with, by meeting type (and format,
                for Sacrament Meeting)
              </span>
            </Link>
          </li>
        </ul>
      </section>
    </main>
  );
}
