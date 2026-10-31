import { getPublicSacramentView } from "@/lib/data/public-view";
import { getMeetingById, getNextTwoSacramentMeetingIds } from "@/lib/data/meetings";
import { getSacramentPlanningData } from "@/lib/data/sacrament-planning";
import { isSacramentMeetingPubliclyVisible } from "@/lib/data/timezone";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";

export default async function PublicViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: meetingId } = await params;

  // No login required here by design (this is the actual public
  // program) -- but it had no stage check at all, meaning the same
  // data would come back even for a meeting still in template/
  // planning, or one that's since been archived (the Vision workflow
  // calls archived Sacrament Meetings admin-only, "no calling-based
  // *or* public access at all once archived"). Admins still need to
  // preview this at any stage while building it, so this only
  // restricts everyone else, added 2026-09-08.
  //
  // Gated on date + not-archived, not `ready`/`live` (2026-09-10, the
  // user's own request: "we can remove the review, ready, live
  // statuses for sacrament meeting") -- those stages were never
  // actually reachable (no Table Admin column, no dedicated action
  // ever built to set them), so this check could never have passed in
  // real production data; matches the same fix in
  // getTodaysPublishedSacramentMeeting.
  //
  // Communications Specialist originally got the same any-stage/any-date
  // preview as the Bishopric (2026-10-04, the user's own report: wants
  // "to read the public view of upcoming sacrament meetings at any
  // time"). Narrowed the same day once the "ready for public" checkbox
  // existed (the user's own words): "communication specialists would
  // see it once it is marked as public" -- their early access now
  // depends on the admin actually marking the program done, not just
  // on their role. Bishopric keeps unconditional any-stage/any-date
  // preview regardless (building the program comes before it's ready);
  // everyone else still only ever sees it on the actual day.
  const { profile } = await getSessionUser();
  const meeting = await getMeetingById(meetingId);
  if (!meeting) {
    return <p className="text-ink-muted">Could not load this meeting.</p>;
  }

  // Cancelled Sacrament Meetings don't show Planning/Conducting/Public
  // at all (2026-10-04, the user's own request) -- see
  // app/meetings/[id]/planning/page.tsx's own comment on this. Checked
  // before the admin/non-admin branch below so it applies regardless
  // of who's asking.
  if (meeting.cancelled) {
    return (
      <p className="text-ink-muted">
        This meeting has been cancelled{meeting.cancellationNote ? `: ${meeting.cancellationNote}` : "."}
      </p>
    );
  }

  if (!hasFeature(profile, "sacrament_planning")) {
    // Archived is admin-only, full stop, regardless of the "ready for
    // public" flag or who's asking -- the Vision workflow's own rule
    // ("no calling-based or public access at all once archived") isn't
    // something the early-preview exception below should be able to
    // outlive once the meeting is actually over.
    if (meeting.stage === "archived") {
      return <p className="text-ink-muted">This program isn&rsquo;t available right now.</p>;
    }

    // Mountain Time, not the server's own UTC clock, and not available
    // until 6 AM on the day -- see isSacramentMeetingPubliclyVisible's
    // own comment for why (2026-10-11 bugfix: the next day's meeting
    // was going public a few hours early every evening).
    if (!isSacramentMeetingPubliclyVisible(meeting.date)) {
      const canPreviewEarly = hasFeature(profile, "sacrament_program_view");
      if (!canPreviewEarly) {
        return <p className="text-ink-muted">This program isn&rsquo;t available right now.</p>;
      }

      // Two independent early-access paths, both additive (2026-10-27,
      // the user's own clarification of the 2026-10-24 fix above):
      // `ready_for_public` still works for a meeting further out an
      // admin wants to flag early, and -- new -- the nearest two
      // upcoming Sacrament Meetings are always viewable regardless of
      // that flag, "an in-between type of access to allow someone to
      // prepare a printed program." Neither check short-circuits the
      // other; either one being true is enough.
      const readyForPublic = (await getSacramentPlanningData(meetingId)).planning?.ready_for_public ?? false;
      const withinNextTwo = (await getNextTwoSacramentMeetingIds()).has(meetingId);
      if (!readyForPublic && !withinNextTwo) {
        return <p className="text-ink-muted">This program isn&rsquo;t available right now.</p>;
      }
    }
  }

  const view = await getPublicSacramentView(meetingId);

  if (!view) {
    return <p className="text-ink-muted">Could not load this meeting.</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      {view.items.map((item, i) => (
        <div
          key={i}
          // flex-wrap (2026-10-31, mobile-friendliness pass) -- a long
          // heading (a musical number's title) next to a long detail
          // (several performer names) had no way to drop onto its own
          // line on a narrow phone screen, same fix already applied to
          // the public Announcements page's identical heading+detail
          // row (app/announcements/public/page.tsx).
          className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule/40 py-2 last:border-0"
        >
          <span className="text-ink">{item.heading}</span>
          {item.detail && <span className="text-right text-ink-muted">{item.detail}</span>}
        </div>
      ))}
    </div>
  );
}
