import Link from "next/link";

function formatShortDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Forward/backward arrows to the nearest earlier/later meeting of the
 * same type, by date -- 2026-11-05, the user's own request. Links to
 * the bare `/meetings/<id>` route rather than `/planning`/`/archived`
 * directly, so it always lands wherever that OTHER meeting's own
 * state says to (that route already redirects to Planning if still
 * open, or Archived once archived/for a non-admin) -- the same
 * decision this app already makes everywhere else a meeting is
 * entered from, not duplicated here.
 */
export function MeetingWeekNav({
  previous,
  next,
}: {
  previous: { id: string; date: string } | null;
  next: { id: string; date: string } | null;
}) {
  if (!previous && !next) return null;

  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      {previous ? (
        <Link href={`/meetings/${previous.id}`} className="text-ink-muted hover:text-ink">
          &larr; {formatShortDate(previous.date)}
        </Link>
      ) : (
        <span className="text-ink-muted/30">&larr;</span>
      )}
      {next ? (
        <Link href={`/meetings/${next.id}`} className="text-ink-muted hover:text-ink">
          {formatShortDate(next.date)} &rarr;
        </Link>
      ) : (
        <span className="text-ink-muted/30">&rarr;</span>
      )}
    </div>
  );
}
