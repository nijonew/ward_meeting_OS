"use client";

import { useRef, useState, useTransition } from "react";
import { addRabnmItem } from "@/app/meetings/[id]/planning/actions";
import type { PersonOption } from "@/lib/data/people";
import type { CallingOption } from "@/lib/data/callings";

/** For everything else, a dated event is the norm -- label it for what
 *  it actually is instead of a generic "Event Date". */
const EVENT_DATE_LABELS: Record<string, string> = {
  baptism: "Baptism Date",
  mission_call: "Departure Date",
  aaronic_priesthood: "Ordination Date",
  baby_born: "Birth Date",
  baby_blessing: "Blessing Date",
  new_record: "Date of Record",
};

const DETAIL_PLACEHOLDERS: Record<string, string> = {
  mission_call: "Where they're serving",
  aaronic_priesthood: "Office (Deacon, Teacher, Priest)",
  baby_born: "Parents' names",
  baby_blessing: "Who's giving the blessing",
  new_record: "Moved from",
};

const INPUT = "rounded border border-rule bg-paper px-3 py-2 text-sm text-ink";

/**
 * Add one RABNM item -- extracted 2026-10-03 from the old
 * `RabnmAddForm.tsx` (a real `<form>`, which is why Ward Business had
 * to live on its own page before: a `<form>` can't nest inside the
 * agenda grid's single big one). Same fields, but driven by refs and a
 * plain button instead of native form-submit semantics, so this embeds
 * directly in the grid without that restriction.
 *
 * `types` is the allowed type list for whichever group renders this --
 * Callings only ever offers "Presidency Change" here (New Calling only
 * comes from Calling Planning now, see WardBusinessField.tsx); Other
 * offers the remaining five free-form types. `showCalling` controls
 * whether the Calling picker renders at all (only Presidency Change
 * plausibly needs one among the types this form ever sees).
 */
export function RabnmQuickAddForm({
  meetingId,
  types,
  showCalling,
  people,
  callings,
}: {
  meetingId: string;
  types: { value: string; label: string }[];
  showCalling: boolean;
  people: PersonOption[];
  callings: CallingOption[];
}) {
  const [type, setType] = useState(types.length === 1 ? types[0].value : "");
  const [adding, startAdding] = useTransition();
  const callingRef = useRef<HTMLSelectElement>(null);
  const peopleRef = useRef<HTMLSelectElement>(null);
  const detailRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  const add = () => {
    if (!type) return;
    const formData = new FormData();
    formData.set("type", type);
    formData.set("calling_id", showCalling ? callingRef.current?.value ?? "" : "");
    formData.set("detail", detailRef.current?.value ?? "");
    formData.set("event_date", dateRef.current?.value ?? "");
    const selectedPeople = peopleRef.current ? Array.from(peopleRef.current.selectedOptions).map((o) => o.value) : [];
    for (const id of selectedPeople) formData.append("person_ids", id);

    startAdding(async () => {
      await addRabnmItem(meetingId, formData);
      if (types.length > 1) setType("");
      if (callingRef.current) callingRef.current.selectedIndex = 0;
      if (peopleRef.current) peopleRef.current.selectedIndex = -1;
      if (detailRef.current) detailRef.current.value = "";
      if (dateRef.current) dateRef.current.value = "";
    });
  };

  return (
    <div className="mt-2 flex flex-col gap-2 border-t border-rule/60 pt-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {types.length > 1 && (
          <select value={type} onChange={(e) => setType(e.target.value)} className={INPUT}>
            <option value="" disabled>
              Choose type
            </option>
            {types.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        )}

        {showCalling && (
          <select ref={callingRef} defaultValue="" className={INPUT}>
            <option value="" disabled>
              Choose the calling
            </option>
            {callings.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <select ref={peopleRef} multiple size={4} className={INPUT}>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <p className="text-xs text-ink-muted/60">Ctrl/Cmd-click to select more than one person.</p>

      <input
        ref={detailRef}
        type="text"
        placeholder={type && DETAIL_PLACEHOLDERS[type] ? DETAIL_PLACEHOLDERS[type] : "Detail"}
        className={INPUT}
      />

      {type && !showCalling && (
        <label className="text-xs text-ink-muted">
          {EVENT_DATE_LABELS[type] ?? "Date"}
          <input ref={dateRef} type="date" className={`mt-1 block ${INPUT}`} />
        </label>
      )}

      <button
        type="button"
        onClick={add}
        disabled={!type || adding}
        className="mt-1 w-fit rounded bg-accent px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent-deep disabled:opacity-50"
      >
        {adding ? "Adding..." : "Add"}
      </button>
    </div>
  );
}
