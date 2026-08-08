import { saveCouncilNotes, type CouncilNotes } from "@/lib/data/council-notes";

export function CouncilNotesForm({ meetingId, notes }: { meetingId: string; notes: CouncilNotes | null }) {
  const save = saveCouncilNotes.bind(null, meetingId);

  return (
    <form action={save} className="rounded-lg border border-rule bg-card p-6">
      <h2 className="font-display text-xl">Notes</h2>

      <label className="mt-4 block text-sm text-slate">
        Meeting Notes
        <textarea
          name="notes"
          defaultValue={notes?.notes ?? ""}
          rows={6}
          className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
        />
      </label>

      <label className="mt-4 block text-sm text-slate">
        Next Meeting Date
        <input
          type="date"
          name="next_meeting_date"
          defaultValue={notes?.next_meeting_date ?? ""}
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