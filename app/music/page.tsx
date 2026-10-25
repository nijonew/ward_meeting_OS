import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { BulkMusicEntry } from "@/components/music/BulkMusicEntry";
import { getActivePeople } from "@/lib/data/people";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { getAdminTableConfig } from "@/lib/admin/registry";
import {
  getAdminRows,
  getForeignKeyOptions,
  getMeetingFkOptions,
  getScopedFkOptions,
  getReverseLookupValues,
} from "@/lib/admin/table-data";
import { getSelectOptions } from "@/lib/data/select-options";
import { AdminTableEditor } from "@/components/admin/AdminTableEditor";
import { updateMusicRow, insertMusicRow, deleteMusicRow } from "@/app/music/actions";

/**
 * Rebuilt 2026-10-24 (the user's own request: "I want someone entering
 * music to be able to do it much like the page .../admin/sacrament_music").
 * Reuses the exact same `AdminTableEditor` component and
 * `sacrament_music` registry column config Table Admin's own
 * `/admin/sacrament_music` renders -- full inline edit/add/delete
 * across every field, sortable/filterable columns, the same
 * `createIfMissing` calendar picker that creates a meeting on the fly
 * for a future Sunday with no row yet -- but gated on `sacrament_music`
 * (the Music planner feature), not `table_admin_sacrament_music`, same
 * split `app/announcements/page.tsx` already established for Manage
 * Announcements vs. raw Table Admin access (see that page's own doc
 * comment for the identical reasoning).
 *
 * `QuickAddMusic` (a single-row add form) and `RecentMusicList` (a
 * read-only recap of upcoming submissions) are deleted outright, not
 * left unlinked -- the grid already covers both and more (every row is
 * directly editable, not just addable, and sortable/filterable rather
 * than a fixed recap). `BulkMusicEntry` (paste many rows from a
 * spreadsheet at once) stays -- it's a genuinely different, faster bulk
 * workflow the grid has no equivalent for, same reasoning Manage
 * Announcements kept its own "stray agenda items" fallback alongside
 * its grid.
 */
export default async function MusicPage() {
  const { user, profile } = await getSessionUser();

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Music" />
        <p className="mt-10 text-ink-muted">Sign in to add music.</p>
        <Link
          href="/login"
          className="mt-4 inline-flex w-fit items-center rounded bg-accent px-5 py-2.5 font-body text-sm font-medium text-paper transition-colors hover:bg-accent-deep"
        >
          Sign in
        </Link>
      </main>
    );
  }

  const canEnterMusic = hasFeature(profile, "sacrament_music");

  if (!canEnterMusic) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Music" />
        <p className="mt-10 text-ink-muted">
          Your account doesn&rsquo;t have access to music entry yet. Ask the Bishopric to assign
          you the Music planner role.
        </p>
      </main>
    );
  }

  const config = getAdminTableConfig("sacrament_music");
  if (!config) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Music" />
        <p className="mt-10 text-ink-muted">Sacrament Meeting Music table isn&rsquo;t configured.</p>
      </main>
    );
  }

  const [people, rows] = await Promise.all([getActivePeople(), getAdminRows(config)]);

  // Same resolution /admin/[table]/page.tsx does for every table --
  // sacrament_music doesn't currently use any of select-with-live-options,
  // scopedBy, or reverse_lookup columns, but resolving them the same way
  // here keeps this page from silently drifting if that ever changes.
  const resolvedColumns = await Promise.all(
    config.columns.map(async (c) => {
      if (c.type === "select" && c.optionsFrom) {
        return { ...c, options: await getSelectOptions(c.optionsFrom, c.options ?? []) };
      }
      return c;
    })
  );

  const fkColumns = resolvedColumns.filter((c) => c.type === "foreign_key" && c.foreignKey);
  const fkOptionEntries = await Promise.all(
    fkColumns.map(async (c) => {
      const fk = c.foreignKey!;
      const options =
        fk.table === "meetings" ? await getMeetingFkOptions(fk.meetingTypeSlug) : await getForeignKeyOptions(fk.table, fk.valueColumn, fk.labelColumn);
      return [c.column, options] as const;
    })
  );
  const fkOptions = Object.fromEntries(fkOptionEntries);
  const scopedFkOptions = await getScopedFkOptions(config, rows);
  const reverseLookupValues = await getReverseLookupValues(config, rows);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Music" />

      <section className="mt-4">
        <h1 className="rise-in font-display text-3xl leading-tight sm:text-4xl">Sacrament Meeting Music Planning</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Every hymn, musical number, and performer for every upcoming (and past) Sacrament
          Meeting, fully editable -- the same grid Table Admin&rsquo;s own Sacrament Meeting Music
          table uses. Pick any upcoming Sunday, even one with no meeting yet -- it&rsquo;s created
          automatically when you save.
        </p>
      </section>

      <AdminTableEditor
        table="sacrament_music"
        columns={resolvedColumns}
        rows={rows}
        fkOptions={fkOptions}
        scopedFkOptions={scopedFkOptions}
        reverseLookupValues={reverseLookupValues}
        onUpdate={updateMusicRow}
        onInsert={insertMusicRow}
        onDelete={deleteMusicRow}
      />

      <BulkMusicEntry people={people} />

      <footer className="mt-auto pt-16 text-xs text-ink-muted">
        Ward Meeting OS
      </footer>
    </main>
  );
}
