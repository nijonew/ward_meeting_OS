import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getGeneralSubmissions } from "@/lib/data/general-submissions";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { getAdminTableConfig } from "@/lib/admin/registry";
import { getAdminRows, resolveColumnsWithLiveOptions, resolveForeignKeyOptions } from "@/lib/admin/table-data";
import { AdminTableEditor } from "@/components/admin/AdminTableEditor";
import { setSubmissionStatus, updateAnnouncementRow, insertAnnouncementRow, deleteAnnouncementRow } from "@/app/announcements/actions";
import { FormSubmitButton } from "@/components/FormSubmitButton";

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
 *
 * **Gained a form-based "Edit" link per row, 2026-11-14** (the user's
 * own request: "a way to edit announcements by using a form like the
 * entry form, rather than just the table"). `AdminTableEditor` has no
 * per-row extension point of its own (and this app deliberately avoids
 * adding per-table special cases to that shared, generic component),
 * so this is a small, separate list above the grid rather than a new
 * column inside it -- the grid itself is completely unchanged, still
 * the fast way to tweak one field inline; the new list is the slower,
 * fuller editing experience for everything at once.
 *
 * **That list became a dropdown of non-archived announcements,
 * 2026-11-15** (the user's own request: "update the edit via form
 * announcements list to a dropdown of non-archived announcements") --
 * a plain `<ul>` of every row grows unwieldy once there are more than
 * a handful, and an already-archived announcement is rarely what
 * someone reaches for this slower, fuller form to fix (the inline grid
 * below, or Table Admin, already covers that rare case). A plain
 * `method="get"` form (this app's own established "pick one, then go"
 * convention elsewhere, e.g. `/admin/calling-features`) doesn't fit
 * here -- each option's destination is a genuinely different path
 * (`/announcements/<id>/edit`), not a query-string variant of this
 * same page -- so this uses a real `<form action={goToEdit}>` with an
 * inline `"use server"` closure instead (the identical pattern this
 * page's own stray-agenda-items Publish/Archive buttons already use,
 * legal here since this whole page is a Server Component, never
 * pulled into a client bundle).
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

  // All four are independent of each other -- rows, live select
  // options, this table's one foreign-key column's options, and the
  // separate stray-agenda-items list all run concurrently instead of a
  // sequential chain (2026-10-31, chasing the user's own "this app is
  // extremely slow" report). resolveForeignKeyOptions generalizes what
  // this page used to resolve by hand for just its one "meeting"
  // column -- announcements has exactly one foreign_key column, so the
  // result is identical.
  const [rows, resolvedColumns, fkOptions, generalSubmissions] = await Promise.all([
    getAdminRows(config),
    resolveColumnsWithLiveOptions(config.columns),
    resolveForeignKeyOptions(config.columns),
    getGeneralSubmissions(),
  ]);
  const strayAgendaItems = generalSubmissions.filter((item) => item.kind === "agenda_item");
  const editableRows = rows.filter((row) => row.status !== "archived");

  const goToEdit = async (formData: FormData) => {
    "use server";
    const id = String(formData.get("announcement_id") ?? "");
    if (id) redirect(`/announcements/${id}/edit`);
  };

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

      <div className="rounded border border-rule bg-surface p-6">
        <h2 className="font-display text-xl">Edit via Form</h2>
        <p className="mt-1 text-xs text-ink-muted">
          The same form used to submit a new announcement, pre-filled -- easier than the grid
          below for changing several fields on one announcement at once. Archived announcements
          aren&rsquo;t listed here -- edit one of those in the grid below, or Table Admin.
        </p>
        {editableRows.length > 0 ? (
          <form action={goToEdit} className="mt-4 flex flex-wrap items-center gap-2">
            <select
              name="announcement_id"
              required
              defaultValue=""
              className="rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
            >
              <option value="" disabled>
                Choose an announcement...
              </option>
              {editableRows.map((row) => (
                <option key={row.id} value={row.id}>
                  {String(row.title ?? "(untitled)")}
                </option>
              ))}
            </select>
            <FormSubmitButton pendingLabel="Opening..." className="rounded border border-rule px-3 py-1.5 text-xs text-ink hover:bg-ink/5">
              Edit
            </FormSubmitButton>
          </form>
        ) : (
          <p className="mt-4 text-sm text-ink-muted/50">No non-archived announcements to edit.</p>
        )}
      </div>

      <AdminTableEditor
        table="announcements"
        columns={resolvedColumns}
        rows={rows}
        fkOptions={fkOptions}
        onUpdate={updateAnnouncementRow}
        onInsert={insertAnnouncementRow}
        onDelete={deleteAnnouncementRow}
        userId={user?.id ?? null}
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
                          <FormSubmitButton pendingLabel="Publishing..." className="text-xs text-ink-muted hover:text-ink">
                            Publish
                          </FormSubmitButton>
                        </form>
                      )}
                      {item.status !== "archived" && (
                        <form action={archive}>
                          <FormSubmitButton pendingLabel="Archiving..." className="text-xs text-ink-muted hover:text-ink">
                            Archive
                          </FormSubmitButton>
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
