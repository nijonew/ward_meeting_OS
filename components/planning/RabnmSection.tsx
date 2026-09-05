import { addRabnmItem, deleteRabnmItem } from "@/app/meetings/[id]/planning/actions";
import { RABNM_TYPES } from "@/lib/data/sacrament-constants";
import type { RabnmRow } from "@/lib/data/sacrament-planning";
import type { PersonOption } from "@/lib/data/people";
import type { CallingOption } from "@/lib/data/callings";
import { RabnmAddForm } from "./RabnmAddForm";

function typeLabel(value: string) {
  return RABNM_TYPES.find((t) => t.value === value)?.label ?? value;
}

export function RabnmSection({
  meetingId,
  items,
  people,
  callings,
}: {
  meetingId: string;
  items: RabnmRow[];
  people: PersonOption[];
  callings: CallingOption[];
}) {
  const add = async (formData: FormData) => {
    "use server";
    await addRabnmItem(meetingId, formData);
  };

  return (
    <div className="rounded-lg border border-rule bg-card p-6">
      <h2 className="font-display text-xl">Recognitions / Advancements / Baptisms / New Members</h2>

      {items.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {items.map((item) => {
            const remove = async () => {
              "use server";
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
                <form action={remove}>
                  <button type="submit" className="text-xs text-slate hover:text-ink">
                    Remove
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}

      {/* Keyed on the item count so the form (and its type-driven field
          visibility) resets cleanly after a successful add. */}
      <RabnmAddForm key={items.length} onAdd={add} people={people} callings={callings} />
    </div>
  );
}
