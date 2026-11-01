"use client";

import { useState, type ReactNode } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";

/**
 * Shared drag-to-reorder context, used by every reorderable list in
 * this app (2026-10-31, the user's own request: "apply broadly
 * everywhere!" once asked about converting Move Up/Down buttons to a
 * drag handle). Deliberately doesn't render any DOM structure of its
 * own (no `<ul>`, no `<table>`) -- `children` is a render-prop over the
 * current ORDERED id list, so each caller renders whatever wrapping
 * element actually fits that list's own markup (a plain `<li>`, a
 * `<table>` row, etc.), with each row wired up via `useSortableRow`
 * (`lib/hooks/use-sortable-row.ts`).
 *
 * Reorders OPTIMISTICALLY -- the visible order updates the instant a
 * drag completes, before `onReorder`'s own server round trip resolves,
 * since waiting on that first would make dragging feel broken. Re-syncs
 * to `ids` whenever that prop's own content changes (a save elsewhere,
 * a page revalidation) by comparing the joined id string during
 * render -- not a `useEffect`, same "respond to a value that just
 * changed" pattern `AssignmentGridForm`'s own dirty-reset already uses
 * -- so there's no risk of a stale render flashing the old order first.
 */
export function DragReorderGroup({
  ids,
  onReorder,
  children,
}: {
  ids: string[];
  onReorder: (orderedIds: string[]) => void;
  children: (orderedIds: string[]) => ReactNode;
}) {
  const [order, setOrder] = useState(ids);
  const joined = ids.join(",");
  const [lastSynced, setLastSynced] = useState(joined);
  if (joined !== lastSynced) {
    setLastSynced(joined);
    setOrder(ids);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(String(active.id));
    const newIndex = order.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(order, oldIndex, newIndex);
    setOrder(next);
    onReorder(next);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        {children(order)}
      </SortableContext>
    </DndContext>
  );
}
