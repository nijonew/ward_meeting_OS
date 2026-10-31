import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser, hasFeature, type Feature } from "@/lib/supabase/get-session-user";
import { getAdminTableConfig } from "@/lib/admin/registry";
import {
  getAdminRows,
  getScopedFkOptions,
  getReverseLookupValues,
  resolveColumnsWithLiveOptions,
  resolveForeignKeyOptions,
} from "@/lib/admin/table-data";
import { AdminTableEditor } from "@/components/admin/AdminTableEditor";
import { updateRow, insertRow, deleteRow } from "./actions";

export default async function AdminTablePage({ params }: { params: Promise<{ table: string }> }) {
  const { table } = await params;

  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");

  const config = getAdminTableConfig(table);
  if (!config) notFound();

  if (!hasFeature(profile, config.requiredFeature as Feature)) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Admin" />
        <p className="mt-10 text-ink-muted">You don&rsquo;t have access to this table.</p>
      </main>
    );
  }

  // Every one of these only needs `config` (not each other, and not
  // `rows`), so they run as one concurrent wave instead of a strictly
  // sequential chain (2026-10-31, chasing the user's own "this app is
  // extremely slow" report) -- a select column's live options and a
  // foreign-key column's option list are both independent of fetching
  // this table's own rows.
  const [rows, resolvedColumns, fkOptions] = await Promise.all([
    getAdminRows(config),
    resolveColumnsWithLiveOptions(config.columns),
    resolveForeignKeyOptions(config.columns),
  ]);

  // Both of these need `rows` (just fetched above), but not each other
  // or the two columns/options above -- a second concurrent wave.
  const [scopedFkOptions, reverseLookupValues] = await Promise.all([
    // Columns with `scopedBy` additionally get a per-row-scope-value
    // option list (e.g. release_person_id narrowed to each row's own
    // calling).
    getScopedFkOptions(config, rows),
    // reverse_lookup columns (e.g. People's "Calling") have no real
    // column on this table to come back with `rows` -- resolved
    // separately.
    getReverseLookupValues(config, rows),
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Admin" />

      <section className="mt-4">
        <Link href="/admin" className="text-xs text-ink-muted hover:text-ink">
          &larr; All tables
        </Link>
        <h1 className="rise-in mt-2 font-display text-3xl leading-tight sm:text-4xl">{config.label}</h1>
      </section>

      <AdminTableEditor
        table={config.table}
        columns={resolvedColumns}
        rows={rows}
        fkOptions={fkOptions}
        scopedFkOptions={scopedFkOptions}
        reverseLookupValues={reverseLookupValues}
        onUpdate={updateRow}
        onInsert={insertRow}
        onDelete={deleteRow}
        deleteLabel={config.archiveRpc ? "Archive" : undefined}
      />
    </main>
  );
}
