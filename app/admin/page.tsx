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

function TableList({ tables }: { tables: AdminTableConfig[] }) {
  return (
    <ul className="divide-y divide-rule rounded border border-rule bg-surface">
      {tables.map((t) => (
        <li key={t.table}>
          <Link href={`/admin/${t.table}`} className="flex items-baseline justify-between px-6 py-4 hover:bg-paper">
            <span className="font-medium text-ink">{t.label}</span>
            {t.description && <span className="ml-4 truncate text-xs text-ink-muted">{t.description}</span>}
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
        <p className="mt-2 text-sm text-ink-muted">
          Direct edit access to the underlying data tables. Fields tied to app logic (rotation order,
          meeting stage, and the like) are intentionally left out here. Use their dedicated pages
          for those.
        </p>
      </section>

      {everydayTables.length === 0 ? (
        <p className="text-sm text-ink-muted">No tables configured yet.</p>
      ) : (
        <TableList tables={everydayTables} />
      )}

      {sacramentTables.length > 0 && (
        <section>
          <h2 className="font-display text-xl">Sacrament Meeting Content</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Raw-data fallback for troubleshooting or a bulk fix. For everyday planning, open that
            meeting&rsquo;s own Planning view instead. It already brings Music, Speakers, RABNM, and
            Rotations together in one screen for that meeting.
          </p>
          <div className="mt-3">
            <TableList tables={sacramentTables} />
          </div>
        </section>
      )}

      {(canManageTemplates || canVerifyLogins || canManageCallingFeatures) && (
        <section>
          <h2 className="font-display text-xl">Other Admin Tools</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Not generic-grid editors -- these have dedicated add/remove/reorder UIs of their own.
          </p>
          <ul className="mt-3 divide-y divide-rule rounded border border-rule bg-surface">
            {canManageCallingFeatures && (
              <li>
                <Link
                  href="/admin/calling-features"
                  className="flex items-baseline justify-between px-6 py-4 hover:bg-paper"
                >
                  <span className="font-medium text-ink">Calling Features</span>
                  <span className="ml-4 truncate text-xs text-ink-muted">
                    Pick a calling, check off every feature it grants -- replaces hand-adding rows
                    to the raw Calling Features table one at a time
                  </span>
                </Link>
              </li>
            )}
            {canManageTemplates && (
              <li>
                <Link
                  href="/admin/meeting-templates"
                  className="flex items-baseline justify-between px-6 py-4 hover:bg-paper"
                >
                  <span className="font-medium text-ink">Meeting Templates</span>
                  <span className="ml-4 truncate text-xs text-ink-muted">
                    Default agenda elements new meetings are seeded with, by meeting type (and
                    format, for Sacrament Meeting)
                  </span>
                </Link>
              </li>
            )}
            {canVerifyLogins && (
              <li>
                <Link
                  href="/admin/verify-logins"
                  className="flex items-baseline justify-between px-6 py-4 hover:bg-paper"
                >
                  <span className="font-medium text-ink">Verify Logins</span>
                  <span className="ml-4 truncate text-xs text-ink-muted">
                    Match a new login to a person -- their access then follows automatically from
                    whichever calling(s) that person holds. Also reachable from the banner at the
                    top of the page whenever one is waiting.
                  </span>
                </Link>
              </li>
            )}
          </ul>
        </section>
      )}
    </main>
  );
}
