import type { HistoryEntry, SpeakingPrayingNote, DueCategory } from "@/lib/data/speaker-prayer-history";
import { DueCheckbox } from "@/components/speaker-prayer-history/DueCheckbox";
import { DeleteEntryButton } from "@/components/speaker-prayer-history/DeleteEntryButton";

export function formatHistoryDate(iso: string) {
  if (!iso) return "";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * A meeting-sourced "Youth Speaker" row already means youth (it comes
 * from the separate `sacrament_speakers_youth` table) -- role wins over
 * `age_group` there. An import-sourced row is always labeled plain
 * "Speaker" regardless of age (migration 079's source sheet had no
 * adult/youth distinction of its own), so those fall back to the
 * person's own `age_group`; an unknown age (a guest, or no age set)
 * defaults to the Adults list rather than being silently dropped.
 */
export function speakerBucket(entry: HistoryEntry): "adult" | "youth" {
  if (entry.role === "Youth Speaker") return "youth";
  return entry.age_group === "youth" ? "youth" : "adult";
}

/**
 * "Due" box + the full history list, 2026-11-01 (the user's own
 * design, migration 097): a checkbox next to each person's own
 * most-recent row (their only checkbox -- older turns for the same
 * person don't repeat it) adds or removes them from a small curated
 * "Due" box shown right above the full list, "so that we know who has
 * not spoken or prayed recently" -- the user's own original framing,
 * now served by manual curation rather than an automatic computation.
 * A guest with no real `person_id` gets no checkbox at all -- nothing
 * to flag as due to reach out to.
 *
 * **Extracted into its own file, 2026-11-08** -- previously defined
 * inline in `app/speaker-prayer-history/page.tsx`, which rendered all
 * three of these side by side in one `grid-cols-3` row. The three
 * categories (Speakers Adults/Youth, Prayers) are now each their own
 * full page (the user's own request: "Put the speaker and prayer
 * tables on separate tables with their own tiles that show up in
 * their own page"), each rendering exactly one of these, full width.
 * Lost its own `title`/`<h2>` in the same move -- every page that
 * renders this now already has its own `<h1>` carrying that same
 * title (same "hub tag + specific h1" convention already used by
 * `/youth-teaching-planning?class=<name>`), so repeating it here would
 * just say it twice.
 */
export function HistoryListCard({
  category,
  entries,
  notesByPerson,
  noteKey,
  dueFlags,
}: {
  category: DueCategory;
  entries: HistoryEntry[];
  notesByPerson: Map<string, SpeakingPrayingNote>;
  noteKey: "speaking_note" | "praying_note";
  dueFlags: Set<string>;
}) {
  const nameByPersonId = new Map<string, string>();
  for (const e of entries) {
    if (e.person_id && !nameByPersonId.has(e.person_id)) nameByPersonId.set(e.person_id, e.person_name);
  }
  const duePeople = Array.from(nameByPersonId.entries()).filter(([personId]) =>
    dueFlags.has(`${personId}::${category}`)
  );

  const seenPersonIds = new Set<string>();

  return (
    <div className="rounded border border-rule bg-surface p-6">
      <div className="rounded border border-accent/30 bg-accent/5 p-3">
        <p className="font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">Due</p>
        {duePeople.length === 0 ? (
          <p className="mt-1 text-xs text-ink-muted">Check someone below to add them here.</p>
        ) : (
          <ul className="mt-1.5 flex flex-col gap-1">
            {duePeople.map(([personId, name]) => (
              <li key={personId} className="flex items-center gap-2 text-sm">
                <DueCheckbox personId={personId} category={category} checked />
                <span className="text-ink">{name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ul className="mt-3 flex flex-col gap-1.5">
        {entries.length === 0 && <li className="text-sm text-ink-muted">Nothing on record yet.</li>}
        {entries.map((e, i) => {
          const isFirstForPerson = e.person_id ? !seenPersonIds.has(e.person_id) : false;
          if (e.person_id) seenPersonIds.add(e.person_id);
          return (
            <li
              key={i}
              className="flex items-baseline justify-between gap-3 border-b border-rule/40 py-1.5 text-sm last:border-0"
            >
              <span className="flex items-center gap-2">
                {e.person_id && isFirstForPerson ? (
                  <DueCheckbox personId={e.person_id} category={category} checked={dueFlags.has(`${e.person_id}::${category}`)} />
                ) : (
                  <span className="inline-block w-3.5" />
                )}
                <span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">{e.role}</span>{" "}
                  <span className="text-ink">{e.person_name}</span>
                  {e.topic && <span className="text-ink-muted"> &middot; {e.topic}</span>}
                  {e.person_id && notesByPerson.get(e.person_id)?.[noteKey] && (
                    <span className="ml-1.5 text-[10px] text-ink-muted/70">({notesByPerson.get(e.person_id)?.[noteKey]})</span>
                  )}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-ink-muted">{formatHistoryDate(e.date)}</span>
                {e.historyImportId && <DeleteEntryButton entryId={e.historyImportId} />}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
