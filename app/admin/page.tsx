import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser, hasFeature, type Feature } from "@/lib/supabase/get-session-user";
import { ADMIN_TABLES } from "@/lib/admin/registry";
import type { AdminTableConfig } from "@/lib/admin/types";

// These overlap almost entirely with what each Sacrament Meeting's own
// Planning view already renders in one place -- per the user's decision
// (2026-09-08, "fewer entry points, one screen per meeting"), Table
// Admin stays available for them as a raw-data fallback (troubleshooting,
// a bulk fix) rather than the everyday way to plan a meeting, which is
// why they're split into their own section below instead of the flat
// list every other table gets.
const SACRAMENT_CONTENT_TABLES = new Set([
  "sacrament_assignments",
  "sacrament_music",
  "sacrament_planning",
  "sacrament_rabnm",
  "sacrament_speakers_adults",
  "sacrament_speakers_youth",
]);

// Titles only, no per-row description (2026-10-25, the user's own
// request) -- each table's own `description` still exists in the
// registry and still renders once, at the top of that table's own
// `/admin/[table]` page -- only this index's own list rows dropped it.
function TableList({ tables }: { tables: AdminTableConfig[] }) {
  return (
    <ul className="divide-y divide-rule rounded border border-rule bg-surface">
      {tables.map((t) => (
        <li key={t.table}>
          <Link href={`/admin/${t.table}`} className="block px-6 py-4 font-medium text-ink hover:bg-paper">
            {t.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function AdminIndexPage() {
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");

  // Per-table now (2026-10-04, the user's own request: "table admin
  // for each table as a separate listing") -- the index itself needs
  // no blanket gate at all, it just lists whichever tables the viewer
  // actually has a feature for; an account with none of them simply
  // sees an empty list, same as any other filtered view in this app.
  const canManageTemplates = hasFeature(profile, "meeting_templates_admin");
  const canVerifyLogins = hasFeature(profile, "verify_logins");
  const canManageCallingFeatures = hasFeature(profile, "table_admin_callings");
  const canManagePeople = hasFeature(profile, "table_admin_people");
  const allTables = Object.values(ADMIN_TABLES).filter((t) => hasFeature(profile, t.requiredFeature as Feature));
  // Alphabetical, per the user's own request (2026-10-03) -- only this
  // main list; "Sacrament Meeting Content" below and "Other Admin
  // Tools" (Meeting Templates) each keep their own existing order.
  const everydayTables = allTables.filter((t) => !SACRAMENT_CONTENT_TABLES.has(t.table)).sort((a, b) => a.label.localeCompare(b.label));
  const sacramentTables = allTables.filter((t) => SACRAMENT_CONTENT_TABLES.has(t.table));

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Admin" />

      <section className="mt-4">
        <h1 className="rise-in font-display text-3xl leading-tight sm:text-4xl">Table Admin</h1>
      </section>

      {everydayTables.length === 0 ? (
        <p className="text-sm text-ink-muted">No tables configured yet.</p>
      ) : (
        <TableList tables={everydayTables} />
      )}

      {sacramentTables.length > 0 && (
        <section>
          <h2 className="font-display text-xl">Sacrament Meeting Content</h2>
          <div className="mt-3">
            <TableList tables={sacramentTables} />
          </div>
        </section>
      )}

      {(canManageTemplates || canVerifyLogins || canManageCallingFeatures || canManagePeople) && (
        <section>
          <h2 className="font-display text-xl">Other Admin Tools</h2>
          <ul className="mt-3 divide-y divide-rule rounded border border-rule bg-surface">
            {canManageCallingFeatures && (
              <li>
                <Link href="/admin/calling-features" className="block px-6 py-4 font-medium text-ink hover:bg-paper">
                  Calling Features
                </Link>
              </li>
            )}
            {canManageCallingFeatures && (
              <li>
                <Link href="/admin/person-callings" className="block px-6 py-4 font-medium text-ink hover:bg-paper">
                  Assign Callings
                </Link>
              </li>
            )}
            {canManageTemplates && (
              <li>
                <Link href="/admin/meeting-templates" className="block px-6 py-4 font-medium text-ink hover:bg-paper">
                  Meeting Templates
                </Link>
              </li>
            )}
            {canVerifyLogins && (
              <li>
                <Link href="/admin/verify-logins" className="block px-6 py-4 font-medium text-ink hover:bg-paper">
                  Verify Logins
                </Link>
              </li>
            )}
            {canManagePeople && (
              <li>
                <Link href="/admin/archived-people" className="block px-6 py-4 font-medium text-ink hover:bg-paper">
                  Archived People
                </Link>
              </li>
            )}
          </ul>
        </section>
      )}
    </main>
  );
}
