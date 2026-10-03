"use client";

import { useState } from "react";
import type { PersonOption } from "@/lib/data/people";

/**
 * A spreadsheet-style "data validation" multi-select: shows only the
 * people actually selected, as removable chips, plus a plain
 * single-choice dropdown to add one more -- no Ctrl/Cmd-click required.
 * Replaces a native <select multiple> (2026-09-08, the user's own
 * feedback: "is there a way to do multi-add without having to do a
 * cntrl click... only showing what is selected, not the selection
 * list").
 *
 * Renders its own hidden <input>s under `name` so the surrounding
 * <form> collects every selected id exactly like a native multi-select
 * would (formData.getAll(name) on submit) -- always includes one
 * blank-value hidden input too, so "remove every candidate" still
 * submits the field as an explicit empty list rather than omitting it
 * entirely (see saveCallingPlanningGrid's own comment on why that
 * matters).
 *
 * Uncontrolled-by-parent, like every other field in this grid: `value`
 * only seeds the initial selection (its own useState), so an in-progress
 * edit here isn't reset when a sibling field's edit re-renders the row.
 * `onDirty` is called directly on every add/remove instead of relying
 * on the form's own onChange bubbling, since adding/removing a hidden
 * input via React state doesn't fire a native change event the form
 * would otherwise catch.
 */
export function MultiPersonSelect({
  name,
  people,
  value,
  onDirty,
}: {
  name: string;
  people: PersonOption[];
  value: string[];
  onDirty: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(value);

  const selectedSet = new Set(selected);
  const available = people.filter((p) => !selectedSet.has(p.id));
  const selectedPeople = selected
    .map((id) => people.find((p) => p.id === id))
    .filter((p): p is PersonOption => Boolean(p));

  const addPerson = (id: string) => {
    if (!id || selectedSet.has(id)) return;
    setSelected((prev) => [...prev, id]);
    onDirty();
  };

  const removePerson = (id: string) => {
    setSelected((prev) => prev.filter((pid) => pid !== id));
    onDirty();
  };

  return (
    <div className="flex min-w-[10rem] flex-col gap-1.5">
      <input type="hidden" name={name} value="" />
      {selected.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}

      {selectedPeople.length > 0 && (
        <ul className="flex flex-wrap gap-1">
          {selectedPeople.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-1 rounded border border-rule bg-surface px-2 py-0.5 text-[11px] text-ink"
            >
              {p.name}
              <button
                type="button"
                onClick={() => removePerson(p.id)}
                aria-label={`Remove ${p.name}`}
                className="text-ink-muted hover:text-ink"
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 && (
        <select
          value=""
          onChange={(e) => addPerson(e.target.value)}
          className="rounded border border-rule bg-paper px-2 py-1 text-xs text-ink"
        >
          <option value="">+ Add candidate&hellip;</option>
          {available.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
