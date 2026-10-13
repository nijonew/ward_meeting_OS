import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getGeneralSubmissions } from "@/lib/data/general-submissions";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { getAdminTableConfig } from "@/lib/admin/registry";
import { getAdminRows, getMeetingFkOptions } from "@/lib/admin/table-data";
import { getSelectOptions } from "@/lib/data/select-options";
import { AdminTableEditor } from "@/components/admin/AdminTableEditor";
import { setSubmissionStatus, updateAnnouncementRow, insertAnnouncementRow, deleteAnnouncementRow } from "@/app/announcements/actions";

/**
 * Rebuilt 2026-10-12 (the user's own report: "Manage announcements...
 * looks like no real management can happen here and that it is
 * essentially a viewing location again," comparing it directly against
 * Table Admin's own `announcements` grid: "this is basically what I
 * want manage announcements to be"). The old version of this page was a
 * thin Publish/Archive-only list over `getGeneralSubmissions` -- no way
 * to fix a typo, correct a date, or edit any other field short of
 * going to Table Admin directly.
 *
 * Now reuses the exact same `AdminTableEditor` component and
 * `announcements` registry column config (Title/Body/Organization/
 * Type/Audience/Where Announced/dates/Location/Link/Submitted
 * By/Email/Status/Meeting) that /admin/announcements renders --
 * full inline edit, add, and delete, not just a status toggle -- but
 * gated on `announcement_management` rather than
 * `table_admin_announcements` (see app/announcements/actions.ts's own
 * comment for why these needed their own actions rather than reusing
 * app/admin/[table]/actions.ts directly). `AdminTableEditor` itself
 * has no per-table logic of its own, so sharing it here doesn't risk
 * drifting from Table Admin's own behavior.
 *
 * Agenda items with no meeting yet are vanishingly rare now that
 * submission always resolves straight to a real meeting
 * (`getOrCreateMeetingId`, 2026-09-09) -- kept as a small fallback
 * list below the grid, using the original Publish/Archive controls,
 * so a genuinely stray one is never silently hidden.
 */
export default async function AnnouncementsInboxPage() {
  const { user, profile } = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  if (!hasFeature(profile, "announcement_management")) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Announcements" />
        <p className="mt-10 text-ink-muted">Your account doesn&rsquo;t have access to review submissions.</p>
      </main>
    );
  }

  const config = getAdminTableConfig("announcements");
  if (!config) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Announcements" />
        <p className="mt-10 text-ink-muted">Announcements table isn&rsquo;t configured.</p>
      </main>
    );
  }

  const rows = await getAdminRows(config);

  // Same resolution the generic /admin/[table] page does -- a select
  // column with `optionsFrom` reads its live choices from
  // admin_select_options instead of its hardcoded fallback. The
  // announcements registry entry doesn't use optionsFrom today, but
  // resolving it the same way here keeps this page from silently
  // drifting if that ever changes.
  const resolvedColumns = await Promise.all(
    config.columns.map(async (c) => {
      if (c.type === "select" && c.optionsFrom) {
        return { ...c, options: await getSelectOptions(c.optionsFrom, c.options ?? []) };
      }
      return c;
    })
  );

  const meetingColumn = resolvedColumns.find((c) => c.type === "foreign_key" && c.foreignKey);
  const fkOptions = meetingColumn?.foreignKey
    ? { [meetingColumn.column]: await getMeetingFkOptions(meetingColumn.foreignKey.meetingTypeSlug) }
    : {};

  const generalSubmissions = await getGeneralSubmissions();
  const strayAgendaItems = generalSubmissions.filter((item) => item.kind === "agenda_item");

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Announcements" />

      <section className="mt-4">
        <h1 className="rise-in font-display text-3xl leading-tight sm:text-4xl">Manage Announcements</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Every submitted announcement, fully editable -- the same grid Table Admin&rsquo;s own
          Announcements table uses. Set Status to Published to show one on the public page, or
          Archived to exclude it.
        </p>
      </section>

      <AdminTableEditor
        table="announcements"
        columns={resolvedColumns}
        rows={rows}
        fkOptions={fkOptions}
        onUpdate={updateAnnouncementRow}
        onInsert={insertAnnouncementRow}
        onDelete={deleteAnnouncementRow}
      />

      {strayAgendaItems.length > 0 && (
        <div className="rounded border border-rule bg-surface p-6">
          <h2 className="font-display text-xl">Agenda Items With No Meeting Yet</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Agenda items now resolve straight to a real meeting on submission, so this should
            normally stay empty -- these are stray leftovers that never got one.
          </p>
          <ul className="mt-4 flex flex-col gap-2">
            {strayAgendaItems.map((item) => {
              const publish = async () => {
                "use server";
                await setSubmissionStatus(item.kind, item.id, "published");
              };
              const archive = async () => {
                "use server";
                await setSubmissionStatus(item.kind, item.id, "archived");
              };
              return (
                <li key={`${item.kind}-${item.id}`} className="rounded border border-rule/60 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-ink">{item.title}</span>
                    <span className="flex items-center gap-2">
                      <span
                        className={[
                          "font-mono text-[10px] uppercase tracking-wider",
                          item.status === "published"
                            ? "text-success"
                            : item.status === "archived"
                              ? "text-ink-muted/50"
                              : "text-accent",
                        ].join(" ")}
                      >
                        {item.status}
                      </span>
                      {item.status !== "published" && (
                        <form action={publish}>
                          <button type="submit" className="text-xs text-ink-muted hover:text-ink">
                            Publish
                          </button>
                        </form>
                      )}
                      {item.status !== "archived" && (
                        <form action={archive}>
                          <button type="submit" className="text-xs text-ink-muted hover:text-ink">
                            Archive
                          </button>
                        </form>
                      )}
                    </span>
                  </div>
                  {item.body && <p className="mt-1 text-ink-muted">{item.body}</p>}
                  <p className="mt-1 text-[11px] text-ink-muted/60">
                    {item.submitted_by_name} &lt;{item.submitted_by_email}&gt;
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </main>
  );
}
