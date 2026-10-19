import { saveBishopricMinutes } from "@/app/meetings/[id]/bishopric-actions";
import type { BishopricMinutes } from "@/lib/data/bishopric-meeting";

/**
 * Trimmed to just General Minutes + Next Meeting Date, 2026-10-19 (the
 * user's own confirmation, "Yes, consolidate now") -- this form used to
 * also carry Spiritual Thought/Handbook Training/Calendar Review/
 * Callings Discussion/Sacrament Planning Discussion/Young Men
 * Coordination/Impressions as fixed columns here, duplicating the same
 * content the dynamic per-element agenda rows in the Discussion section
 * already capture (Spiritual Thought and Handbook Training are real
 * rotation-assigned roles; the rest are free_text catalog elements).
 * Those seven `bishopric_minutes` columns are left in the schema,
 * untouched and unused -- the same "harmless but real" treatment this
 * app already gives `callings.title_prefix`, rather than a same-day
 * column drop (see migration 058's own deploy-ordering caution).
 */
export function BishopricMinutesForm({
  meetingId,
  minutes,
}: {
  meetingId: string;
  minutes: BishopricMinutes | null;
}) {
  const save = async (formData: FormData) => {
    "use server";
    await saveBishopricMinutes(meetingId, formData);
  };

  return (
    <form action={save} className="rounded border border-rule bg-surface p-6">
      <h2 className="font-display text-xl">Minutes</h2>

      <label className="mt-4 block text-sm text-ink-muted">
        General Minutes
        <textarea
          name="minutes_body"
          defaultValue={minutes?.minutes_body ?? ""}
          rows={5}
          className="mt-1 block w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
        />
      </label>

      <label className="mt-4 block text-sm text-ink-muted">
        Next Meeting Date
        <input
          type="date"
          name="next_meeting_date"
          defaultValue={minutes?.next_meeting_date ?? ""}
          className="mt-1 block w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
        />
      </label>

      <button
        type="submit"
        className="mt-4 rounded bg-accent px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent-deep"
      >
        Save
      </button>
    </form>
  );
}
