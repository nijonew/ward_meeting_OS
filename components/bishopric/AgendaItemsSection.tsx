import { saveAgendaItemNotes, setAgendaItemStatus } from "@/app/meetings/[id]/bishopric-actions";
import type { AgendaItemRow } from "@/lib/data/bishopric-meeting";

/**
 * Agenda Items, rendered inline in the Discussion section (2026-10-19)
 * -- two changes from the old version, both the user's own explicit
 * request:
 *
 * 1. The embedded "Add & Publish" quick-add form is gone. Adding an
 *    item is exclusively /submit/agenda-item from here on ("I also
 *    don't want a section of the page for adding agenda items. that is
 *    its own page with a different link") -- the existing publish/
 *    archive review controls for already-submitted items stay exactly
 *    as they were, only the *add* path moved off this page.
 * 2. Each item gets its own inline notes field, right under it --
 *    migration 078's new `agenda_items.notes` column, saved via its
 *    own small `<form>` per item (these items are already siblings,
 *    not nested inside anything, so a real `<form>` each is fine, same
 *    pattern ActionItemsSection.tsx already uses for its own per-row
 *    actions).
 */
export function AgendaItemsSection({
  meetingId,
  items,
}: {
  meetingId: string;
  items: AgendaItemRow[];
}) {
  return (
    <div className="rounded border border-rule bg-surface p-6">
      <h2 className="font-display text-xl">Agenda Items</h2>
      <p className="mt-1 text-xs text-ink-muted">
        Anything submitted through the public submission form shows up here as pending, for you to
        review.{" "}
        <a href="/submit/agenda-item" className="underline">
          Add an agenda item &rarr;
        </a>
      </p>

      {items.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-3">
          {items.map((item) => {
            const publish = async () => {
              "use server";
              await setAgendaItemStatus(item.id, meetingId, "published");
            };
            const archive = async () => {
              "use server";
              await setAgendaItemStatus(item.id, meetingId, "archived");
            };
            const saveNotes = async (formData: FormData) => {
              "use server";
              await saveAgendaItemNotes(item.id, meetingId, String(formData.get("notes") ?? ""));
            };
            return (
              <li key={item.id} className="rounded border border-rule/60 px-3 py-2 text-sm">
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
                <p className="mt-1 text-[11px] text-ink-muted/60">Submitted by {item.submitted_by_name}</p>

                <form action={saveNotes} className="mt-2 flex flex-col gap-1.5">
                  <label className="font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">
                    Notes
                    <textarea
                      name="notes"
                      defaultValue={item.notes ?? ""}
                      rows={2}
                      className="mt-1 block w-full rounded border border-rule bg-paper px-2 py-1.5 text-sm text-ink"
                    />
                  </label>
                  <button
                    type="submit"
                    className="w-fit rounded border border-rule px-2.5 py-1 text-xs text-ink hover:bg-ink/5"
                  >
                    Save notes
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-ink-muted/50">No agenda items yet.</p>
      )}
    </div>
  );
}
