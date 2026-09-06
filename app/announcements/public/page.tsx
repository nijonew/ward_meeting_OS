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
 */

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatDateRange(a: {
  start_date: string | null;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
}): string | null {
  if (!a.start_date) return null;
  let text = formatDate(a.start_date);
  if (a.start_time) text += ` · ${a.start_time}`;
  if (a.end_date && a.end_date !== a.start_date) {
    text += ` – ${formatDate(a.end_date)}`;
    if (a.end_time) text += ` · ${a.end_time}`;
  } else if (a.end_time) {
    text += ` – ${a.end_time}`;
  }
  return text;
}

export default async function PublicAnnouncementsPage() {
  const announcements = await getPublishedAnnouncements();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Announcements" />

      <section className="mt-4">
        <h1 className="font-display text-3xl leading-tight sm:text-4xl">Announcements</h1>
      </section>

      <div className="rounded-lg border border-rule bg-card p-6">
        {announcements.length === 0 ? (
          <p className="text-sm text-slate">Nothing posted yet.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {announcements.map((a) => {
              const dateRange = formatDateRange(a);
              const meta = [a.organization, a.announcement_type].filter(Boolean).join(" · ");
              return (
                <li key={a.id} className="rounded-md border border-rule/60 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="font-display text-base text-ink">{a.title}</span>
                    {dateRange && (
                      <span className="font-mono text-[10px] uppercase tracking-widest text-slate/70">
                        {dateRange}
                      </span>
                    )}
                  </div>
                  {meta && <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-slate/60">{meta}</p>}
                  {a.body && <p className="mt-2 whitespace-pre-wrap text-slate">{a.body}</p>}
                  {a.location && <p className="mt-1 text-[11px] text-slate/70">Location: {a.location}</p>}
                  {a.link_url && (
                    <p className="mt-1 text-[11px]">
                      <a href={a.link_url} className="underline text-slate hover:text-ink">
                        More info
                      </a>
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
