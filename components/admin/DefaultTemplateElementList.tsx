"use client";

import { useRef, useState, useTransition } from "react";
import {
  removeDefaultTemplateElement,
  setDefaultTemplateSlotCount,
  setDefaultTemplateElementOrder,
} from "@/app/admin/meeting-templates/actions";
import { DragReorderGroup } from "@/components/drag-reorder/DragReorderGroup";
import { DragHandle } from "@/components/drag-reorder/DragHandle";
import { useSortableRow } from "@/lib/hooks/use-sortable-row";
import { useReorderAction } from "@/lib/hooks/use-reorder-action";
import type { TemplateElementRow } from "@/lib/data/meeting-elements";

type ActionResult = { success: true } | { error: string };

/**
 * Admin > Meeting Templates' own already-on-the-template list -- a
 * drag handle instead of Move Up/Down (2026-10-31, "apply broadly
 * everywhere!"). Extracted into its own Client Component for this,
 * same reason as `TemplateElementList.tsx`'s identical extraction for
 * the per-meeting Agenda Elements page: a Server Component's inline
 * per-row "use server" closures can't run a drag interaction.
 */
export function DefaultTemplateElementList({
  meetingTypeId,
  formatKey,
  included,
}: {
  meetingTypeId: string;
  formatKey: string | null;
  included: TemplateElementRow[];
}) {
  const byId = new Map(included.map((el) => [el.id, el]));
  const { onReorder, error: reorderError } = useReorderAction((orderedIds) =>
    setDefaultTemplateElementOrder(meetingTypeId, formatKey, orderedIds)
  );

  if (included.length === 0) {
    return <p className="text-sm text-ink-muted">No elements added yet.</p>;
  }

  return (
    <>
      <DragReorderGroup ids={included.map((el) => el.id)} onReorder={onReorder}>
        {(orderedIds) => (
          <div className="flex flex-col gap-2">
            {orderedIds.map((id) => {
              const el = byId.get(id);
              return el ? <ElementRow key={id} el={el} /> : null;
            })}
          </div>
        )}
      </DragReorderGroup>
      {reorderError && <p className="mt-1 text-xs text-danger">{reorderError}</p>}
    </>
  );
}

function ElementRow({ el }: { el: TemplateElementRow }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const slotRef = useRef<HTMLInputElement>(null);
  const { rowProps, handleProps } = useSortableRow(el.id);

  const run = (action: () => Promise<ActionResult>) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if ("error" in result) setError(result.error);
    });
  };

  return (
    <div {...rowProps} className="flex flex-wrap items-center justify-between gap-2 rounded border border-rule/60 px-3 py-2 text-sm">
      <span className="flex items-center gap-2 text-ink">
        <DragHandle {...handleProps} />
        {el.label}
      </span>
      <span className="flex items-center gap-2">
        {el.repeatable && (
          <>
            <input
              ref={slotRef}
              type="number"
              min={1}
              max={el.max_slots ?? undefined}
              defaultValue={el.slot_count ?? 1}
              className="w-14 rounded border border-rule bg-paper px-2 py-1 text-xs text-ink"
            />
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setDefaultTemplateSlotCount(el.id, Number(slotRef.current?.value ?? 1)))}
              className="text-xs text-ink-muted hover:text-ink disabled:opacity-30"
            >
              Set
            </button>
          </>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => removeDefaultTemplateElement(el.id))}
          className="text-xs text-danger/70 hover:text-danger disabled:opacity-30"
        >
          Remove
        </button>
      </span>
      {error && <p className="w-full text-[11px] text-danger">{error}</p>}
    </div>
  );
}
