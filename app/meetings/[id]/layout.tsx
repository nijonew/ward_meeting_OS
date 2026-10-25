import { notFound } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { MeetingTabNav } from "@/components/meetings/MeetingTabNav";
import { getMeetingById } from "@/lib/data/meetings";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";

function formatMeetingDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const SACRAMENT_TABS = [
  { slug: "planning", label: "Planning" },
  { slug: "conducting", label: "Conducting" },
  { slug: "public", label: "Public" },
] as const;

/**
 * Just Planning + Public, 2026-10-19 -- the user's own request to
 * eliminate the stage/phase concept and the Template/Live tabs from
 * every collaborative meeting page ("The planning and public tabs can
 * remain. Seems like the phase elements don't have actual workings
 * behind them?"), confirmed by reading the code: /meetings/[id]/live
 * had no edit capability and nothing tied to the `live` stage
 * specifically (deleted outright, see git history), and Template was
 * never its own real workflow step -- the Agenda Elements editor page
 * stays, reachable only via the link Planning already has to it,
 * exactly how Sacrament Meeting has always worked (it never listed
 * "template" as its own tab either). Public (still the same route,
 * app/meetings/[id]/archived -- renaming that folder for a label-only
 * change felt like more churn than the ask needed) is now shown
 * unconditionally rather than only once archived, mirroring Sacrament's
 * own Planning/Conducting/Public tabs, which are always all three.
 */
const COLLABORATIVE_TABS = [
  { slug: "planning", label: "Planning" },
  { slug: "archived", label: "Public" },
] as const;

/**
 * Shared shell for everything under /meetings/[id]/*. Renders the meeting
 * card (title, date) and the tab nav once. Sacrament Meeting uses
 * Planning/Conducting/Public; Bishopric Meeting, Ward Council, and
 * Youth Council use Planning/Public. Deliberately does NOT require
 * sign-in here -- Public View must work with no login at all. Planning
 * and Conducting gate themselves individually instead.
 *
 * **No lifecycle badge shown here anymore, 2026-10-19** -- same request
 * as above. `meetings.stage` still exists and still does real work
 * (archived = read-only, dashboard filtering, auto-archive sweep), only
 * the visible track/badge UI is gone from this shared header; the
 * dashboard's own compact per-row badge is untouched.
 */
export default async function MeetingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const meeting = await getMeetingById(id);

  if (!meeting) {
    notFound();
  }

  // A viewer who can neither plan nor conduct a Sacrament Meeting can
  // only ever reach its Public page (2026-10-04, the user's own
  // request) -- they don't need the Planning/Conducting/Public tab
  // nav (one of those labels literally says "Public"), the lifecycle
  // stage badge, or the Cancelled banner's own chrome here; just the
  // bare agenda the child page itself renders (that page handles a
  // cancelled meeting on its own, with no surrounding chrome needed).
  // Scoped to Sacrament Meeting specifically -- it's the only type
  // with a "Public" concept at all; the other three types' calling-
  // based read-only viewer (Live/Archived) is a different, already-
  // settled design.
  if (meeting.meetingType === "sacrament-meeting") {
    const { profile } = await getSessionUser();
    const canPlanOrConduct = hasFeature(profile, "sacrament_planning") || hasFeature(profile, "sacrament_conducting");
    if (!canPlanOrConduct) {
      return (
        <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
          <AppHeader tag={meeting.title} />

          <section className="mt-10">
            <h1 className="rise-in font-display text-3xl leading-tight sm:text-4xl">{meeting.title}</h1>
            <p className="mt-1 text-ink-muted">{formatMeetingDate(meeting.date)}</p>
          </section>

          <div className="mt-8 flex-1">{children}</div>

          <footer className="mt-auto pt-16 text-xs text-ink-muted">
            Ward Meeting OS
          </footer>
        </main>
      );
    }
  }

  const baseTabs = meeting.meetingType === "sacrament-meeting" ? SACRAMENT_TABS : COLLABORATIVE_TABS;
  // Sacrament Meeting alone keeps a conditional 4th tab once archived --
  // its own admin-only full archived-agenda view, a genuinely different
  // page from Public (the day-of print-ready program). Collaborative
  // types don't need this: their "Public" tab (COLLABORATIVE_TABS,
  // above) already points at this same archived/page.tsx route
  // unconditionally, serving both the live and archived read-only view
  // from one tab.
  const tabs =
    meeting.meetingType === "sacrament-meeting" && meeting.stage === "archived"
      ? [...baseTabs, { slug: "archived", label: "Archived" }]
      : baseTabs;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
      <AppHeader tag={meeting.title} />

      <section className="mt-10 rounded border border-rule bg-surface p-6 sm:p-8">
        <Link href="/dashboard" className="text-xs text-ink-muted hover:text-ink">
          &larr; Meetings
        </Link>
        <h1 className="rise-in mt-2 font-display text-3xl leading-tight sm:text-4xl">{meeting.title}</h1>
        <p className="mt-1 text-ink-muted">{formatMeetingDate(meeting.date)}</p>

        {meeting.cancelled && (
          <div className="mt-6 flex flex-wrap items-center gap-3 overflow-x-auto pb-1">
            <span className="whitespace-nowrap font-mono text-[11px] uppercase tracking-wider text-danger">
              Cancelled{meeting.cancellationNote ? `: ${meeting.cancellationNote}` : ""}
            </span>
          </div>
        )}
      </section>

      <MeetingTabNav meetingId={meeting.id} tabs={tabs} />

      <div className="mt-8 flex-1">{children}</div>

      <footer className="mt-auto pt-16 text-xs text-ink-muted">
        Ward Meeting OS
      </footer>
    </main>
  );
}
