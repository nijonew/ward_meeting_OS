"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties } from "react";

/**
 * One row's own drag plumbing, factored out of every individual
 * reorderable list in this app (2026-10-31) so each one only needs to
 * spread `rowProps` onto its own wrapping element (`<li>`, `<tr>`,
 * whatever fits that list's own markup) and `handleProps` onto its
 * `DragHandle` (`components/drag-reorder/DragHandle.tsx`).
 */
export function useSortableRow(id: string) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return {
    rowProps: { ref: setNodeRef, style },
    handleProps: { ...attributes, ...listeners },
    isDragging,
  };
}
