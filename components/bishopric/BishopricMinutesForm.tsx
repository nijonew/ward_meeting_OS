import { saveBishopricMinutes } from "@/app/meetings/[id]/bishopric-actions";
import type { BishopricMinutes } from "@/lib/data/bishopric-meeting";
import type { PersonOption } from "@/lib/data/people";

export function BishopricMinutesForm({
  meetingId,
  minutes,
  people,
}: {
  meetingId: string;
  minutes: BishopricMinutes | null;
  people: PersonOption[];
}) {
  const save = saveBishopricMinutes.bind(null, meetingId);

  const textarea = (name: string, label: string, defaultValue: string | null, rows = 2) => (
    <label className="mt-4 block text-sm text-slate">
      {label}
      <textarea
        name={name}
        defaultValue={defaultValue ?? ""}
        rows={rows}
        className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
      />
    </label>
  );

  return (
    <form action={save} className="rounded-lg border border-rule bg-card p-6">
      <h2 className="font-display text-xl">Minutes</h2>

      <label className="mt-4 block text-sm text-slate">
        Spiritual Thought Presenter
        <select
          name="spiritual_thought_presenter_id"
          defaultValue={minutes?.spiritual_thought_presenter_id ?? ""}
          className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
        >
          <option value="">&mdash; Not assigned &mdash;</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {textarea("spiritual_thought_notes", "Spiritual Thought Notes", minutes?.spiritual_thought_notes ?? null)}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm text-slate">
          Handbook Training Topic
          <input
            type="text"
            name="handbook_training_topic"
            defaultValue={minutes?.handbook_training_topic ?? ""}
            className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
          />
        </label>
        <label className="text-sm text-slate">
          Handbook Training Presenter
          <select
            name="handbook_training_presenter_id"
            defaultValue={minutes?.handbook_training_presenter_id ?? ""}
            className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
          >
            <option value="">&mdash; Not assigned &mdash;</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {textarea("calendar_review_notes", "Calendar Review", minutes?.calendar_review_notes ?? null)}
      {textarea("callings_discussion_notes", "Callings Discussion", minutes?.callings_discussion_notes ?? null)}
      {textarea(
        "sacrament_planning_discussion_notes",
        "Sacrament Planning Discussion",
        minutes?.sacrament_planning_discussion_notes ?? null
      )}
      {textarea(
        "young_men_coordination_notes",
        "Young Men Coordination",
        minutes?.young_men_coordination_notes ?? null
      )}
      {textarea("impressions", "Impressions", minutes?.impressions ?? null)}
      {textarea("minutes_body", "Minutes", minutes?.minutes_body ?? null, 5)}

      <label className="mt-4 block text-sm text-slate">
        Next Meeting Date
        <input
          type="date"
          name="next_meeting_date"
          defaultValue={minutes?.next_meeting_date ?? ""}
          className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
        />
      </label>

      <button
        type="submit"
        className="mt-4 rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink/90"
      >
        Save
      </button>
    </form>
  );
}
