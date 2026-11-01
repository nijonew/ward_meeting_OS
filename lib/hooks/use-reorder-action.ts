"use client";

import { useState, useTransition } from "react";

/**
 * Wraps a reorder server action with the small bit of error-surfacing
 * boilerplate every drag-reorderable list in this app needs
 * (2026-10-31) -- the list itself already updates optimistically
 * (`DragReorderGroup`'s own job); this only tracks whether the save
 * that follows actually succeeded, same "never swallow a real error"
 * principle every other action-backed form in this app already
 * follows.
 */
export function useReorderAction(action: (orderedIds: string[]) => Promise<unknown>) {
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function onReorder(orderedIds: string[]) {
    startTransition(async () => {
      const result = await action(orderedIds);
      const message =
        result && typeof result === "object" && "error" in result && typeof (result as { error?: unknown }).error === "string"
          ? ((result as { error: string }).error ?? null)
          : null;
      setError(message);
    });
  }

  return { onReorder, error };
}
