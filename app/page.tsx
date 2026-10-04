import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import { Tile, TileGrid } from "@/components/Tile";
import { getWardName } from "@/lib/data/ward-settings";
import { getTodaysPublishedSacramentMeeting } from "@/lib/data/meetings";
import { getVisibleMeetingTypesForUser } from "@/lib/data/meeting-type-access";
import { getSessionUser, hasAnyFeature, hasFeature } from "@/lib/supabase/get-session-user";
import { allMeetingFeatures } from "@/lib/data/meeting-features";
import { MEETING_TYPE_LABELS } from "@/lib/types";

// Per the user's request (2026-09-09): the landing page's browser tab
// now reads "Dashboard" and /dashboard's reads "Meeting Dashboard" (see
// that page's own metadata) -- distinct on purpose, since the user was
// confused about which page was actually "the dashboard page."
export const metadata: Metadata = {
  title: "Dashboard",
};

/**
 * The single landing page for everyone -- ward members, meeting
 * participants, youth leaders, music coordinators, and admins all land
 * here. Tiles are filtered in or out below based on login state and
 * whichever granular features the signed-in account's callings grant
 * (2026-10-04, replacing the old role-based gating entirely -- see
 * PROJECT_CONTEXT.md's Architecture section); tapping a tile navigates
 * to that feature's own existing page.
 */
