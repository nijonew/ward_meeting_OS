import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { getAdminTableConfig } from "@/lib/admin/registry";
import { getAdminRows, getForeignKeyOptions, getMeetingFkOptions, getScopedFkOptions } from "@/lib/admin/table-data";
import { AdminTableEditor } from "@/components/admin/AdminTableEditor";
import { updateRow, insertRow, deleteRow } from "./actions";

export default async function AdminTablePage({ params }: { params: Promise<{ table: string }> }) {
  const { table } = await params;

  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");

  const config = getAdminTableConfig(table);
  if (!config) notFound();

  if (profile?.role !== "bishopric") {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Admin" />
        <p className="mt-10 text-slate">Only the Bishopric can access table admin.</p>
      </main>
    );
  }

  const rows = await getAdminRows(config);

  // Every foreign_key column gets its full, unscoped option list (used
  // directly for most columns, and as the fallback for a scoped column's
  // "add new row" case, before any row exists to scope by).
  const fkColumns = config.columns.filter((c) => c.type === "foreign_key" && c.foreignKey);
  const fkOptionEntries = await Promise.all(
    fkColumns.map(async (c) => {
      const fk = c.foreignKey!;
      const options =
        fk.table === "meetings"
          ? await getMeetingFkOptions(fk.meetingTypeSlug)
          : await getForeignKeyOptions(fk.table, fk.valueColumn, fk.labelColumn);
      return [c.column, options] as const;
    })
  );
  const fkOptions = Object.fromEntries(fkOptionEntries);

  // Columns with `scopedBy` additionally get a per-row-scope-value option
  // list (e.g. release_person_id narrowed to each row's own calling).
  const scopedFkOptions = await getScopedFkOptions(config, rows);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Admin" />

      <section className="mt-4">
        <Link href="/admin" className="text-xs text-slate hover:text-ink">
          &larr; All tables
        </Link>
        <h1 className="mt-2 font-display text-3xl leading-tight sm:text-4xl">{config.label}</h1>
        {config.description && <p className="mt-2 text-sm text-slate">{config.description}</p>}
      </section>

      <AdminTableEditor
        table={config.table}
        columns={config.columns}
        rows={rows}
        fkOptions={fkOptions}
        scopedFkOptions={scopedFkOptions}
        onUpdate={updateRow}
        onInsert={insertRow}
        onDelete={deleteRow}
      />
    </main>
  );
}
