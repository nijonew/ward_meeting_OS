import { arrangeMusicItem } from "@/app/meetings/[id]/planning/actions";
import { MUSIC_ARRANGE_SLOTS, slotLabel } from "@/lib/data/sacrament-constants";
import type { MusicRow } from "@/lib/data/sacrament-planning";

const TYPE_LABELS: Record<string, string> = {
  opening_hymn: "Opening Hymn",
  sacrament_hymn: "Sacrament Hymn",
  closing_hymn: "Closing Hymn",
  intermediate_hymn: "Intermediate Hymn",
  musical_number: "Musical Number",
};

function MusicItemDetails({ item }: { item: MusicRow }) {
  const performer = item.group_name || item.individual_name;
  return (
    <div className="text-sm">
      <p className="font-mono text-[11px] uppercase tracking-widest text-slate/70">
        {TYPE_LABELS[item.type] ?? item.type}
      </p>
      <p className="text-ink">
        {item.piece_name ?? "Untitled"}
        {item.hymn_number ? ` (Hymn ${item.hymn_number})` : ""}
      </p>
      {performer && <p className="text-slate">{performer}</p>}
    </div>
  );
}

/** Standard hymns (opening/sacrament/closing) have nothing left to
 *  configure -- there's no approval step anymore and only one of each
 *  fits in a meeting, so this is just a display row. */
function StandardMusicRow({ item }: { item: MusicRow }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-rule/60 p-3 sm:flex-row sm:items-center sm:justify-between">
      <MusicItemDetails item={item} />
    </div>
  );
}

/** Intermediate Hymns and Musical Numbers can have more than one per
 *  meeting (up to 3 and 6 respectively), so each needs a slot assigned
 *  to know where it's called into the program. */
function ExtraMusicRow({ item, meetingId }: { item: MusicRow; meetingId: string }) {
  const arrange = async (formData: FormData) => {
    "use server";
    await arrangeMusicItem(item.id, meetingId, formData);
  };

  return (
    <form
      action={arrange}
      className="flex flex-col gap-2 rounded-md border border-rule/60 p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <MusicItemDetails item={item} />

      <div className="flex items-center gap-3">
        <select
          name="slot"
          defaultValue={item.slot ?? ""}
          className="rounded-md border border-rule bg-paper px-2 py-1.5 text-xs text-ink"
        >
          <option value="">&mdash; Slot &mdash;</option>
          {MUSIC_ARRANGE_SLOTS.map((slot) => (
            <option key={slot} value={slot}>
              {slotLabel(slot)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-paper transition-colors hover:bg-ink/90"
        >
          Save
        </button>
      </div>
    </form>
  );
}

export function MusicArrangeSection({ meetingId, music }: { meetingId: string; music: MusicRow[] }) {
  const standard = music.filter((m) =>
    ["opening_hymn", "sacrament_hymn", "closing_hymn"].includes(m.type)
  );
  const extras = music.filter((m) => ["intermediate_hymn", "musical_number"].includes(m.type));

  return (
    <div className="rounded-lg border border-rule bg-card p-6">
      <h2 className="font-display text-xl">Music</h2>
      <p className="mt-1 text-xs text-slate">
        Entered by the Music planner, ready as soon as it&rsquo;s entered. Intermediate Hymns and
        Musical Numbers additionally need a slot assigned to be called into the program.
      </p>

      {music.length === 0 ? (
        <p className="mt-4 text-sm text-slate">
          No music submitted yet for this meeting.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {standard.map((item) => (
            <StandardMusicRow key={item.id} item={item} />
          ))}
          {extras.map((item) => (
            <ExtraMusicRow key={item.id} item={item} meetingId={meetingId} />
          ))}
        </div>
      )}
    </div>
  );
}