export default async function HomePage() {
  const { user, profile } = await getSessionUser();
  const wardName = await getWardName();

  const isMusicPlanner = hasFeature(profile, "sacrament_music");
  const isYouthLeader = hasFeature(profile, "youth_teaching_planning") || hasFeature(profile, "youth_activity_planning");

  const todaysSacramentMeeting = await getTodaysPublishedSacramentMeeting();

  // Resolves every meeting type this account should see a "My meetings"
  // tile for -- calling-based (meeting_type_members) unioned with
  // whichever types' own viewing/planning/agenda_items features any of
  // this account's callings grant (2026-10-04, see
  // getVisibleMeetingTypesForUser's own doc comment) -- no more
  // role-based "admin sees every type" bypass layered on top; an admin
  // simply holds every type's planning feature and so is already
  // included here like anyone else.
  const visibleMeetingTypes = user ? await getVisibleMeetingTypesForUser(user.id, profile?.features) : [];
  // "Attends *some* meeting" -- gates Meeting Agenda Items below.
  const attendsMeetings = visibleMeetingTypes.length > 0;
  // Submit an Announcement shares that same gate, PLUS the standalone
  // `announcement_adding` feature outright -- for a calling that should
  // always be able to add announcements regardless of meeting
  // attendance (2026-10-04, replacing the old
  // "communications_specialist" role check). Kept separate from
  // attendsMeetings itself rather than folding the feature into that
  // broader check, since attendsMeetings also gates Meeting Agenda
  // Items, which this feature has no business reason to need.
  const canSubmitAnnouncement = attendsMeetings || hasFeature(profile, "announcement_adding");

  const canPlanAnyMeeting = hasAnyFeature(profile, allMeetingFeatures("planning"));
  const canMeetingSchedule = hasFeature(profile, "meeting_schedule");
  const canMeetingCancellations = hasFeature(profile, "meeting_cancellations");
  const canRotations = hasFeature(profile, "rotations");
  const canSpeakerPrayerHistory = hasFeature(profile, "speaker_prayer_history");
  const canMeetingPlanningHub =
    canPlanAnyMeeting || canMeetingSchedule || canMeetingCancellations || canRotations || canSpeakerPrayerHistory;
  const canCallingPlanning = hasFeature(profile, "calling_planning");
  const canAnnouncementManagement = hasFeature(profile, "announcement_management");
  const canTableAdmin =
    hasFeature(profile, "meeting_templates_admin") ||
    hasFeature(profile, "verify_logins") ||
    Array.from(profile?.features ?? []).some((f) => f.startsWith("table_admin_"));
  const showAdministration = canMeetingPlanningHub || canCallingPlanning || canAnnouncementManagement || canTableAdmin;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
      <AppHeader />

      <section className="mt-10">
        <h1 className="font-display text-3xl leading-tight sm:text-4xl">{wardName} Ward</h1>
        {!user && <p className="mt-2 text-ink-muted">Sign in for meeting and planning tools.</p>}
        {user && !profile?.isLinked && (
          <p className="mt-2 text-sm text-ink-muted">
            You&rsquo;re signed in, but an admin still needs to verify your account before you
            have access to anything else.
          </p>
        )}
      </section>

      {/* Tier 0 -- everyone, no login required */}
      <section className="mt-8">
        <p className="font-mono text-xs uppercase tracking-wider text-ink-muted">This week</p>
        <TileGrid>
            {todaysSacramentMeeting ? (
              <Tile
                title="Sacrament Meeting Program"
                description="Today's program"
                href={`/meetings/${todaysSacramentMeeting.id}/public`}
              />
            ) : (
              <Tile title="Sacrament Meeting Program" description="Published on meeting day" comingSoon />
            )}
          <Tile title="Announcements" description="Ward-wide announcements" href="/announcements/public" />
          <Tile
            title="Youth Activities"
            description="Planned activities for YW and YM"
            href="/youth-activities"
          />
          <Tile title="Scheduled Events" description="Youth and ward events" href="/events" />
        </TileGrid>
      </section>

      {/* Tier 1 -- any logged-in user, but only meeting types their own
          calling actually maps to (meeting_type_members) -- admins see
          all four regardless. Replaces the old single "Meetings" tile,
          which just linked to /dashboard's unfiltered hodgepodge of
          every meeting type. Meeting Agenda Items and Submit an
          Announcement both moved in here 2026-09-09 (were public
          Tier-0 tiles before) per the user's own request -- both are
          now only shown to accounts that actually attend a meeting by
          calling (attendsMeetings), not to every logged-in account the
          way the rest of this section's tiles are (those always
          include Sacrament Meeting regardless of calling -- see the
          comment above attendsMeetings). Per-type tiles link with
          `readonly=1` (2026-09-09, the user's own request: "make my
          meetings section for read only views of meetings") -- without
          it, a Bishopric account would land on /dashboard's full New
          Meeting/Cancel/Unassigned-Agenda-Items control surface even
          from here; that surface now lives only behind the
          Administration section's own Meeting Planning tile below. */}
      {user && (visibleMeetingTypes.length > 0 || canSubmitAnnouncement) && (
        <section className="mt-10">
          <p className="font-mono text-xs uppercase tracking-wider text-ink-muted">My meetings</p>
          <TileGrid>
            {visibleMeetingTypes.map((slug) => (
              <Tile
                key={slug}
                title={MEETING_TYPE_LABELS[slug]}
                href={`/dashboard?type=${slug}&readonly=1`}
              />
            ))}
            {attendsMeetings && (
              <Tile
                title="Meeting Agenda Items"
                description="Submit an agenda item for a meeting you attend"
                href="/submit/agenda-item"
              />
            )}
            {canSubmitAnnouncement && (
              <Tile
                title="Submit an Announcement"
                description="Share something with the ward"
                href="/submit/announcement"
              />
            )}
            {hasFeature(profile, "sacrament_program_view") && (
              <Tile
                title="Sacrament Meeting Programs"
                description="Preview upcoming and past programs, not just today's"
                href="/dashboard?type=sacrament-meeting&readonly=1"
              />
            )}
          </TileGrid>
        </section>
      )}

      {/* Tier 3 -- music coordinator + bishopric. Was two tiles
          (Sacrament Music Planning + a separate Music Coordination
          status overview) -- merged into one 2026-09-08 per the user's
          own call: the per-meeting Planning view (unified 2026-09-08,
          priority queue item 1 above) already covers everyday status
          for one meeting at a time, so a separate weeks-at-a-glance
          overview page added an entry point without adding a real
          capability. /music-coordination and its data module were
          removed outright, not just unlinked. */}
      {isMusicPlanner && (
        <section className="mt-10">
          <p className="font-mono text-xs uppercase tracking-wider text-ink-muted">Music</p>
          <TileGrid>
            <Tile
              title="Sacrament Meeting Music Planning"
              description="Enter and plan upcoming hymns and music"
              href="/music"
            />
          </TileGrid>
        </section>
      )}

      {/* Tier 3 -- shown when either youth-program feature is held
          (2026-10-04, granular-features pass); each tile below is then
          gated on its own specific feature. Which class(es) a given
          account actually sees inside Youth Teaching Planning is a
          separate, narrower question handled by getAccessibleClasses
          in lib/data/teaching-assignments.ts. */}
      {isYouthLeader && (
        <section className="mt-10">
          <p className="font-mono text-xs uppercase tracking-wider text-ink-muted">Youth program</p>
          <TileGrid>
            {hasFeature(profile, "youth_teaching_planning") && (
              <Tile
                title="Youth Teaching Planning"
                description="Sunday teaching assignments for your class"
                href="/youth-teaching-planning"
              />
            )}
            {hasFeature(profile, "youth_activity_planning") && (
              <Tile
                title="Youth Activity Planning"
                description="Plan and manage upcoming youth activities"
                comingSoon
              />
            )}
          </TileGrid>
        </section>
      )}

      {/* Tier 4 -- shown only when at least one of its own tiles is
          accessible (2026-10-04, granular-features pass) -- no more
          single "bishopric" role gating the whole section; each tile
          below is shown on its own feature. */}
      {showAdministration && (
        <section className="mt-10">
          <p className="font-mono text-xs uppercase tracking-wider text-ink-muted">Administration</p>
          <TileGrid>
            {canMeetingPlanningHub && (
              <Tile
                title="Meeting Planning"
                description="Meeting agendas, schedule, cancellations, and rotations"
                href="/meeting-planning"
              />
            )}
            {canCallingPlanning && (
              <Tile
                title="Calling Planning"
                description="One row per calling change: candidates, status, release, and readiness to announce"
                href="/calling-planning"
              />
            )}
            {canAnnouncementManagement && (
              <Tile
                title="Manage Announcements"
                description="Review and publish submissions"
                href="/announcements"
              />
            )}
            {canTableAdmin && (
              <Tile title="Table Admin" description="Direct edit access to raw data tables" href="/admin" />
            )}
          </TileGrid>
        </section>
      )}

      <footer className="mt-auto pt-16 text-xs text-ink-muted">
        Ward OS &mdash; Heritage Ward &mdash; Syracuse Utah Stake
      </footer>
    </main>
  );
}