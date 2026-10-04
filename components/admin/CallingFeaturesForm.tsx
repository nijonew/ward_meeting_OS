"use client";

import { useState, useActionState } from "react";
import { saveCallingFeatures } from "@/app/admin/calling-features/actions";
import type { FeatureCategory } from "@/lib/data/calling-features";

const initialState: { error?: string; success?: boolean } = {};

/**
 * The feature checklist for one calling -- a dropdown-and-checkboxes
 * replacement for hand-adding rows to Table Admin's raw
 * `calling_features` grid, which would mean thousands of rows across
 * every calling x ~58 features (the user's own concern, 2026-10-04).
 * Same dirty-tracking/"Save All Changes"/Saving-Saved feedback pattern
 * already established for Assignment Rotations, Teaching Calendar,
 * and Calling Planning (AssignmentGridForm.tsx et al.) -- one big
 * `<form>`, every checkbox submits together, `saveCallingFeatures`
 * diffs the checked set against what's actually granted and only
 * writes what changed.
 */
export function CallingFeaturesForm({
  callingId,
  callingName,
  categories,
  grantedKeys,
}: {
  callingId: string;
  callingName: string;
  categories: FeatureCategory[];
  grantedKeys: Set<string>;
}) {
  const [state, formAction, pending] = useActionState(saveCallingFeatures, initialState);
  const [dirty, setDirty] = useState(false);

  // Reset "dirty" the moment a save completes, during render rather
  // than an effect -- same convention as AssignmentGridForm.
  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (state.success && dirty) setDirty(false);
  }

  return (
    <form key={callingId} action={formAction} onChange={() => setDirty(true)} className="flex flex-col gap-6">
      <input type="hidden" name="calling_id" value={callingId} />

      {categories.map((cat) => (
        <div key={cat.category} className="rounded border border-rule bg-surface p-4">
          <h3 className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">{cat.category}</h3>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {cat.features.map((f) => (
              <label key={f.key} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  name="feature"
                  value={f.key}
                  defaultChecked={grantedKeys.has(f.key)}
                  className="h-4 w-4 rounded border-rule"
                />
                {f.label}
              </label>
            ))}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!dirty || pending}
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Saving..." : `Save Changes for ${callingName}`}
        </button>
        {state.error && <p className="text-sm text-danger">{state.error}</p>}
        {!pending && !dirty && state.success && !state.error && <p className="text-sm text-success">Saved.</p>}
      </div>
    </form>
  );
}
