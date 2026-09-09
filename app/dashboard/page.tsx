import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { LifecycleBadge } from "@/components/LifecycleBadge";
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

function MeetingRow({
  meeting,
  isBuilt,
  canManage,
}: {
  meeting: Meeting;
  isBuilt: boolean;
  canManage: boolean;
}) {
  const card = (
    <div
      className={[
        "flex flex-col gap-3 rounded-md border px-5 py-4 transition-colors sm:flex-row sm:items-center sm:justify-between",
        meeting.cancelled ? "border-red-900/30 bg-red-950/5" : isBuilt ? "border-rule bg-card hover:border-ink/30" : "border-rule/60",
      ].join(" ")}
    >
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-slate/70">
          {meeting.title}
        </p>
        <p className={["font-display text-lg", isBuilt ? "text-ink" : "text-ink/40"].join(" ")}>
          {meeting.title}
          {meeting.cancelled && (
            <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-red-700">
              Cancelled
            </span>
          )}
          {meeting.noActivity && !meeting.cancelled && (
            <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-slate/50">
              No Activity
            </span>
          )}
        </p>
        <p className={isBuilt ? "text-sm text-slate" : "text-sm text-slate/60"}>
          {formatMeetingDate(meeting.date)}
        </p>
        {meeting.cancelled && (
          <p className="mt-1 text-xs text-red-700">
            Cancelled{meeting.cancellationNote ? `: ${meeting.cancellationNote}` : "."}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <LifecycleBadge stage={meeting.stage} />
        {!isBuilt && (
          <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-widest text-slate/70">
            Coming soon
          </span>
        )}
      </div>
    </div>
  );

  // Admins land on the meeting's own hub (tabs for Planning/Conducting/
  // Public, or Template/Planning/Live) same as always; everyone else
  // goes straight to whichever read-only view actually applies to them
  // -- the public program for Sacrament Meeting, the calling-based
  // read-only view (which enforces its own access) for the other three.
  const nonAdminHref = meeting.meetingType === "sacrament-meeting" ? "public" : "archived";
  const href = canManage ? `/meetings/${meeting.id}` : `/meetings/${meeting.id}/${nonAdminHref}`;

  const linked = isBuilt ? (
    <Link href={href} className="block">
      {card}
    </Link>
  ) : (
    card
  );

  if (!canManage || meeting.stage === "archived") {
    return <li>{linked}</li>;
  }

  const uncancel = async () => {
    "use server";
    await uncancelMeeting(meeting.id);
  };
  const cancel = async (formData: FormData) => {
    "use server";
    await cancelMeeting(formData);
  };

  return (
    <li className="flex flex-col gap-1.5">
      {linked}
      <div className="flex items-center gap-2 px-1">
        {meeting.cancelled ? (
          <form action={uncancel}>
            <button type="submit" className="text-xs text-slate hover:text-ink">
              Un-cancel
            </button>
          </form>
        ) : (
          <form action={cancel} className="flex items-center gap-1">
            <input type="hidden" name="id" value={meeting.id} />
            <input
              type="text"
              name="cancellation_note"
              placeholder="Reason (optional)"
              className="w-40 rounded border border-rule bg-paper px-1.5 py-1 text-[11px] text-ink"
            />
            <button type="submit" className="text-xs text-slate hover:text-ink">
              Cancel Meeting
            </button>
          </form>
        )}
      </div>
    </li>
  );
}

const MEETING_TYPE_SLUGS = new Set<string>(["sacrament-meeting", "bishopric-meeting", "ward-council", "youth-council"]);

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; readonly?: string }>;
}) {
  const { type: rawType, readonly: rawReadOnly } = await searchParams;
  const typeFilter: MeetingTypeSlug | null = rawType && MEETING_TYPE_SLUGS.has(rawType) ? (rawType as MeetingTypeSlug) : null;
  // Reached with ?readonly=1 from the landing page's "My meetings"
  // section (2026-09-09, the user's own request: "make my meetings
  // section for read only views of meetings") -- forces canCreate off
  // even for a Bishopric account, which otherwise sees the full New
  // Meeting/Cancel/Unassigned-Agenda-Items control surface below. The
  // new "Meeting Planning" Administration tile links to this same page
  // with no readonly flag, for exactly that full control surface.
  const isReadOnly = rawReadOnly === "1";

  const { user, profile } = await getSessionUser();

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Meetings" />
        <h1 className="mt-10 font-display text-3xl leading-tight sm:text-4xl">Dashboard</h1>
        <p className="mt-4 text-slate">Sign in to see meetings.</p>
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
  const meetings = typeFilter ? allMeetings.filter((m) => m.meetingType === typeFilter) : allMeetings;
  const builtSlugs = new Set(meetingTypes.filter((t) => t.isBuilt).map((t) => t.slug));
  const canCreate = profile?.role === "bishopric" && !isReadOnly;
  const unassignedAgendaItems = canCreate ? await getUnassignedAgendaItems() : [];

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
      <AppHeader tag="Meetings" />
      <h1 className="mt-10 font-display text-3xl leading-tight sm:text-4xl">Dashboard</h1>

      {canCreate && unassignedAgendaItems.length > 0 && (
        <section className="mt-10 rounded-lg border border-rule bg-card p-6">
          <h2 className="font-display text-xl">Unassigned Agenda Items</h2>
          <p className="mt-1 text-xs text-slate">
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
                  {item.body && <p className="mt-1 text-slate">{item.body}</p>}
                  <p className="mt-1 text-[11px] text-slate/60">Submitted by {item.submitted_by_name}</p>
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
          <p className="font-mono text-xs uppercase tracking-widest text-slate">
            {typeFilter ? MEETING_TYPE_LABELS[typeFilter] : "Meetings"}
            {typeFilter && (
              <Link
                href={isReadOnly ? "/dashboard?readonly=1" : "/dashboard"}
                className="ml-3 normal-case tracking-normal text-slate/70 hover:text-ink"
              >
                Show all types
              </Link>
            )}
          </p>
          {canCreate && (
            <span className="flex items-center gap-3">
              <Link href="/meeting-schedule" className="text-xs text-slate hover:text-ink">
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

        <ul className="mt-4 flex flex-col gap-3">
          {meetings.map((meeting) => (
            <MeetingRow
              key={meeting.id}
              meeting={meeting}
              isBuilt={builtSlugs.has(meeting.meetingType)}
              canManage={canCreate}
            />
          ))}
        </ul>

        {meetings.length === 0 && <p className="mt-4 text-slate">No meetings scheduled yet.</p>}
      </section>

      <footer className="mt-auto pt-16 text-xs text-slate">
        Ward OS &mdash; planning, conducting, and publishing meetings from one source of truth.
      </footer>
    </main>
  );
}