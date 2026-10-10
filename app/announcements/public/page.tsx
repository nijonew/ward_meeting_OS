import { AppHeader } from "@/components/AppHeader";
import { getPublishedAnnouncements } from "@/lib/data/general-submissions";

/**
 * The actual public "Announcements" page linked from the landing
 * page's Tier 0 tile -- no login required (RLS on `announcements`
 * already limits anon/other visitors to `status = 'published'` rows).
 *
 * Fixed 2026-09-05: this file previously contained a stray duplicate
 * of the landing page's HomePage component -- getPublishedAnnouncements
 * existed but was never called from anywhere, so the "Announcements"
 * tile silently opened a second copy of the home page instead of any
 * actual announcement. Found while extending `announcements` for the
 * event-announcement workflow.
 *
 * Simplified 2026-10-10 (the user's own request, right after reviewing
 * the real content migrated in from the ward's old form): "don't show
 * more info, announcement type, attached file. If there is an included
 * link please include that with a hyperlink on the page." Three
 * changes: the meta line no longer shows `announcement_type` (still
 * shown in the admin inbox and Table Admin, both internal-management
 * views where the extra detail is still useful -- this page is the
 * only one that dropped it); the title itself becomes the hyperlink
 * when a `link_url` is set, instead of a separate "More info" line
 * underneath; and the one-off "Attached file: <url>" line this
 * session's own announcement-backlog migration had put inline in one
 * announcement's body (there's no real attachment column in this
 * schema, see migration 031's own comment) is gone from that
 * migration's source data rather than rendered as raw text here --
 * see migration 065's own header comment for where that link actually
 * ended up instead.
 */

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Postgres `time` columns come back as 24-hour "HH:MM:SS" strings --
 *  rendered as plain AM/PM (2026-10-10, the user's own request: "update
 *  the time reporting in the announcements page to am/pm rather than
 *  military time. Make it user friendly") rather than showing that raw
 *  military-time string as-is. */
function formatTime(t: string): string {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  if (Number.isNaN(h)) return t;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${mStr} ${period}`;
}

function formatDateRange(a: {
  start_date: string | null;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
}): string | null {
  if (!a.start_date) return null;
  let text = formatDate(a.start_date);
  if (a.start_time) text += ` · ${formatTime(a.start_time)}`;
  if (a.end_date && a.end_date !== a.start_date) {
    text += ` – ${formatDate(a.end_date)}`;
    if (a.end_time) text += ` · ${formatTime(a.end_time)}`;
  } else if (a.end_time) {
    text += ` – ${formatTime(a.end_time)}`;
  }
  return text;
}

export default async function PublicAnnouncementsPage() {
  const announcements = await getPublishedAnnouncements();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Announcements" />

      <section className="mt-4">
        <h1 className="rise-in font-display text-3xl leading-tight sm:text-4xl">Announcements</h1>
      </section>

      <div className="rounded border border-rule bg-surface p-6">
        {announcements.length === 0 ? (
          <p className="text-sm text-ink-muted">Nothing posted yet.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {announcements.map((a) => {
              const dateRange = formatDateRange(a);
              const meta = a.organization ?? "";
              return (
                <li key={a.id} className="rounded border border-rule/60 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="font-display text-base text-ink">
                      {a.link_url ? (
                        <a href={a.link_url} className="underline decoration-ink-muted/40 hover:decoration-ink">
                          {a.title}
                        </a>
                      ) : (
                        a.title
                      )}
                    </span>
                    {dateRange && (
                      <span className="font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">
                        {dateRange}
                      </span>
                    )}
                  </div>
                  {meta && <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-muted/60">{meta}</p>}
                  {a.body && <p className="mt-2 whitespace-pre-wrap text-ink-muted">{a.body}</p>}
                  {a.location && <p className="mt-1 text-[11px] text-ink-muted/70">Location: {a.location}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
