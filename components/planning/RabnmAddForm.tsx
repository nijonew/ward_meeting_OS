"use client";

import { useState } from "react";
import { RABNM_TYPES } from "@/lib/data/sacrament-constants";
import type { PersonOption } from "@/lib/data/people";
import type { CallingOption } from "@/lib/data/callings";

/** Only these types plausibly involve a specific calling -- hide the
 *  field entirely for the rest rather than showing an always-irrelevant
 *  dropdown. */
const CALLING_TYPES = new Set(["release", "new_calling", "presidency_change"]);

/** For everything else, a dated event is the norm -- label it for what
 *  it actually is instead of a generic "Event Date". Calling-related
 *  types skip the date field entirely: the announcement happens at the
 *  meeting being planned, there's no separate date to record. */
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

export function RabnmAddForm({
  onAdd,
  people,
  callings,
}: {
  onAdd: (formData: FormData) => Promise<void>;
  people: PersonOption[];
  callings: CallingOption[];
}) {
  const [type, setType] = useState("");
  const showCalling = CALLING_TYPES.has(type);
  const showEventDate = type !== "" && !CALLING_TYPES.has(type);

  return (
    <form action={onAdd} className="mt-4 flex flex-col gap-2 border-t border-rule/60 pt-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <select
          name="type"
          required
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
        >
          <option value="" disabled>
            Choose type
          </option>
          {RABNM_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        {showCalling && (
          <select
            name="calling_id"
            required
            defaultValue=""
            className="rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
          >
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

      <select
        name="person_ids"
        multiple
        size={4}
        className="rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
      >
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <p className="text-xs text-slate/60">Ctrl/Cmd-click to select more than one person.</p>

      <input
        type="text"
        name="detail"
        placeholder={type && DETAIL_PLACEHOLDERS[type] ? DETAIL_PLACEHOLDERS[type] : "Detail"}
        className="rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
      />

      {showEventDate && (
        <label className="text-xs text-slate">
          {EVENT_DATE_LABELS[type] ?? "Date"}
          <input
            type="date"
            name="event_date"
            className="mt-1 block rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
          />
        </label>
      )}

      <button
        type="submit"
        className="mt-1 w-fit rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink/90"
      >
        Add
      </button>
    </form>
  );
}
