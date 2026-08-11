import { addSingleMusicItem } from "@/app/music/actions";
import { MUSIC_TYPES } from "@/lib/data/sacrament-constants";
import type { PersonOption } from "@/lib/data/people";

export function QuickAddMusic({ people }: { people: PersonOption[] }) {
  const add = async (formData: FormData) => {
    "use server";
    await addSingleMusicItem(formData);
  };

  return (
    <details className="rounded-lg border border-rule bg-card p-6">
      <summary className="cursor-pointer font-display text-xl">Add One Item</summary>

      <form action={add} className="mt-4 flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm text-slate">
            Date
            <input
              type="date"
              name="date"
              required
              className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
            />
          </label>
          <label className="text-sm text-slate">
            Type
            <select
              name="type"
              required
              defaultValue=""
              className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
            >
              <option value="" disabled>
                Choose type
              </option>
              {MUSIC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input
            type="number"
            name="hymn_number"
            placeholder="Hymn number"
            className="rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
          />
          <input
            type="text"
            name="piece_name"
            placeholder="Piece name"
            className="rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm text-slate">
            Performer
            <select
              name="individual_id"
              defaultValue=""
              className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
            >
              <option value="">&mdash; Choose performer &mdash;</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <input
            type="text"
            name="group_name"
            placeholder="Group name (if not an individual)"
            className="rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink self-end"
          />
        </div>

        <label className="text-sm text-slate">
          Accompanist
          <select
            name="accompanist_id"
            defaultValue=""
            className="mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
          >
            <option value="">&mdash; Choose accompanist &mdash;</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          className="mt-1 w-fit rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink/90"
        >
          Add
        </button>
      </form>
    </details>
  );
}