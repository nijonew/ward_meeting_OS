import { savePlanningInfo } from "@/app/meetings/[id]/planning/actions";
import { SPECIAL_FORMATS } from "@/lib/data/sacrament-constants";
import type { PlanningInfo } from "@/lib/data/sacrament-planning";

export function PlanningInfoForm({
  meetingId,
  planning,
}: {
  meetingId: string;
  planning: PlanningInfo | null;
}) {
  const save = savePlanningInfo.bind(null, meetingId);

  return (
    <form action={save} className="rounded-lg border border-rule bg-card p-6">
      <h2 className="font-display text-xl">Meeting Info</h2>

      <label className="mt-4 block text-sm text-slate">
        Special Format
        <select
          name="special_format"
          defaultValue={planning?.special_format ?? "standard"}
          className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
        >
          {SPECIAL_FORMATS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-4 block text-sm text-slate">
        Ward Business
        <textarea
          name="ward_business"
          defaultValue={planning?.ward_business ?? ""}
          rows={3}
          className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
        />
      </label>

      <label className="mt-4 block text-sm text-slate">
        Stake Business
        <textarea
          name="stake_business"
          defaultValue={planning?.stake_business ?? ""}
          rows={3}
          className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
        />
      </label>

      <label className="mt-4 block text-sm text-slate">
        Recognitions
        <textarea
          name="recognitions"
          defaultValue={planning?.recognitions ?? ""}
          rows={2}
          className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
        />
      </label>

      <label className="mt-4 block text-sm text-slate">
        Hidden Notes <span className="text-slate/60">(Planning View only, never public)</span>
        <textarea
          name="hidden_notes"
          defaultValue={planning?.hidden_notes ?? ""}
          rows={3}
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
