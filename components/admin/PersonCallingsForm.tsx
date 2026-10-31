"use client";

import { useState, useActionState } from "react";
import { savePersonCallings } from "@/app/admin/person-callings/actions";
import type { CallingAssignmentOption } from "@/lib/data/person-callings";

const initialState: { error?: string; success?: boolean } = {};

/**
 * The calling checklist for one person -- a dropdown-and-checkboxes
 * front end for `callings.current_holder_id`, mirroring
 * CallingFeaturesForm.tsx's own dirty-tracking/"Save Changes"/
 * Saving-Saved pattern. A plain client-side filter box narrows a long
 * roster down by typed text -- a filtered-out calling stays mounted
 * (`hidden`, not removed) so its checkbox state is never dropped from
 * the next save just because a filter happens to hide it, same
 * convention every other filterable grid in this app already uses.
 */
export function PersonCallingsForm({
  personId,
  personName,
  callings,
  heldCallingIds,
}: {
  personId: string;
  personName: string;
  callings: CallingAssignmentOption[];
  heldCallingIds: Set<string>;
}) {
  const [state, formAction, pending] = useActionState(savePersonCallings, initialState);
  const [dirty, setDirty] = useState(false);
  const [query, setQuery] = useState("");

  // Reset "dirty" the moment a save completes, during render rather
  // than an effect -- same convention as CallingFeaturesForm.
  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (state.success && dirty) setDirty(false);
  }

  const normalizedQuery = query.trim().toLowerCase();

  return (
    <form key={personId} action={formAction} onChange={() => setDirty(true)} className="flex flex-col gap-4">
      <input type="hidden" name="person_id" value={personId} />

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter callings..."
        className="rounded border border-rule bg-paper px-2 py-1.5 text-sm text-ink"
      />

      <div className="rounded border border-rule bg-surface p-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {callings.map((c) => (
            <label
              key={c.id}
              hidden={normalizedQuery !== "" && !c.name.toLowerCase().includes(normalizedQuery)}
              className="flex flex-wrap items-center gap-2 text-sm text-ink"
            >
              <input type="checkbox" name="calling" value={c.id} defaultChecked={heldCallingIds.has(c.id)} className="h-4 w-4 rounded border-rule" />
              {c.name}
              {c.currentHolderName && <span className="text-xs text-ink-muted">(currently: {c.currentHolderName})</span>}
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!dirty || pending}
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Saving..." : `Save Changes for ${personName}`}
        </button>
        {state.error && <p className="text-sm text-danger">{state.error}</p>}
        {!pending && !dirty && state.success && !state.error && <p className="text-sm text-success">Saved.</p>}
      </div>
    </form>
  );
}
