"use client";

import { useEffect, useState } from "react";

type SortDirection = "asc" | "desc";
export type SortState<K extends string> = { key: K; direction: SortDirection } | null;
export type FiltersState<K extends string> = Partial<Record<K, Set<string> | null>>;

interface StoredState<K extends string> {
  sort: SortState<K>;
  filters: Partial<Record<K, string[] | null>>;
}

function loadState<K extends string>(storageKey: string): StoredState<K> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as StoredState<K>) : null;
  } catch {
    return null;
  }
}

function saveState<K extends string>(storageKey: string, sort: SortState<K>, filters: FiltersState<K>) {
  if (typeof window === "undefined") return;
  try {
    const serializedFilters: Partial<Record<K, string[] | null>> = {};
    const entries = Object.entries(filters) as [K, Set<string> | null | undefined][];
    for (const [key, value] of entries) {
      serializedFilters[key] = value == null ? null : [...value];
    }
    window.localStorage.setItem(storageKey, JSON.stringify({ sort, filters: serializedFilters }));
  } catch {
    // Storage full or unavailable (private browsing, etc.) -- not worth surfacing to the user.
  }
}

/**
 * Persists a grid's sort + per-column filter selections to localStorage
 * so a page refresh doesn't reset them (2026-10-10, the user's own
 * request, right after the Excel-style filter and row-contrast passes:
 * "is there a way to remember the sorts and filters so they don't reset
 * every time the page is refreshed"). Shared by CallingPlanningGridForm
 * and ActivitiesTable -- the only two grids in this app with sort/filter
 * at all (Assignment Rotations, Teaching Planning, and the Dashboard
 * meeting list only ever got the row-contrast treatment, never sort or
 * filter).
 *
 * React state here always starts empty/unsorted on both the server and
 * the client's own first render, so hydration never mismatches what the
 * server actually sent (localStorage doesn't exist server-side, and a
 * lazy `useState` initializer reading it would make the client's first
 * render disagree with the server-rendered HTML). A single mount-only
 * effect restores the saved state right after that first commit --
 * there's a one-frame flash from default to restored on load, an
 * accepted tradeoff for any localStorage-backed UI state in a
 * server-rendered app. A second effect persists every change from then
 * on, gated on a `hasHydrated` flag that only flips true once the
 * restore effect finishes, so it can never fire with the pre-restoration
 * defaults and silently overwrite a real saved state before it's even
 * been read back.
 *
 * `storageKey` must be unique per grid *instance*, not just per
 * component -- ActivitiesTable is one shared component rendered on four
 * different pages (Upcoming Activities, Combined YM & YW, Combined YM,
 * Combined YW), each needing its own independent remembered state.
 */
export function usePersistedSortFilter<K extends string>(storageKey: string) {
  const [sort, setSort] = useState<SortState<K>>(null);
  const [filters, setFilters] = useState<FiltersState<K>>({});
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    // Reading an external system (localStorage) on mount and syncing it
    // into React state is exactly the legitimate useEffect case React's
    // own docs describe -- not the "derive state from a render" anti-
    // pattern react-hooks/set-state-in-effect otherwise warns about.
    /* eslint-disable react-hooks/set-state-in-effect */
    const saved = loadState<K>(storageKey);
    if (saved) {
      setSort(saved.sort ?? null);
      const restored: FiltersState<K> = {};
      const entries = Object.entries(saved.filters ?? {}) as [K, string[] | null | undefined][];
      for (const [key, values] of entries) {
        restored[key] = values == null ? null : new Set(values);
      }
      setFilters(restored);
    }
    setHasHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps -- storageKey is a stable identity per grid instance
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    saveState(storageKey, sort, filters);
  }, [storageKey, sort, filters, hasHydrated]);

  return { sort, setSort, filters, setFilters };
}
