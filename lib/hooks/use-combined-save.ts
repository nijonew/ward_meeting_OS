"use client";

import { useRef, useState } from "react";

type SaveState = { error?: string; success?: boolean };

/**
 * Shared "combine several independent Save buttons into one" mechanism
 * (2026-11-01, the user's own report: "the meetings have too many
 * instances of the save all changes button"). Generalizes
 * `CombinedAgendaGrids.tsx`'s own fixed two-grid design (built for
 * Sacrament Meeting's opening/closing split) to an arbitrary,
 * caller-supplied list of form ids -- Bishopric Meeting/Ward Council/
 * Youth Council's Planning page can render anywhere from one to
 * several `AgendaGridForm` instances (one per section) plus
 * `BishopricMinutesForm`/`CouncilNotesForm`, each previously its own
 * independent button.
 *
 * Each child form still submits through its own real
 * `<form id="...">` (its `hideActions` prop suppresses its own button/
 * feedback) -- this only tracks each one's dirty/pending/result state
 * via the same `onDirtyChange`/`onStateChange` callbacks `AgendaGridForm`
 * already supports, and drives every registered form's native
 * `requestSubmit()` from one combined button.
 *
 * `onDirtyChangeFor`/`onStateChangeFor` cache one stable function per
 * `formId` in a ref, rather than creating a fresh closure on every call
 * -- `AgendaGridForm`'s own effects depend on these callbacks
 * (`useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange])`),
 * so a new reference every render would re-fire them constantly; each
 * handler also bails out of its own `setState` call when the incoming
 * value hasn't actually changed, so even a re-fired effect can't loop.
 */
export function useCombinedSave(formIds: string[]) {
  const [dirtyMap, setDirtyMap] = useState<Record<string, boolean>>({});
  const [pendingMap, setPendingMap] = useState<Record<string, boolean>>({});
  const [stateMap, setStateMap] = useState<Record<string, SaveState>>({});

  const dirtyHandlers = useRef<Record<string, (dirty: boolean) => void>>({});
  const stateHandlers = useRef<Record<string, (state: SaveState, pending: boolean) => void>>({});

  function onDirtyChangeFor(formId: string) {
    if (!dirtyHandlers.current[formId]) {
      dirtyHandlers.current[formId] = (dirty: boolean) =>
        setDirtyMap((m) => (m[formId] === dirty ? m : { ...m, [formId]: dirty }));
    }
    return dirtyHandlers.current[formId];
  }

  function onStateChangeFor(formId: string) {
    if (!stateHandlers.current[formId]) {
      stateHandlers.current[formId] = (state: SaveState, isPending: boolean) => {
        setStateMap((m) => {
          const prev = m[formId];
          if (prev && prev.error === state.error && prev.success === state.success) return m;
          return { ...m, [formId]: state };
        });
        setPendingMap((m) => (m[formId] === isPending ? m : { ...m, [formId]: isPending }));
      };
    }
    return stateHandlers.current[formId];
  }

  function handleSaveAll() {
    for (const id of formIds) {
      (document.getElementById(id) as HTMLFormElement | null)?.requestSubmit();
    }
  }

  const dirty = formIds.some((id) => dirtyMap[id]);
  const pending = formIds.some((id) => pendingMap[id]);
  const error = formIds.map((id) => stateMap[id]?.error).find((e) => e);
  const allSaved = formIds.length > 0 && !error && formIds.every((id) => stateMap[id]?.success === true);

  return { dirty, pending, error, allSaved, onDirtyChangeFor, onStateChangeFor, handleSaveAll };
}
