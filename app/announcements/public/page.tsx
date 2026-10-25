import type { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { getPublishedAnnouncements } from "@/lib/data/general-submissions";
import { formatAnnouncementSchedule, groupAndSortAnnouncements } from "@/lib/data/announcements";
import type { PublishedAnnouncement } from "@/lib/data/general-submissions";

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
 *
 * **Date/time formatting moved to a shared helper, 2026-10-18** (the
 * user's own request, naming the exact format wanted: "show the date
 * in a format of day of the week, month, date (monday, october 19th
 * at 6:00 pm)") -- `formatDate`/`formatTime`/`formatDateRange` used to
 * live only here (abbreviated weekday/month, e.g. "Mon, Oct 19 · 6:00
 * PM"); now `formatAnnouncementDateRange` (`lib/data/announcements.ts`)
 * renders the fuller "Monday, October 19th at 6:00 PM" form and is
 * shared with the Conducting script's own spoken wording, which asked
 * for the identical change in the same request ("make that change in
 * the conducting view and where they are viewed").
 *
 * **Location folded into that same line, 2026-10-18** (the user's own
 * immediate follow-up: "move the location in an announcement to be
 * after the time and date (eg sunday october 25th at 7:00 pm - stake
 * center)") -- the separate "Location: X" line below the body is gone;
 * `formatAnnouncementSchedule` now renders date/time and location
 * together in the one meta line next to the title.
 *
 * **Link made more pronounced + opens in a new tab, 2026-10-18** (the
 * user's own request) -- the dedicated "Link" line (added 2026-10-13
 * as a plainer, more obvious way to reach `link_url` than relying on
 * the title alone being clickable) was itself easy to miss: tiny,
 * muted, barely distinguishable from the location/meta text around
 * it. Now a small accent-colored pill, closer to this app's other
 * real buttons than to a plain inline text link. Both this and the
 * title's own link now open in a new tab (`target="_blank"` +
 * `rel="noopener noreferrer"`, the latter required alongside
 * `target="_blank"` so the opened tab can't reach back into this
 * page via `window.opener`) -- a submitted announcement's link is
 * always some other site, never a page within this app, so leaving
 * this one open rather than navigating away from the announcements
 * list is the more useful default.
 *
 * **Grouped by title + sorted soonest-to-latest, 2026-10-24** (the
 * user's own report: "I have several assignments on different dates.
 * They have the same title and I want them grouped together, but I
 * want the overall sort to be by soonest date to latest date, but with
 * those of the same title grouped together"). This list had only ever
 * been sorted by `created_at DESC` -- newest-*submitted* first, with no
 * relationship at all to each announcement's own event date -- so
 * several same-titled entries for different dates (e.g. a few practice
 * dates for the same assignment) could land scattered anywhere in the
 * list depending purely on when each was typed in. `groupAndSortAnnouncements`
 * (`lib/data/announcements.ts`) now clusters by exact title (trimmed,
 * case-insensitive) and orders both the clusters and each cluster's own
 * members by date, soonest first; a cluster with more than one member
 * renders as one card with the shared title shown once, each dated
 * instance listed underneath instead of repeating the full card N
 * times. A cluster of exactly one (the ordinary case) still renders
 * exactly as it always has.
 */

/** Meta line, body, and Link button -- everything about one announcement
 *  except its title and schedule, whose placement differs between a
 *  lone announcement (title + schedule share one row) and a grouped
 *  sub-item (no title of its own; the schedule effectively stands in
 *  for it). Both call sites render those two separately, then this. */
function AnnouncementBody({ a }: { a: PublishedAnnouncement }) {
  const meta = a.organization ?? "";
  return (
    <>
      {meta && <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-muted/60">{meta}</p>}
      {a.body && <p className="mt-2 whitespace-pre-wrap text-ink-muted">{a.body}</p>}
      {/* 2026-10-13, the user's own request: "can we get the word
          'Link' to show up in the public views of the announcements as
          a hyperlink to any announcement that has a url?" -- the title
          itself has been clickable since 2026-10-10, but nothing
          visibly said so; this is a plainer, more obvious second way
          to reach the same URL. */}
      {a.link_url && (
        <a
          href={a.link_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 rounded border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent hover:bg-accent/20"
        >
          Link <span aria-hidden="true">&rarr;</span>
        </a>
      )}
    </>
  );
}

function LinkedText({ href, children }: { href: string | null; children: ReactNode }) {
  if (!href) return <>{children}</>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline decoration-ink-muted/40 hover:decoration-ink">
      {children}
    </a>
  );
}

export default async function PublicAnnouncementsPage() {
  const announcements = await getPublishedAnnouncements();
  const groups = groupAndSortAnnouncements(announcements);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Announcements" />

      <section className="mt-4">
        <h1 className="rise-in font-display text-3xl leading-tight sm:text-4xl">Announcements</h1>
      </section>

      <div className="rounded border border-rule bg-surface p-6">
        {groups.length === 0 ? (
          <p className="text-sm text-ink-muted">Nothing posted yet.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {groups.map((group) => {
              // A lone announcement keeps its exact original layout --
              // title and schedule share one row, same as before this
              // change. Only a real cluster (>1 same-titled item) gets
              // the new shared-heading treatment.
              if (group.items.length === 1) {
                const a = group.items[0];
                const schedule = formatAnnouncementSchedule(a);
                return (
                  <li key={a.id} className="rounded border border-rule/60 px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <span className="font-display text-base text-ink">
                        <LinkedText href={a.link_url}>{a.title}</LinkedText>
                      </span>
                      {schedule && (
                        <span className="font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">
                          {schedule}
                        </span>
                      )}
                    </div>
                    <AnnouncementBody a={a} />
                  </li>
                );
              }

              return (
                <li key={group.items.map((a) => a.id).join("-")} className="rounded border border-rule/60 px-3 py-2 text-sm">
                  <span className="font-display text-base text-ink">
                    <LinkedText href={group.items[0].link_url}>{group.title}</LinkedText>
                  </span>
                  <ul className="mt-2 flex flex-col gap-3 divide-y divide-rule/40">
                    {group.items.map((a) => {
                      const schedule = formatAnnouncementSchedule(a);
                      return (
                        <li key={a.id} className="pt-3 first:pt-0">
                          {schedule && (
                            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">{schedule}</p>
                          )}
                          <AnnouncementBody a={a} />
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
