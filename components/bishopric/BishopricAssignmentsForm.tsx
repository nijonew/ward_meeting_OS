import { saveBishopricAssignments } from "@/app/meetings/[id]/bishopric-actions";
import type { BishopricAssignmentRow } from "@/lib/data/bishopric-meeting";
import type { PersonOption } from "@/lib/data/people";

const ROLES = [
  { value: "opening_prayer", label: "Opening Prayer" },
  { value: "closing_prayer", label: "Closing Prayer" },
];

export function BishopricAssignmentsForm({
  meetingId,
  assignments,
  people,
}: {
  meetingId: string;
  assignments: BishopricAssignmentRow[];
  people: PersonOption[];
}) {
  const save = async (formData: FormData) => {
    "use server";
    await saveBishopricAssignments(meetingId, formData);
  };
  const byRole = new Map(assignments.map((a) => [a.role, a]));

  return (
    <form action={save} className="rounded-lg border border-rule bg-card p-6">
      <h2 className="font-display text-xl">Assignments</h2>

      <div className="mt-4 flex flex-col gap-3">
        {ROLES.map((role) => (
          <div key={role.value} className="flex flex-wrap items-center gap-3">
            <span className="w-36 shrink-0 text-sm text-slate">{role.label}</span>
            <select
              name={`assigned_${role.value}`}
              defaultValue={byRole.get(role.value)?.assigned_to_id ?? ""}
              className="min-w-[12rem] flex-1 rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
            >
              <option value="">&mdash; Not assigned &mdash;</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        ))}
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