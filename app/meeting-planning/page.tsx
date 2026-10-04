import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { Tile, TileGrid } from "@/components/Tile";
import { getSessionUser, hasAnyFeature, hasFeature } from "@/lib/supabase/get-session-user";
import { allMeetingFeatures } from "@/lib/data/meeting-features";

/**
 * Hub page for the landing page's "Meeting Planning" Administration
 * tile (2026-09-09, the user's own request): "make meeting schedule,
 * meeting cancellations, assignment rotations subtiles after clicking
 * on meeting planning, plus a meeting agendas tile that handles the
 * previous meeting planning content." Before this, "Meeting Planning"
 * linked straight to /dashboard (the full create/cancel/manage meeting
 * list) and Meeting Schedule/Meeting Cancellations/Assignment
 * Rotations sat as their own top-level Administration tiles -- this
 * folds them together as one group, with /dashboard itself now
 * reached via the "Meeting Agendas" subtile. Speaker & Prayer History
 * joined the same group right after, per the user's immediate
 * follow-up -- same reasoning, another meeting-planning-adjacent admin
 * tool that doesn't need its own top-level landing-page slot.
 *
 * "Meeting Agendas" itself became a further hub (/meeting-agendas,
 * 2026-09-09, same day) once the user asked for "a tile for each
 * meeting type under meeting agendas" -- see that page for the
 * per-type split.
 *
 * Gained an explicit "&larr; Home" back link (2026-09-09) per the
 * user's own request -- the AppHeader wordmark already links home, but
 * evidently wasn't read as a "back" affordance on its own.
 */
export default async function MeetingPlanningPage() {
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");

  // Gated on "has at least one of this hub's own tiles' features"
  // rather than a single blanket flag (2026-10-04, granular-features
  // pass) -- each tile below is then shown or hidden on its own feature.
  const canPlanAnyMeeting = hasAnyFeature(profile, allMeetingFeatures("planning"));
  const canMeetingSchedule = hasFeature(profile, "meeting_schedule");
  const canMeetingCancellations = hasFeature(profile, "meeting_cancellations");
  const canRotations = hasFeature(profile, "rotations");
  const canSpeakerPrayerHistory = hasFeature(profile, "speaker_prayer_history");

  if (!canPlanAnyMeeting && !canMeetingSchedule && !canMeetingCancellations && !canRotations && !canSpeakerPrayerHistory) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Meeting Planning" />
        <p className="mt-10 text-ink-muted">Your account doesn&rsquo;t have access to meeting planning.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
      <AppHeader tag="Meeting Planning" />

      <Link href="/" className="mt-6 text-xs text-ink-muted hover:text-ink">
        &larr; Home
      </Link>

      <h1 className="rise-in mt-2 font-display text-3xl leading-tight sm:text-4xl">Meeting Planning</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Schedule, cancel, and adjust rotations, or jump into a meeting&rsquo;s own agenda.
      </p>

      <div className="mt-6">
        <TileGrid>
          {canPlanAnyMeeting && (
            <Tile
              title="Meeting Agendas"
              description="Create, cancel, and manage meetings, by type"
              href="/meeting-agendas"
            />
          )}
          {canMeetingSchedule && (
            <Tile
              title="Meeting Schedule"
              description="Set cadence and generate meetings"
              href="/meeting-schedule"
            />
          )}
          {canMeetingCancellations && (
            <Tile
              title="Meeting Cancellations"
              description="Conferences, holidays, etc. -- auto-cancels affected meetings"
              href="/meeting-cancellations"
            />
          )}
          {canRotations && (
            <Tile
              title="Assignment Rotations"
              description="Who's next for prayers, chorister, etc."
              href="/rotations"
            />
          )}
          {canSpeakerPrayerHistory && (
            <Tile
              title="Speaker & Prayer History"
              description="Who's due for a turn"
              href="/speaker-prayer-history"
            />
          )}
        </TileGrid>
      </div>
    </main>
  );
}
