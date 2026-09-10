import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { LifecycleBadge } from "@/components/LifecycleBadge";
import { CancelMeetingButton } from "@/components/dashboard/CancelMeetingButton";
import { getMeetingTypes, getUpcomingMeetings } from "@/lib/data/meetings";
import { getUnassignedAgendaItems } from "@/lib/data/bishopric-meeting";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { assignAgendaItemToMeeting } from "@/app/meetings/[id]/bishopric-actions";
import { cancelMeeting, uncancelMeeting } from "@/app/dashboard/actions";
import { MEETING_TYPE_LABELS, type Meeting, type MeetingTypeSlug } from "@/lib/types";

function formatMeetingDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * One `<tr>` per meeting -- reworked 2026-09-09 from a stacked card (with
 * a separate cancel-controls block below it) into a single grid row, per
 * the user's own request: "the overall look can look more like the
 * grids we have been using... single line items per scheduled event."
 * `showType` is false whenever the list is already filtered to one
 * meeting type (the common case now that navigation goes through
 * /meeting-agendas' and "My meetings"' per-type tiles) -- the type name
 * was showing up twice per row (a small label plus the big heading) on
 * top of already being named in the section header and (2026-09-09) the
 * page's own "<Type> Planning Dashboard" heading, which the same
 * feedback flagged directly ("the words 'sacrament meeting' appear too
 * often").
 *
 * Reworked again the same day, per the user's follow-up: the date is
 * now a real button (not just a hover-underline link) -- "so it is
 * obvious that by clicking the date is how you enter meeting planning"
 * -- and the Stage column shows only the current stage
 * (`LifecycleBadge`'s `compact` mode) instead of the full
 * Template-through-Archived track, freeing up the row's width for that
 * bigger date button. Cancel became its own client component
 * (CancelMeetingButton) since revealing the reason field only after
 * the button is clicked needs client state a plain server-action
 * `<form>` can't provide on its own.
 */
function MeetingRow({
  meeting,
  isBuilt,
  canManage,
  showType,
}: {
  meeting: Meeting;
  isBuilt: boolean;
  canManage: boolean;
  showType: boolean;
}) {
  // Admins land on the meeting's own hub (tabs for Planning/Conducting/
  // Public, or Template/Planning/Live) same as always; everyone else
  // goes straight to whichever read-only view actually applies to them
  // -- the public program for Sacrament Meeting, the calling-based
  // read-only view (which enforces its own access) for the other three.
  const nonAdminHref = meeting.meetingType === "sacrament-meeting" ? "public" : "archived";
  const href = canManage ? `/meetings/${meeting.id}` : `/meetings/${meeting.id}/${nonAdminHref}`;

  const dateCell = isBuilt ? (
    <Link
      href={href}
      className="inline-flex items-center whitespace-nowrap rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink/90"
    >
      {formatMeetingDate(meeting.date)}
    </Link>
  ) : (
    <span className="text-sm text-ink/40">{formatMeetingDate(meeting.date)}</span>
  );

  const uncancel = async () => {
    "use server";
    await uncancelMeeting(meeting.id);
  };
  const cancel = async (formData: FormData) => {
    "use server";
    await cancelMeeting(formData);
  };

  return (
    <tr className={["border-t border-rule/60", meeting.cancelled ? "bg-red-950/5" : ""].join(" ")}>
      <td className="px-2 py-2 align-top">{dateCell}</td>
      {showType && <td className="px-2 py-2 align-top text-sm text-ink-muted">{meeting.title}</td>}
      <td className="px-2 py-2 align-top">
        <div className="flex flex-wrap items-center gap-2">
          <LifecycleBadge stage={meeting.stage} compact />
          {!isBuilt && (
            <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">
              Coming soon
            </span>
          )}
          {meeting.cancelled && (
            <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-red-700">
              Cancelled{meeting.cancellationNote ? `: ${meeting.cancellationNote}` : ""}
            </span>
          )}
          {meeting.noActivity && !meeting.cancelled && (
            <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-ink-muted/50">
              No Activity
            </span>
          )}
        </div>
      </td>
      <td className="px-2 py-2 align-top">
        {canManage &&
          meeting.stage !== "archived" &&
          (meeting.cancelled ? (
            <form action={uncancel}>
              <button
                type="submit"
                className="whitespace-nowrap rounded-md border border-rule px-3 py-1.5 text-xs text-ink hover:bg-ink/5"
              >
                Un-cancel
              </button>
            </form>
          ) : (
            <CancelMeetingButton meetingId={meeting.id} cancelAction={cancel} />
          ))}
      </td>
    </tr>
  );
}

const MEETING_TYPE_SLUGS = new Set<string>(["sacrament-meeting", "bishopric-meeting", "ward-council", "youth-council"]);

// The root layout's metadata.title ("Ward Meeting OS") has no
// title.template, so every page's browser tab has always shown that
// same generic string regardless of which page is open -- the on-page
// h1 fix (2026-09-09) didn't touch this at all, it's a separate piece
// of chrome. Renamed from "Dashboard" to "Meeting Dashboard" the same
// day, once the landing page itself also became "Dashboard" (see
// app/page.tsx) -- the user was confused about which page was actually
// "the dashboard page", so the two needed to read distinctly, not just
// exist as separate routes.
//
// A static `metadata` export can't read searchParams, so this became a
// `generateMetadata` function once the title needed to vary by
// `?type=` (2026-09-09, the user's own request: "each meeting-specific
// page... can be titled by the meeting type followed by 'planning
// dashboard'") -- shares dashboardPageTitle with the on-page <h1> below
// so the two can never drift apart.
function dashboardPageTitle(typeFilter: MeetingTypeSlug | null): string {
  return typeFilter ? `${MEETING_TYPE_LABELS[typeFilter]} Planning Dashboard` : "Meeting Dashboard";
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}): Promise<Metadata> {
  const { type: rawType } = await searchParams;
  const typeFilter: MeetingTypeSlug | null = rawType && MEETING_TYPE_SLUGS.has(rawType) ? (rawType as MeetingTypeSlug) : null;
  return { title: dashboardPageTitle(typeFilter) };
}

/** Builds a /dashboard URL preserving whichever of these three
 *  independent toggles the caller doesn't explicitly override --
 *  type filter, readonly mode, and (2026-09-09) the past-meetings
 *  toggle below, so e.g. "Show all types" doesn't accidentally flip
 *  the user back into showing archived meetings, and vice versa. */
function dashboardHref(overrides: { type?: MeetingTypeSlug | null; readonly?: boolean; past?: boolean }): string {
  const params = new URLSearchParams();
  if (overrides.type) params.set("type", overrides.type);
  if (overrides.readonly) params.set("readonly", "1");
  if (overrides.past) params.set("past", "1");
  const qs = params.toString();
  return qs ? `/dashboard?${qs}` : "/dashboard";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; readonly?: string; past?: string }>;
}) {
  const { type: rawType, readonly: rawReadOnly, past: rawPast } = await searchParams;
  const typeFilter: MeetingTypeSlug | null = rawType && MEETING_TYPE_SLUGS.has(rawType) ? (rawType as MeetingTypeSlug) : null;
  // Reached with ?readonly=1 from the landing page's "My meetings"
  // section (2026-09-09, the user's own request: "make my meetings
  // section for read only views of meetings") -- forces canCreate off
  // even for a Bishopric account, which otherwise sees the full New
  // Meeting/Cancel/Unassigned-Agenda-Items control surface below. The
  // new "Meeting Planning" Administration tile links to this same page
  // with no readonly flag, for exactly that full control surface.
  const isReadOnly = rawReadOnly === "1";
  // getUpcomingMeetings() returns literally every meeting ever, despite
  // its name -- auto-archiving only changes a past meeting's *stage*,
  // it never stopped that meeting from still being listed here. First
  // pass (2026-09-09) filtered out only `stage === "archived"`, but the
  // user's immediate follow-up ("today is 9/9/2026 and I am still
  // seeing meetings to plan for back in august") showed that was too
  // narrow -- a past meeting that never got any real activity recorded
  // stays un-archived forever (see autoArchivePastMeetings/noActivity),
  // so filtering by stage alone still left every old, untouched test/
  // stale meeting sitting in the default view indefinitely. Filtering
  // by date instead: hidden by default is simply "date is before
  // today," archived or not. ?past=1 still brings every past meeting
  // back (its own date, stage, and "No Activity" badge intact) for
  // anyone who needs to find one, e.g. to review an archived meeting's
  // minutes.
  const showPast = rawPast === "1";
  const todayIso = new Date().toISOString().slice(0, 10);

  const { user, profile } = await getSessionUser();

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Meetings" />
        <h1 className="mt-10 font-display text-3xl leading-tight sm:text-4xl">{dashboardPageTitle(typeFilter)}</h1>
        <p className="mt-4 text-ink-muted">Sign in to see meetings.</p>
        <Link
          href="/login"
          className="mt-4 inline-flex w-fit items-center rounded-md bg-ink px-5 py-2.5 font-body text-sm font-medium text-paper transition-colors hover:bg-ink/90"
        >
          Sign in
        </Link>
      </main>
    );
  }

  const [allMeetings, meetingTypes] = await Promise.all([getUpcomingMeetings(), getMeetingTypes()]);
  const meetings = allMeetings
    .filter((m) => !typeFilter || m.meetingType === typeFilter)
    .filter((m) => showPast || m.date >= todayIso);
  const builtSlugs = new Set(meetingTypes.filter((t) => t.isBuilt).map((t) => t.slug));
  const canCreate = profile?.role === "bishopric" && !isReadOnly;
  const unassignedAgendaItems = canCreate ? await getUnassignedAgendaItems() : [];

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
      <AppHeader tag="Meetings" />

      {/* Reached two different ways -- the landing page's "My meetings"
          tiles (readonly=1, one click from Home, wordmark-only "back" is
          fine there, same as every other top-level tile) and Meeting
          Agendas' per-type tiles (no readonly flag, three clicks deep:
          Home -> Meeting Planning -> Meeting Agendas -> here). Only the
          second path needs a real breadcrumb back out -- `isReadOnly`
          already distinguishes the two contexts exactly. */}
      {!isReadOnly && (
        <Link href="/meeting-agendas" className="mt-6 text-xs text-ink-muted hover:text-ink">
          &larr; Meeting Agendas
        </Link>
      )}

      <h1 className="mt-10 font-display text-3xl leading-tight sm:text-4xl">{dashboardPageTitle(typeFilter)}</h1>

      {canCreate && unassignedAgendaItems.length > 0 && (
        <section className="mt-10 rounded-lg border border-rule bg-surface p-6">
          <h2 className="font-display text-xl">Unassigned Agenda Items</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Submitted through the public form without a specific meeting. Assign each one to a
            meeting to bring it into that meeting&rsquo;s Agenda Items for review.
          </p>
          <ul className="mt-4 flex flex-col gap-3">
            {unassignedAgendaItems.map((item) => {
              const assign = async (formData: FormData) => {
                "use server";
                const meetingId = String(formData.get("meeting_id") ?? "");
                if (meetingId) await assignAgendaItemToMeeting(item.id, meetingId);
              };
              return (
                <li key={item.id} className="rounded-md border border-rule/60 p-3 text-sm">
                  <p className="text-ink">{item.title}</p>
                  {item.body && <p className="mt-1 text-ink-muted">{item.body}</p>}
                  <p className="mt-1 text-[11px] text-ink-muted/60">Submitted by {item.submitted_by_name}</p>
                  <form action={assign} className="mt-2 flex items-center gap-2">
                    <select
                      name="meeting_id"
                      required
                      defaultValue=""
                      className="flex-1 rounded-md border border-rule bg-paper px-2 py-1.5 text-xs text-ink"
                    >
                      <option value="" disabled>
                        Choose a meeting&hellip;
                      </option>
                      {allMeetings.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title} &mdash; {formatMeetingDate(m.date)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-paper hover:bg-ink/90"
                    >
                      Assign
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs uppercase tracking-wider text-ink-muted">
            {typeFilter ? (
              // The type name is already in the h1 above ("<Type>
              // Planning Dashboard") once filtered -- repeating it here
              // too was exactly the kind of over-repetition flagged
              // 2026-09-09 ("the words 'sacrament meeting' appear too
              // often"), so this slot becomes the "Show all types" link
              // instead of a second copy of the name.
              <Link
                href={dashboardHref({ readonly: isReadOnly, past: showPast })}
                className="normal-case tracking-normal text-ink-muted/70 hover:text-ink"
              >
                Show all types
              </Link>
            ) : (
              "Meetings"
            )}
            <Link
              href={dashboardHref({ type: typeFilter, readonly: isReadOnly, past: !showPast })}
              className="ml-3 normal-case tracking-normal text-ink-muted/70 hover:text-ink"
            >
              {showPast ? "Hide past meetings" : "Show past meetings"}
            </Link>
          </p>
          {canCreate && (
            <span className="flex items-center gap-3">
              <Link href="/meeting-schedule" className="text-xs text-ink-muted hover:text-ink">
                Meeting Schedule
              </Link>
              <Link
                href="/meetings/new"
                className="rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-paper transition-colors hover:bg-ink/90"
              >
                + New Meeting
              </Link>
            </span>
          )}
        </div>

        {meetings.length === 0 ? (
          <p className="mt-4 text-ink-muted">No meetings scheduled yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="px-2 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">
                    Date
                  </th>
                  {!typeFilter && (
                    <th className="px-2 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">
                      Type
                    </th>
                  )}
                  <th className="px-2 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">
                    Stage
                  </th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {meetings.map((meeting) => (
                  <MeetingRow
                    key={meeting.id}
                    meeting={meeting}
                    isBuilt={builtSlugs.has(meeting.meetingType)}
                    canManage={canCreate}
                    showType={!typeFilter}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="mt-auto pt-16 text-xs text-ink-muted">
        Ward OS &mdash; planning, conducting, and publishing meetings from one source of truth.
      </footer>
    </main>
  );
}