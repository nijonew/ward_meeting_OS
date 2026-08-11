import {
  updateCallingPlanning,
  addSuggestion,
  removeSuggestion,
  pushToSacramentMeeting,
} from "@/app/callings/[id]/actions";
import type { CallingPlanningRow } from "@/lib/data/calling-planning";
import type { PersonOption } from "@/lib/data/people";
import type { Meeting } from "@/lib/types";

const CALLING_STATUSES = [
  { value: "discussing", label: "Discussing" },
  { value: "future", label: "Future" },
  { value: "declined", label: "Declined" },
  { value: "to_announce", label: "To Announce in Sacrament" },
  { value: "to_be_set_apart", label: "To Be Set Apart" },
  { value: "to_record", label: "To Record" },
  { value: "complete", label: "Complete" },
];

const RELEASE_STATUSES = [
  { value: "previously_vacant", label: "Previously Vacant" },
  { value: "discussing", label: "Discussing" },
  { value: "to_announce", label: "To Announce in Sacrament" },
  { value: "to_record", label: "To Record" },
  { value: "complete", label: "Complete" },
];

function formatMeetingDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function CallingPlanningCard({
  callingId,
  planning,
  people,
  upcomingSacramentMeetings,
}: {
  callingId: string;
  planning: CallingPlanningRow;
  people: PersonOption[];
  upcomingSacramentMeetings: Meeting[];
}) {
  const save = async (formData: FormData) => {
    "use server";
    await updateCallingPlanning(planning.id, callingId, formData);
  };
  const addSuggestionAction = async (formData: FormData) => {
    "use server";
    await addSuggestion(planning.id, callingId, formData);
  };
  const push = async (formData: FormData) => {
    "use server";
    await pushToSacramentMeeting(planning.id, callingId, formData);
  };

  const readyToPush =
    (planning.calling_status === "to_announce" && planning.selected_person_id) ||
    (planning.release_status === "to_announce" && planning.release_person_id);

  return (
    <div className="rounded-lg border border-rule bg-card p-6">
      <p className="font-mono text-[11px] uppercase tracking-widest text-slate/70">
        Started {new Date(planning.created_at).toLocaleDateString("en-US")}
      </p>

      <form action={save} className="mt-3 flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm text-slate">
            Calling Status
            <select
              name="calling_status"
              defaultValue={planning.calling_status}
              className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
            >
              {CALLING_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate">
            Selected Person
            <select
              name="selected_person_id"
              defaultValue={planning.selected_person_id ?? ""}
              className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
            >
              <option value="">&mdash; Not yet decided &mdash;</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm text-slate">
            Date Set Apart
            <input
              type="date"
              name="date_set_apart"
              defaultValue={planning.date_set_apart ?? ""}
              className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm text-slate">
            Person Being Released
            <select
              name="release_person_id"
              defaultValue={planning.release_person_id ?? ""}
              className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
            >
              <option value="">&mdash; None &mdash;</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate">
            Release Status
            <select
              name="release_status"
              defaultValue={planning.release_status}
              className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
            >
              {RELEASE_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="text-sm text-slate">
          Notes
          <textarea
            name="notes"
            defaultValue={planning.notes ?? ""}
            rows={2}
            className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
          />
        </label>

        <button
          type="submit"
          className="w-fit rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink/90"
        >
          Save
        </button>
      </form>

      <div className="mt-4 border-t border-rule/60 pt-4">
        <p className="font-mono text-[11px] uppercase tracking-widest text-slate/70">Suggestions</p>
        {planning.suggestions.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1">
            {planning.suggestions.map((s) => {
              const remove = async () => {
                "use server";
                await removeSuggestion(s.id, callingId);
              };
              return (
                <li key={s.id} className="flex items-center justify-between text-sm">
                  <span className="text-ink">
                    {s.person_name}
                    {s.note && <span className="text-slate"> &mdash; {s.note}</span>}
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

        <form action={addSuggestionAction} className="mt-2 flex flex-wrap gap-2">
          <select
            name="person_id"
            required
            defaultValue=""
            className="rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
          >
            <option value="" disabled>
              Choose person
            </option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            name="note"
            placeholder="Note (optional)"
            className="flex-1 rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
          />
          <button type="submit" className="rounded-md border border-rule px-3 py-2 text-sm text-ink hover:bg-ink/5">
            Add Suggestion
          </button>
        </form>
      </div>

      <div className="mt-4 border-t border-rule/60 pt-4">
        {planning.announced_meeting_id ? (
          <p className="text-sm text-sage">Already added to a Sacrament Meeting.</p>
        ) : readyToPush ? (
          <form action={push} className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-slate">
              Add to Sacrament Meeting:
              <select
                name="meeting_id"
                required
                defaultValue=""
                className="ml-2 rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
              >
                <option value="" disabled>
                  Choose meeting
                </option>
                {upcomingSacramentMeetings.map((m) => (
                  <option key={m.id} value={m.id}>
                    {formatMeetingDate(m.date)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="rounded-md bg-brass px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-brass/90"
            >
              Add
            </button>
          </form>
        ) : (
          <p className="text-xs text-slate/60">
            Mark Calling Status or Release Status &ldquo;To Announce in Sacrament&rdquo; to add
            this to a Sacrament Meeting.
          </p>
        )}
      </div>
    </div>
  );
}