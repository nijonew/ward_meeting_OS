"use client";

import { useActionState } from "react";

type GenerateState = { error?: string; created?: number; skippedExisting?: number };
const initialState: GenerateState = {};

/**
 * Shared "Generate from active cadence rules through a date" form --
 * used by Meeting Schedule, Youth Activity Schedule, and Ward Event
 * Schedule alike. Only the action and labels differ per feature.
 */
export function GenerateForm({
  action,
  heading,
  itemLabelSingular,
  itemLabelPlural,
}: {
  action: (prevState: GenerateState, formData: FormData) => Promise<GenerateState>;
  heading: string;
  itemLabelSingular: string;
  itemLabelPlural: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <div className="rounded-lg border border-rule bg-card p-6">
      <h2 className="font-display text-xl">{heading}</h2>
      <p className="mt-1 text-sm text-slate">
        Creates real {itemLabelPlural} from the active cadence rules above, for any dates that
        don&rsquo;t already have one. Safe to run again later &mdash; existing ones are never
        duplicated.
      </p>

      <form action={formAction} className="mt-4 flex flex-wrap items-center gap-3">
        <label className="text-xs text-slate">
          Through
          <input
            type="date"
            name="through_date"
            required
            className="ml-2 rounded-md border border-rule bg-paper px-2 py-1.5 text-xs text-ink"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-ink px-4 py-2 text-xs font-medium text-paper transition-colors hover:bg-ink/90 disabled:opacity-50"
        >
          {pending ? "Generating..." : "Generate"}
        </button>
      </form>

      {state.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}
      {state.created !== undefined && (
        <p className="mt-3 text-sm text-ink">
          Created {state.created} {state.created === 1 ? itemLabelSingular : itemLabelPlural}
          {state.skippedExisting ? ` (${state.skippedExisting} already existed and were skipped)` : ""}.
        </p>
      )}
    </div>
  );
}
