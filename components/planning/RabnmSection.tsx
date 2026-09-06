"use client";

import { useState } from "react";
import { addRabnmItem, deleteRabnmItem } from "@/app/meetings/[id]/planning/actions";
import { RABNM_TYPES } from "@/lib/data/sacrament-constants";
import type { RabnmRow } from "@/lib/data/sacrament-planning";
import type { PersonOption } from "@/lib/data/people";
import type { CallingOption } from "@/lib/data/callings";

// Only these types actually use a calling in their conducting-script
// wording (see rabnmPrompt in lib/data/conducting.ts) -- showing the
// Calling picker for e.g. a baptism or baby blessing was the confusing
// part of the old one-size-fits-all form, not the other fields.
const TYPES_WITH_CALLING = new Set(["release", "new_calling", "presidency_change"]);

function typeLabel(value: string) {
  return RABNM_TYPES.find((t) => t.value === value)?.label ?? value;
}

export function RabnmSection({
  meetingId,
  items,
  people,
  callings,
  canEdit,
}: {
  meetingId: string;
  items: RabnmRow[];
  people: PersonOption[];
  callings: CallingOption[];
  canEdit: boolean;
}) {
  const [type, setType] = useState("");
  const showCalling = TYPES_WITH_CALLING.has(type);

  const add = async (formData: FormData) => {
    await addRabnmItem(meetingId, formData);
    setType("");
  };

  return (
    <div className="rounded-lg border border-rule bg-card p-6">
      <h2 className="font-display text-xl">Recognitions / Advancements / Baptisms / New Members</h2>

      {items.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {items.map((item) => {
            const remove = async () => {
              await deleteRabnmItem(item.id, meetingId);
            };
            return (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-rule/60 px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-mono text-[11px] uppercase tracking-widest text-slate/70">
                    {typeLabel(item.type)}
                  </span>{" "}
                  {item.people.length > 0 && <span>{item.people.join(", ")}</span>}
                  {item.calling_name && <span> &mdash; {item.calling_name}</span>}
                  {item.detail && <span className="text-slate"> ({item.detail})</span>}
                </span>
                {canEdit && (
                  <form action={remove}>
                    <button type="submit" className="text-xs text-slate hover:text-ink">
                      Remove
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canEdit ? (
        <form action={add} className="mt-4 flex flex-col gap-2 border-t border-rule/60 pt-4">
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
                defaultValue=""
                className="rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
              >
                <option value="">&mdash; Calling &mdash;</option>
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
            placeholder="Detail (mission name, family name, ordination office, etc.)"
            className="rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
          />
          <input
            type="date"
            name="event_date"
            className="rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
          />

          <button
            type="submit"
            className="mt-1 w-fit rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink/90"
          >
            Add
          </button>
        </form>
      ) : (
        items.length === 0 && <p className="mt-4 text-sm text-slate">Nothing recorded yet.</p>
      )}
    </div>
  );
}
