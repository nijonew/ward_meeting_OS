"use client";

import { useTransition } from "react";
import { addActionItem, toggleActionItem } from "@/app/meetings/[id]/bishopric-actions";
import type { ActionItemRow } from "@/lib/data/bishopric-meeting";
import type { PersonOption } from "@/lib/data/people";

/**
 * **Converted to a Client Component, 2026-11-01** -- needed once
 * `CollaborativeMeetingBody.tsx` (a Client Component) started
 * importing this directly: the old per-row inline `"use server"`
 * closures (`toggle`) are only legal when the importing module is
 * itself part of the server tree, not pulled into a client bundle.
 * `addActionItem`/`toggleActionItem` were already real, standalone
 * exported Server Actions (`app/meetings/[id]/bishopric-actions.ts`,
 * a proper top-level `"use server"` file) -- this only changes how
 * they're CALLED, not what they do: the Add form now binds
 * `addActionItem` directly as its own `action` (no wrapper closure
 * needed at all), and Mark done/Undo calls `toggleActionItem` straight
 * from a plain `useTransition`, same pattern `RotationMemberList.tsx`'s
 * own Remove button already established. No bulk-save button here --
 * Add/Mark done both still commit immediately, so this stays outside
 * the Planning page's combined "Save All Changes" button.
 */
function ActionItemRowView({ item, meetingId }: { item: ActionItemRow; meetingId: string }) {
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    startTransition(() => {
      void toggleActionItem(item.id, meetingId, item.completed);
    });
  };

  return (
    <li className="flex items-start gap-3 rounded border border-rule/60 px-3 py-2 text-sm">
      <input type="checkbox" checked={item.completed} readOnly aria-hidden="true" className="mt-1" />
      <span className={["flex-1", item.completed ? "text-ink-muted/50 line-through" : "text-ink"].join(" ")}>
        {item.description}
        {item.assigned_to_name && <span className="text-ink-muted"> &middot; {item.assigned_to_name}</span>}
        {item.due_date && <span className="text-ink-muted"> (due {item.due_date})</span>}
      </span>
      <button type="button" onClick={toggle} disabled={pending} className="text-xs text-ink-muted hover:text-ink disabled:opacity-50">
        {item.completed ? "Undo" : "Mark done"}
      </button>
    </li>
  );
}

export function ActionItemsSection({
  meetingId,
  items,
  people,
}: {
  meetingId: string;
  items: ActionItemRow[];
  people: PersonOption[];
}) {
  // A plain client wrapper, not a bound server-action reference used
  // directly -- React's <form action> typing for a non-useActionState
  // target expects `void | Promise<void>`, but addActionItem (like
  // every action in this app) returns a real ActionResult. Discarding
  // it here matches this form's own pre-existing behavior exactly --
  // the old inline closure never surfaced an error either.
  const addAction = async (formData: FormData) => {
    await addActionItem(meetingId, formData);
  };

  return (
    <div className="rounded border border-rule bg-surface p-6">
      <h2 className="font-display text-xl">Action Items</h2>

      {items.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {items.map((item) => (
            <ActionItemRowView key={item.id} item={item} meetingId={meetingId} />
          ))}
        </ul>
      )}

      <form action={addAction} className="mt-4 flex flex-col gap-2 border-t border-rule/60 pt-4 sm:flex-row sm:items-end">
        <input
          type="text"
          name="description"
          required
          placeholder="Description"
          className="flex-1 rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
        />
        <select
          name="assigned_to_id"
          defaultValue=""
          className="rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
        >
          <option value="">Assign to</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          name="due_date"
          className="rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
        />
        <button
          type="submit"
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent-deep"
        >
          Add
        </button>
      </form>
    </div>
  );
}
