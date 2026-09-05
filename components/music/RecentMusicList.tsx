import { MUSIC_TYPES } from "@/lib/data/sacrament-constants";
import type { RecentMusicItem } from "@/lib/data/music-list";

function typeLabel(value: string) {
  return MUSIC_TYPES.find((t) => t.value === value)?.label ?? value;
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function RecentMusicList({ items }: { items: RecentMusicItem[] }) {
  return (
    <div className="rounded-lg border border-rule bg-card p-6">
      <h2 className="font-display text-xl">Upcoming Submissions</h2>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate">Nothing submitted yet.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1.5">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-2 border-b border-rule/40 py-1.5 text-sm last:border-0"
            >
              <span className="font-mono text-[11px] uppercase tracking-widest text-slate/70">
                {formatDate(item.date)}
              </span>
              <span>
                &middot; {typeLabel(item.type)}
                {item.piece_name && <> &mdash; {item.piece_name}</>}
                {item.hymn_number && <> (Hymn {item.hymn_number})</>}
                {item.performer && <span className="text-slate"> &middot; {item.performer}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
