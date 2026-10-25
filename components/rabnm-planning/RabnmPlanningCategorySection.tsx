"use client";

import { useState, useTransition } from "react";
import { addRabnmPlanningItem, removeRabnmPlanningItem } from "@/app/rabnm-planning/actions";
import { MultiPersonSelect } from "@/components/calling-planning/MultiPersonSelect";
import type { PersonOption } from "@/lib/data/people";
import type { RabnmPlanningRow, RabnmPlanningType } from "@/lib/data/sacrament-rabnm-planning";

const INPUT = "rounded border border-rule bg-paper px-2 py-1.5 text-sm text-ink";

/** One already-pooled row -- a plain Remove button, no editing in
 *  place (matches Teaching Program's own "add or remove lines" scope,
 *  the user's own explicit choice for this page). */
function ExistingRow({ item }: { item: RabnmPlanningRow }) {
  const [removing, startRemove] = useTransition();

  return (
    <tr className="border-t border-rule/40">
      <td className="py-1.5 pr-3">{item.people.length > 0 ? item.people.map((p) => p.name).join(", ") : "—"}</td>
      <td className="py-1.5 pr-3 text-ink-muted">{item.detail ?? "—"}</td>
      <td className="py-1.5 pr-3 text-ink-muted">{item.event_date ?? "—"}</td>
      <td className="py-1.5 text-right">
        <button
          type="button"
          disabled={removing}
          onClick={() => startRemove(async () => { await removeRabnmPlanningItem(item.id); })}
          className="text-xs text-danger/70 hover:text-danger"
        >
          {removing ? "Removing..." : "Remove"}
        </button>
      </td>
    </tr>
  );
}

/**
 * One category block on /rabnm-planning (Recognitions, Advancements,
 * Baptisms, New Members, or Baby Blessings) -- a compact table of
 * what's already in this category's pool, plus a small add-row form
 * underneath. `type` is fixed per section (a hidden field), not a
 * dropdown on the form itself.
 *
 * A real <form onSubmit> (not a direct server-action `action` prop) --
 * reading the submitted element's own FormData picks up
 * MultiPersonSelect's hidden `person_ids` inputs automatically, same as
 * it already does inside Calling Planning's bigger grid form.
 * `resetKey` forces the whole form (MultiPersonSelect included) to
 * remount after a successful add, clearing its internal chip selection
 * back to empty -- plain `form.reset()` alone only resets native
 * uncontrolled inputs (detail/date), not MultiPersonSelect's own
 * React state.
 */
export function RabnmPlanningCategorySection({
  type,
  label,
  items,
  people,
}: {
  type: RabnmPlanningType;
  label: string;
  items: RabnmPlanningRow[];
  people: PersonOption[];
}) {
  const [pending, startAdd] = useTransition();
  const [resetKey, setResetKey] = useState(0);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startAdd(async () => {
      await addRabnmPlanningItem(formData);
      setResetKey((k) => k + 1);
    });
  };

  return (
    <div className="rounded border border-rule bg-surface p-5">
      <h2 className="font-display text-lg">{label}</h2>

      {items.length > 0 ? (
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left font-mono text-[11px] uppercase tracking-wider text-ink-muted/70">
              <th className="pb-1.5 pr-3">Person(s)</th>
              <th className="pb-1.5 pr-3">Detail</th>
              <th className="pb-1.5 pr-3">Event Date</th>
              <th className="pb-1.5" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <ExistingRow key={item.id} item={item} />
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-3 text-sm text-ink-muted">None yet.</p>
      )}

      <form key={resetKey} onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-3 border-t border-rule/40 pt-4">
        <input type="hidden" name="type" value={type} />
        <div className="flex flex-col gap-1">
          <label className="font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">Person(s)</label>
          <MultiPersonSelect name="person_ids" people={people} value={[]} onDirty={() => undefined} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">Detail</label>
          <input name="detail" type="text" className={INPUT} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">Event Date</label>
          <input name="event_date" type="date" className={INPUT} />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded border border-rule px-3 py-1.5 text-xs text-ink hover:bg-ink/5 disabled:opacity-50"
        >
          {pending ? "Adding..." : "+ Add"}
        </button>
      </form>
    </div>
  );
}
