import type { ReviewAnnouncement, PreviousMeetingMinutes } from "@/lib/data/meeting-review";

/**
 * Review section content (2026-10-19) -- Announcements (pulled in
 * automatically by `where_announced`, no pull mechanism) and the
 * previous meeting's General Minutes summary. Read-only everywhere it
 * renders, on both Planning and the read-only Public view -- nothing
 * here is editable from this section.
 */
export function ReviewSection({
  announcements,
  previousMinutes,
}: {
  announcements: ReviewAnnouncement[];
  previousMinutes: PreviousMeetingMinutes | null;
}) {
  if (announcements.length === 0 && !previousMinutes) {
    return <p className="text-sm text-ink-muted/50">Nothing to review yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded border border-rule/60 p-3">
        <p className="font-mono text-[11px] uppercase tracking-wider text-ink-muted/70">Announcements</p>
        {announcements.length > 0 ? (
          <ul className="mt-2 flex flex-col gap-2">
            {announcements.map((a) => (
              <li key={a.id} className="text-sm">
                <span className="text-ink">{a.title}</span>
                {a.body && <p className="mt-0.5 text-ink-muted">{a.body}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-ink-muted/50">None</p>
        )}
      </div>

      <div className="rounded border border-rule/60 p-3">
        <p className="font-mono text-[11px] uppercase tracking-wider text-ink-muted/70">Previous Meeting Minutes</p>
        {previousMinutes ? (
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{previousMinutes.text}</p>
        ) : (
          <p className="mt-1 text-sm text-ink-muted/50">None</p>
        )}
      </div>
    </div>
  );
}
