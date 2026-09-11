import { addSingleMusicItem } from "@/app/music/actions";
import { MUSIC_TYPES } from "@/lib/data/sacrament-constants";
import type { PersonOption } from "@/lib/data/people";

export function QuickAddMusic({ people }: { people: PersonOption[] }) {
  const add = async (formData: FormData) => {
    "use server";
    await addSingleMusicItem(formData);
  };

  return (
    <details className="rounded border border-rule bg-surface p-6">
      <summary className="cursor-pointer font-display text-xl">Add One Item</summary>

      <form action={add} className="mt-4 flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm text-ink-muted">
            Date
            <input
              type="date"
              name="date"
              required
              className="mt-1 block w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
            />
          </label>
          <label className="text-sm text-ink-muted">
            Type
            <select
              name="type"
              required
              defaultValue=""
              className="mt-1 block w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
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
            className="rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
          />
          <input
            type="text"
            name="piece_name"
            placeholder="Piece name"
            className="rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm text-ink-muted">
            Performer
            <select
              name="individual_id"
              defaultValue=""
              className="mt-1 block w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
            >
              <option value="">Choose performer</option>
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
            className="rounded border border-rule bg-paper px-3 py-2 text-sm text-ink self-end"
          />
        </div>

        <label className="text-sm text-ink-muted">
          Accompanist
          <select
            name="accompanist_id"
            defaultValue=""
            className="mt-1 block w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
          >
            <option value="">Choose accompanist</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          className="mt-1 w-fit rounded bg-accent px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent-deep"
        >
          Add
        </button>
      </form>
    </details>
  );
}