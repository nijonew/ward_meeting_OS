import { saveAssignments } from "@/app/meetings/[id]/planning/actions";
import { ASSIGNMENT_ROLES } from "@/lib/data/sacrament-constants";
import type { AssignmentRow } from "@/lib/data/sacrament-planning";
import type { PersonOption } from "@/lib/data/people";

export function AssignmentsForm({
  meetingId,
  assignments,
  people,
}: {
  meetingId: string;
  assignments: AssignmentRow[];
  people: PersonOption[];
}) {
  const save = async (formData: FormData) => {
    "use server";
    await saveAssignments(meetingId, formData);
  };
  const byRole = new Map(assignments.map((a) => [a.role, a]));

  return (
    <form action={save} className="rounded-lg border border-rule bg-card p-6">
      <h2 className="font-display text-xl">Assignments</h2>

      <div className="mt-4 flex flex-col gap-3">
        {ASSIGNMENT_ROLES.map((role) => {
          const existing = byRole.get(role.value);
          return (
            <div key={role.value} className="flex flex-wrap items-center gap-3">
              <span className="w-36 shrink-0 text-sm text-slate">{role.label}</span>
              <select
                name={`assigned_${role.value}`}
                defaultValue={existing?.assigned_to_id ?? ""}
                className="min-w-[12rem] flex-1 rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
              >
                <option value="">&mdash; Not assigned &mdash;</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-xs text-slate">
                <input
                  type="checkbox"
                  name={`confirmed_${role.value}`}
                  defaultChecked={existing?.confirmed ?? false}
                />
                Confirmed
              </label>
            </div>
          );
        })}
      </div>

      <button
        type="submit"
        className="mt-4 rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink/90"
      >
        Save
      </button>
    </form>
  );
}