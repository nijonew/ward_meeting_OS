"use client";

import { useRef, useState, useTransition } from "react";
import {
  addPastAgendaItemToMeeting,
  saveAgendaItemNotes,
  setAgendaItemOrder,
  setAgendaItemStatus,
} from "@/app/meetings/[id]/bishopric-actions";
import { DragReorderGroup } from "@/components/drag-reorder/DragReorderGroup";
import { DragHandle } from "@/components/drag-reorder/DragHandle";
import { useSortableRow } from "@/lib/hooks/use-sortable-row";
import { useReorderAction } from "@/lib/hooks/use-reorder-action";
import type { AgendaItemRow, PastAgendaItemRow } from "@/lib/data/bishopric-meeting";

function formatMeetingDate(dateIso: string): string {
  if (!dateIso) return "";
  const date = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateIso;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * "Add from a past meeting" (2026-11-15, the user's own request: "add
 * past meeting agenda items by dropdown in non-sacrament meetings") --
 * a dropdown of this meeting type's own past agenda items (most
 * recent meeting first), for raising an item again that didn't get
 * addressed. Adds a fresh copy onto TODAY's meeting -- see
 * `addPastAgendaItemToMeeting`'s own doc comment for why this is a
 * copy, not a move. Plain button + `useTransition`, not a `<form>`,
 * matching every other "pull from a pool" picker already in this app
 * (Ward Business, RABNM, Announcements) -- committing immediately
 * rather than through any surrounding Save-All-Changes form.
 */
function AddPastItemPicker({ meetingId, pastItems }: { meetingId: string; pastItems: PastAgendaItemRow[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);

  if (pastItems.length === 0) return null;

  const add = () => {
    const itemId = selectRef.current?.value;
    if (!itemId) return;
    setError(null);
    setAdded(false);
    startTransition(async () => {
      const result = await addPastAgendaItemToMeeting(itemId, meetingId);
      if ("error" in result) setError(result.error);
      else {
        setAdded(true);
        if (selectRef.current) selectRef.current.value = "";
      }
    });
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <select
        ref={selectRef}
        defaultValue=""
        className="rounded border border-rule bg-paper px-2 py-1.5 text-sm text-ink"
      >
        <option value="" disabled>
          Add from a past meeting...
        </option>
        {pastItems.map((item) => (
          <option key={item.id} value={item.id}>
            {formatMeetingDate(item.meetingDate)} — {item.title}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={add}
        disabled={pending}
        className="rounded border border-rule px-2.5 py-1 text-xs text-ink hover:bg-ink/5 disabled:opacity-50"
      >
        {pending ? "Adding..." : "Add"}
      </button>
      {added && !pending && <span className="text-xs text-success">Added.</span>}
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}

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
 *
 * **Drag-reorderable, 2026-11-22** (migration 109, the user's own
 * request: "I would like to have a way to reorder agenda items with a
 * handle like we have done in other meetings. Please make this
 * ubiquitous in all non-sacrament meetings.") -- same shape as every
 * other drag-reorderable list in this app since 2026-10-31. Each row's
 * own `useSortableRow` call lives here rather than being passed down,
 * same pattern `ExistingRow` in `AnnouncementsField.tsx` already uses.
 */
function AgendaItemRowView({ item, meetingId }: { item: AgendaItemRow; meetingId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const { rowProps, handleProps } = useSortableRow(item.id);

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
    <li {...rowProps} className="rounded border border-rule/60 px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-ink">
          <DragHandle {...handleProps} />
          {item.title}
        </span>
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
  pastItems,
}: {
  meetingId: string;
  items: AgendaItemRow[];
  pastItems: PastAgendaItemRow[];
}) {
  const { onReorder, error: reorderError } = useReorderAction((orderedIds) => setAgendaItemOrder(meetingId, orderedIds));
  const byId = new Map(items.map((item) => [item.id, item]));

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

      <AddPastItemPicker meetingId={meetingId} pastItems={pastItems} />

      {items.length > 0 ? (
        <DragReorderGroup ids={items.map((item) => item.id)} onReorder={onReorder}>
          {(orderedIds) => (
            <ul className="mt-4 flex flex-col gap-3">
              {orderedIds.map((id) => {
                const item = byId.get(id);
                return item ? <AgendaItemRowView key={id} item={item} meetingId={meetingId} /> : null;
              })}
            </ul>
          )}
        </DragReorderGroup>
      ) : (
        <p className="mt-4 text-sm text-ink-muted/50">No agenda items yet.</p>
      )}
      {reorderError && <p className="mt-2 text-[11px] text-danger">{reorderError}</p>}
    </div>
  );
}
