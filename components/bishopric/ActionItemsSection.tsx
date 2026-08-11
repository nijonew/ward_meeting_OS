import { addActionItem, toggleActionItem } from "@/app/meetings/[id]/bishopric-actions";
import type { ActionItemRow } from "@/lib/data/bishopric-meeting";
import type { PersonOption } from "@/lib/data/people";

export function ActionItemsSection({
  meetingId,
  items,
  people,
}: {
  meetingId: string;
  items: ActionItemRow[];
  people: PersonOption[];
}) {
  const add = async (formData: FormData) => {
    "use server";
    await addActionItem(meetingId, formData);
  };

  return (
    <div className="rounded-lg border border-rule bg-card p-6">
      <h2 className="font-display text-xl">Action Items</h2>

      {items.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {items.map((item) => {
            const toggle = async () => {
              "use server";
              await toggleActionItem(item.id, meetingId, item.completed);
            };
            return (
              <li
                key={item.id}
                className="flex items-start gap-3 rounded-md border border-rule/60 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={item.completed}
                  readOnly
                  aria-hidden="true"
                  className="mt-1"
                />
                <span className={["flex-1", item.completed ? "text-slate/50 line-through" : "text-ink"].join(" ")}>
                  {item.description}
                  {item.assigned_to_name && (
                    <span className="text-slate"> &mdash; {item.assigned_to_name}</span>
                  )}
                  {item.due_date && <span className="text-slate"> (due {item.due_date})</span>}
                </span>
                <form action={toggle}>
                  <button type="submit" className="text-xs text-slate hover:text-ink">
                    {item.completed ? "Undo" : "Mark done"}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}

      <form action={add} className="mt-4 flex flex-col gap-2 border-t border-rule/60 pt-4 sm:flex-row sm:items-end">
        <input
          type="text"
          name="description"
          required
          placeholder="Description"
          className="flex-1 rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
        />
        <select
          name="assigned_to_id"
          defaultValue=""
          className="rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
        >
          <option value="">&mdash; Assign to &mdash;</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          name="due_date"
          className="rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
        />
        <button
          type="submit"
          className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink/90"
        >
          Add
        </button>
      </form>
    </div>
  );
}