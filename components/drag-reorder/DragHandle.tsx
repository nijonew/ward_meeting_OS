"use client";

import type { ButtonHTMLAttributes } from "react";

/**
 * The one grip-dot icon every drag-reorderable list in this app uses
 * (2026-10-31, replacing every Move Up/Down button pair) -- props come
 * straight from `useSortableRow`'s own `handleProps`
 * (`lib/hooks/use-sortable-row.ts`). A plain inline SVG, not an icon
 * library -- this app has never added one, and six circles isn't worth
 * a new dependency for.
 */
export function DragHandle(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      aria-label="Drag to reorder"
      className="flex-none cursor-grab touch-none rounded p-1 text-ink-muted hover:text-ink active:cursor-grabbing"
    >
      <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
        <circle cx="2.5" cy="2" r="1.5" />
        <circle cx="7.5" cy="2" r="1.5" />
        <circle cx="2.5" cy="8" r="1.5" />
        <circle cx="7.5" cy="8" r="1.5" />
        <circle cx="2.5" cy="14" r="1.5" />
        <circle cx="7.5" cy="14" r="1.5" />
      </svg>
    </button>
  );
}
