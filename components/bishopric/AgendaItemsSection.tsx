"use client";

import { useRef, useState, useTransition } from "react";
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
 *    migration 078's new `agenda_items.notes` column.
 *
 * **Converted to a Client Component, 2026-11-01** -- same reason as
 * `ActionItemsSection.tsx`'s identical conversion: the old per-row
 * inline `"use server"` closures (`publish`/`archive`/`saveNotes`)
 * only work when the importing module is part of the server tree, not
 * pulled into a client bundle, which this one now is via
 * `CollaborativeMeetingBody.tsx`. `saveAgendaItemNotes`/
 * `setAgendaItemStatus` were already real, standalone exported Server
 * Actions -- this only changes how they're called (direct, via
 * `useTransition`, same pattern `RotationMemberList.tsx`'s own Remove
 * button already established), not what they do. No bulk-save button
 * here either -- Publish/Archive/Save notes all still commit
 * immediately per item, so this stays outside the Planning page's
 * combined "Save All Changes" button.
 */
function AgendaItemRowView({ item, meetingId }: { item: AgendaItemRow; meetingId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  const setStatus = (status: "published" | "archived") => {
    setError(null);
    startTransition(async () => {
      const result = await setAgendaItemStatus(item.id, meetingId, status);
      if ("error" in result) setError(result.error);
    });
  };

  const saveNotes = () => {
    setError(null);
    startTransition(async () => {
      const result = await saveAgendaItemNotes(item.id, meetingId, notesRef.current?.value ?? "");
      if ("error" in result) setError(result.error);
    });
  };

  return (
    <li className="rounded border border-rule/60 px-3 py-2 text-sm">
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
            <button
              type="button"
              onClick={() => setStatus("published")}
              disabled={pending}
              className="text-xs text-ink-muted hover:text-ink disabled:opacity-50"
            >
              Publish
            </button>
          )}
          {item.status !== "archived" && (
            <button
              type="button"
              onClick={() => setStatus("archived")}
              disabled={pending}
              className="text-xs text-ink-muted hover:text-ink disabled:opacity-50"
            >
              Archive
            </button>
          )}
        </span>
      </div>
      {item.body && <p className="mt-1 text-ink-muted">{item.body}</p>}
      <p className="mt-1 text-[11px] text-ink-muted/60">Submitted by {item.submitted_by_name}</p>

      <div className="mt-2 flex flex-col gap-1.5">
        <label className="font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">
          Notes
          <textarea
            ref={notesRef}
            defaultValue={item.notes ?? ""}
            rows={2}
            className="mt-1 block w-full rounded border border-rule bg-paper px-2 py-1.5 text-sm text-ink"
          />
        </label>
        <button
          type="button"
          onClick={saveNotes}
          disabled={pending}
          className="w-fit rounded border border-rule px-2.5 py-1 text-xs text-ink hover:bg-ink/5 disabled:opacity-50"
        >
          Save notes
        </button>
        {error && <p className="text-[11px] text-danger">{error}</p>}
      </div>
    </li>
  );
}

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
          {items.map((item) => (
            <AgendaItemRowView key={item.id} item={item} meetingId={meetingId} />
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-ink-muted/50">No agenda items yet.</p>
      )}
    </div>
  );
}
