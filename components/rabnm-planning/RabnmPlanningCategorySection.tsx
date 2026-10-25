"use client";

import { useState, useTransition } from "react";
import { addRabnmPlanningItem, removeRabnmPlanningItem } from "@/app/rabnm-planning/actions";
import { MultiPersonSelect } from "@/components/calling-planning/MultiPersonSelect";
import type { PersonOption } from "@/lib/data/people";
import type { RabnmPlanningRow, RabnmPlanningType } from "@/lib/data/sacrament-rabnm-planning";

const INPUT = "rounded border border-rule bg-paper px-2 py-1.5 text-sm text-ink";

/**
 * Per-category field customization (2026-10-25, the user's own request:
 * "I would still like to see the page broken up by category so that we
 * can customize the fields a bit") -- every category used to share the
 * identical generic Person(s)/Detail/Event Date form. `detail` and
 * `event_date` are still the same two underlying columns everywhere
 * (migration 082); only their on-screen label changes per category, to
 * actually guide what belongs in each. `personsMulti: false` (Advancement
 * only) renders a single plain <select> instead of MultiPersonSelect --
 * one advancement is normally one person -- but still submits through
 * the same `person_ids` field name/formData.getAll() the action already
 * reads, so no server-side change was needed for that distinction.
 */
interface CategoryFieldConfig {
  personsLabel: string;
  personsMulti: boolean;
  detailLabel: string;
  eventDateLabel: string;
  showBabyName?: boolean;
}

const CATEGORY_FIELDS: Record<RabnmPlanningType, CategoryFieldConfig> = {
  recognition: { personsLabel: "Person(s)", personsMulti: true, detailLabel: "What's being recognized", eventDateLabel: "Date" },
  advancement: { personsLabel: "Person", personsMulti: false, detailLabel: "New office", eventDateLabel: "Ordination date" },
  baptism: { personsLabel: "Person(s)", personsMulti: true, detailLabel: "Notes", eventDateLabel: "Baptism date" },
  new_member: { personsLabel: "Person(s)", personsMulti: true, detailLabel: "Moved from", eventDateLabel: "Date of record" },
  baby_blessing: { personsLabel: "Parents", personsMulti: true, detailLabel: "Performed by", eventDateLabel: "Birth date", showBabyName: true },
};

/** One already-pooled row -- a plain Remove button, no editing in
 *  place (matches Teaching Program's own "add or remove lines" scope,
 *  the user's own explicit choice for this page). Columns follow the
 *  same per-category field set as the add-row form below. */
function ExistingRow({ item, fields }: { item: RabnmPlanningRow; fields: CategoryFieldConfig }) {
  const [removing, startRemove] = useTransition();
  const peopleText = item.people.length > 0 ? item.people.map((p) => p.name).join(", ") : "—";

  return (
    <tr className="border-t border-rule/40">
      {fields.showBabyName && <td className="py-1.5 pr-3">{item.baby_name ?? "—"}</td>}
      <td className="py-1.5 pr-3">{peopleText}</td>
      <td className="py-1.5 pr-3 text-ink-muted">{item.detail ?? "—"}</td>
      <td className="py-1.5 pr-3 text-ink-muted">{item.event_date ?? "—"}</td>
      <td className="py-1.5 pr-3 text-ink-muted">{item.planned_meeting_date ?? "—"}</td>
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
  const fields = CATEGORY_FIELDS[type];

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
              {fields.showBabyName && <th className="pb-1.5 pr-3">Baby&rsquo;s Name</th>}
              <th className="pb-1.5 pr-3">{fields.personsLabel}</th>
              <th className="pb-1.5 pr-3">{fields.detailLabel}</th>
              <th className="pb-1.5 pr-3">{fields.eventDateLabel}</th>
              <th className="pb-1.5 pr-3">Planned For</th>
              <th className="pb-1.5" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <ExistingRow key={item.id} item={item} fields={fields} />
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-3 text-sm text-ink-muted">None yet.</p>
      )}

      <form key={resetKey} onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-3 border-t border-rule/40 pt-4">
        <input type="hidden" name="type" value={type} />

        {fields.showBabyName && (
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">Baby&rsquo;s Name</label>
            <input name="baby_name" type="text" className={INPUT} />
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">{fields.personsLabel}</label>
          {fields.personsMulti ? (
            <MultiPersonSelect name="person_ids" people={people} value={[]} onDirty={() => undefined} />
          ) : (
            <select name="person_ids" className={INPUT} defaultValue="">
              <option value="">Choose...</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">{fields.detailLabel}</label>
          <input name="detail" type="text" className={INPUT} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">{fields.eventDateLabel}</label>
          <input name="event_date" type="date" className={INPUT} />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">Planned For</label>
          <input name="planned_meeting_date" type="date" className={INPUT} />
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
