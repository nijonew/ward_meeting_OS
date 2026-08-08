import { addAgendaItemDirect, setAgendaItemStatus } from "@/app/meetings/[id]/bishopric-actions";
import type { AgendaItemRow } from "@/lib/data/bishopric-meeting";

export function AgendaItemsSection({
  meetingId,
  items,
}: {
  meetingId: string;
  items: AgendaItemRow[];
}) {
  const add = addAgendaItemDirect.bind(null, meetingId);

  return (
    <div className="rounded-lg border border-rule bg-card p-6">
      <h2 className="font-display text-xl">Agenda Items</h2>
      <p className="mt-1 text-xs text-slate">
        Items added here publish immediately. Anything submitted through the (separate) public
        submission form shows up here as pending, for you to review.
      </p>

      {items.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {items.map((item) => {
            const publish = setAgendaItemStatus.bind(null, item.id, meetingId, "published");
            const archive = setAgendaItemStatus.bind(null, item.id, meetingId, "archived");
            return (
              <li key={item.id} className="rounded-md border border-rule/60 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-ink">{item.title}</span>
                  <span className="flex items-center gap-2">
                    <span
                      className={[
                        "font-mono text-[10px] uppercase tracking-widest",
                        item.status === "published"
                          ? "text-sage"
                          : item.status === "archived"
                            ? "text-slate/50"
                            : "text-brass",
                      ].join(" ")}
                    >
                      {item.status}
                    </span>
                    {item.status !== "published" && (
                      <form action={publish}>
                        <button type="submit" className="text-xs text-slate hover:text-ink">
                          Publish
                        </button>
                      </form>
                    )}
                    {item.status !== "archived" && (
                      <form action={archive}>
                        <button type="submit" className="text-xs text-slate hover:text-ink">
                          Archive
                        </button>
                      </form>
                    )}
                  </span>
                </div>
                {item.body && <p className="mt-1 text-slate">{item.body}</p>}
                <p className="mt-1 text-[11px] text-slate/60">Submitted by {item.submitted_by_name}</p>
              </li>
            );
          })}
        </ul>
      )}

      <form action={add} className="mt-4 flex flex-col gap-2 border-t border-rule/60 pt-4">
        <input
          type="text"
          name="title"
          required
          placeholder="Title"
          className="rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
        />
        <textarea
          name="body"
          rows={2}
          placeholder="Details"
          className="rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
        />
        <button
          type="submit"
          className="w-fit rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink/90"
        >
          Add &amp; Publish
        </button>
      </form>
    </div>
  );
}