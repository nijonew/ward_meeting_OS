"use client";

import { useRef, useState, useTransition, useActionState } from "react";
import { saveCallingFeatures, getCallingFeatureKeysForImport } from "@/app/admin/calling-features/actions";
import { formatCallingOptionLabel, type CallingOption } from "@/lib/data/calling-planning-shared";
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
 *
 * **Gained "Import features from another calling," 2026-11-21** (the
 * user's own request). `getCallingFeatureKeysForImport` is a read, not
 * a write -- clicking Import only pre-checks the checkboxes below to
 * match the source calling's current grants (via a plain ref map,
 * since every checkbox here is uncontrolled/`defaultChecked`-based,
 * same as the rest of this app's "favorite grid format" pages), marks
 * the form dirty, and leaves the actual write to the existing Save
 * Changes button -- so an import can be reviewed, and individual boxes
 * un-checked, before anything in `calling_features` actually changes.
 * A `window.confirm` guards it since it silently overwrites whatever
 * is currently checked on screen (including any not-yet-saved edits).
 */
export function CallingFeaturesForm({
  callingId,
  callingName,
  categories,
  grantedKeys,
  otherCallings,
}: {
  callingId: string;
  callingName: string;
  categories: FeatureCategory[];
  grantedKeys: Set<string>;
  /** Every other calling, for the "Import from" picker -- the current
   *  calling is already excluded by the page before this is passed down. */
  otherCallings: CallingOption[];
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

  // Every rendered checkbox registers itself here by feature key, so
  // Import can set `.checked` directly without turning this form's
  // fields controlled.
  const checkboxRefs = useRef(new Map<string, HTMLInputElement>());
  const [importFrom, setImportFrom] = useState("");
  const [importPending, startImportTransition] = useTransition();
  const [importMessage, setImportMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const runImport = () => {
    if (!importFrom) return;
    const sourceName = otherCallings.find((c) => c.id === importFrom)?.name ?? "that calling";
    if (
      !window.confirm(
        `Replace every checkbox below with ${sourceName}'s current features? This doesn't save until you click Save Changes.`,
      )
    ) {
      return;
    }
    startImportTransition(async () => {
      const result = await getCallingFeatureKeysForImport(importFrom);
      if (result.error) {
        setImportMessage({ text: result.error, isError: true });
        return;
      }
      const keys = new Set(result.keys ?? []);
      for (const [featureKey, input] of checkboxRefs.current) {
        input.checked = keys.has(featureKey);
      }
      setDirty(true);
      setImportMessage({ text: `Imported from ${sourceName}. Review below, then Save Changes.`, isError: false });
    });
  };

  return (
    <form key={callingId} action={formAction} onChange={() => setDirty(true)} className="flex flex-col gap-6">
      <input type="hidden" name="calling_id" value={callingId} />

      {otherCallings.length > 0 && (
        <div className="rounded border border-rule bg-surface p-4">
          <h3 className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">
            Import features from another calling
          </h3>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <select
              value={importFrom}
              onChange={(e) => setImportFrom(e.target.value)}
              className="min-w-[14rem] rounded border border-rule bg-paper px-2 py-1.5 text-sm text-ink"
            >
              <option value="" disabled>
                Choose a calling&hellip;
              </option>
              {otherCallings.map((c) => (
                <option key={c.id} value={c.id}>
                  {formatCallingOptionLabel(c)}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!importFrom || importPending}
              onClick={runImport}
              className="rounded border border-rule px-3 py-1.5 text-xs text-ink hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {importPending ? "Importing..." : "Import"}
            </button>
          </div>
          {importMessage && (
            <p className={`mt-2 text-xs ${importMessage.isError ? "text-danger" : "text-ink-muted"}`}>{importMessage.text}</p>
          )}
        </div>
      )}

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
                  ref={(el) => {
                    if (el) checkboxRefs.current.set(f.key, el);
                    else checkboxRefs.current.delete(f.key);
                  }}
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
