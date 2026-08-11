import { saveAdultSpeakers, saveYouthSpeakers } from "@/app/meetings/[id]/planning/actions";
import { slotLabel } from "@/lib/data/sacrament-constants";
import type { SpeakerRow } from "@/lib/data/sacrament-planning";
import type { PersonOption } from "@/lib/data/people";

export function SpeakersForm({
  meetingId,
  title,
  variant,
  slots,
  speakers,
  people,
}: {
  meetingId: string;
  title: string;
  variant: "adults" | "youth";
  slots: readonly string[];
  speakers: SpeakerRow[];
  people: PersonOption[];
}) {
  const save = (variant === "adults" ? saveAdultSpeakers : saveYouthSpeakers).bind(null, meetingId);
  const bySlot = new Map(speakers.map((s) => [s.slot, s]));

  return (
    <form action={save} className="rounded-lg border border-rule bg-card p-6">
      <h2 className="font-display text-xl">{title}</h2>
      <p className="mt-1 text-xs text-slate">
        Leave a slot blank to skip it. Use Guest Name for speakers not in People (stake reps,
        visitors).
      </p>

      <div className="mt-4 flex flex-col gap-4">
        {slots.map((slot) => {
          const existing = bySlot.get(slot);
          return (
            <div key={slot} className="rounded-md border border-rule/60 p-3">
              <p className="font-mono text-[11px] uppercase tracking-widest text-slate/70">
                {slotLabel(slot)}
              </p>

              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <select
                  name={`${slot}_speaker_id`}
                  defaultValue={existing?.speaker_id ?? ""}
                  className="rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
                >
                  <option value="">&mdash; Choose speaker &mdash;</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  name={`${slot}_guest_name`}
                  defaultValue={existing?.guest_speaker_name ?? ""}
                  placeholder="Guest name (if not in People)"
                  className="rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
                />
                <input
                  type="text"
                  name={`${slot}_topic`}
                  defaultValue={existing?.topic ?? ""}
                  placeholder="Topic"
                  className="rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink sm:col-span-2"
                />
                <input
                  type="text"
                  name={`${slot}_duration`}
                  defaultValue={existing?.duration ?? ""}
                  placeholder="Duration (e.g. 7-10 minutes)"
                  className="rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
                />
                <label className="flex items-center gap-2 text-xs text-slate">
                  <input
                    type="checkbox"
                    name={`${slot}_confirmed`}
                    defaultChecked={existing?.confirmed ?? false}
                  />
                  Confirmed
                </label>
              </div>
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
